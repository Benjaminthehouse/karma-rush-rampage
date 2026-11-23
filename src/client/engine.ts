// Runs one match: five rounds on a fixed timeline (intro → play → result).
// The timeline is driven by a clock supplied by the caller, so a solo run and a
// synced party match are the same code with a different start time. Everything
// timed inside a phase (announcer words, score count-up) is a cue checked against
// that clock, never a timer, so nothing can fire after the phase is over.
import type { Rival } from '../shared/api';
import { GAME_META, GO_MS, MAX_ROUND_SCORE, TIMING, hashStr, mulberry32, timeline, type Phase, type Round } from '../shared/daily';
import { fmt } from './api';
import { avatar, shortName } from './avatar';
import { createBot } from './bot';
import { createFx } from './fx';
import { BEAT_SYNC, COLOR, clamp1000, h, type Btn, type FxColor, type GameInst } from './games/common';
import { GAMES } from './games/registry.gen';
import { FIXED_NOTES, HIT_GOOD, HIT_VOICE, ON_THE_BEAT } from './hits';
import { music, sfx } from './sfx';
import { voice } from './voice';

/** A paced round scoring under this did not click with the player: it earns one free retry. */
const RETRY_UNDER = 200;

/** Speech engines take about this long to start a word, so each one is asked for early. */
const VOICE_LEAD = 90;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type Match = {
  done: Promise<number[]>;
  press(b: Btn): void;
  release(b: Btn): void;
  stop(): void;
  /** Re-render standings when fresher rival scores arrive. */
  refresh(): void;
};

const TIERS = ['ZERO KARMA', 'OOF', 'NOT BAD', 'GREAT!', 'PERFECT!'];
const tier = (score: number) => (score >= 950 ? 4 : score >= 700 ? 3 : score >= 400 ? 2 : score > 0 ? 1 : 0);
export const rating = (score: number) => TIERS[tier(score)];

/** Standings after `through` rounds; a rival with no score yet for a round shows as still playing. */
export function standings(me: string, mine: number[], rivals: Rival[], through: number, myAvatar?: string): HTMLElement {
  const sum = (a: number[]) => a.slice(0, through).reduce((x, y) => x + y, 0);
  const rows = [
    { name: me, total: sum(mine), you: true, bot: false, pending: false, avatar: myAvatar },
    ...rivals.map((r) => ({
      name: r.name,
      total: sum(r.rounds),
      you: false,
      bot: !!r.bot,
      pending: r.rounds.length < through,
      avatar: r.avatar,
    })),
  ].sort((a, b) => b.total - a.total);
  const list = h('ol', 'standings');
  const max = Math.max(1, through * MAX_ROUND_SCORE);
  rows.slice(0, 6).forEach((r, i) => {
    const li = h('li', r.you ? 'you' : '');
    li.style.setProperty('--i', String(i));
    const bar = h('i');
    bar.style.width = `${Math.max(2, (r.total / max) * 100)}%`;
    const name = h('span', 'who', r.you && r.name !== 'you' ? `${r.name} (you)` : r.name);
    name.prepend(avatar(r.name, { url: r.avatar, bot: r.bot }));
    if (r.bot) name.append(h('em', '', 'bot'));
    li.append(bar, name, h('span', 'pts', r.pending ? `${fmt(r.total)}…` : fmt(r.total)));
    list.append(li);
  });
  return list;
}

type Cue = { at: number; run: () => void };

export function runMatch(o: {
  lineup: Round[];
  /** ms since the match started; negative while counting down. */
  clock: () => number;
  me: string;
  /** The player's own Reddit avatar image, if they have one. */
  avatar?: string;
  rivals: () => Rival[];
  setPads: (labels: [string, string, string]) => void;
  /** Light a pad for a beat (the announcer's words chase across the pads). */
  pulsePad?: (b: Btn) => void;
  /** Called about once a second mid-round with the score so far (party players share it). */
  onLive?: (rounds: number[], live: number) => void;
  /** Which pads are physically down right now, so a pad held through the intro still counts. */
  held?: () => readonly boolean[];
  /** Demo mode: a bot plays by following each game's hint(). Practice only. */
  autoplay?: { press: (b: Btn) => void; release: (b: Btn) => void };
  /**
   * Solo runs set this: nobody else shares the clock, so it can wait for the player.
   * Each round's instructions stay up until a button is tapped, and a round that scores
   * next to nothing (the game plainly did not click) offers one free retry.
   */
  paced?: boolean;
  /**
   * Live Party sets this: the shared clock itself waits at the end of each round's
   * instructions until everyone has tapped READY (or time is up). `ready` reports this
   * player's tap; `status` says how the wait for that round is going.
   */
  gate?: {
    ready: (round: number) => void;
    status: (round: number) => { ready: number; of: number; left: number };
  };
  onRound?: (rounds: number[]) => void;
}): Match {
  const phases = timeline(o.lineup);
  const arena = $('arena');
  const stage = $('stage');
  const card = $('card');
  const bar = $('timebar').firstElementChild as HTMLElement;
  const pips = $('pips');
  const comboEl = $('combo');
  const fx = createFx(arena, $('fx'));
  const scores: number[] = [];
  const down = [false, false, false];
  let p = -1;
  // The pausable clock for paced runs. While a card waits for a tap, time stands still.
  let heldMs = 0; // total time spent waiting so far
  let waitSince = -1; // the raw clock when the current wait began, or -1
  let waitFor: '' | 'ready' | 'retry' = '';
  let readyFrom = Infinity; // ms into the intro from which a tap counts as "ready"
  let readyEl: HTMLElement | null = null;
  let gateText = ''; // what the party READY prompt says now
  const ready: boolean[] = []; // rounds whose instructions have been tapped away
  const retried: boolean[] = []; // rounds that have used their free retry
  const now = () => (waitSince >= 0 ? waitSince : o.clock()) - heldMs;
  /** Stops the clock at `at` (match time) until `resume()`. */
  const hold = (why: 'ready' | 'retry', at: number) => {
    waitFor = why;
    waitSince = o.clock();
    heldMs = waitSince - at;
  };
  /** Starts the clock again, at `at` (match time) if given, else where it stopped. */
  const resume = (at?: number) => {
    heldMs = at === undefined ? heldMs + (o.clock() - waitSince) : o.clock() - at;
    waitSince = -1;
    waitFor = '';
  };
  let inst: GameInst | null = null;
  let cues: Cue[] = [];
  let combo = 0;
  let raf = 0;
  let stopped = false;
  let lastCount = 0;
  let rushing = false;
  let lastPing = 0;
  let shownScore = -1;
  const raceEl = $('race');
  let racers: { name: string; you: boolean; el: HTMLElement; bar: HTMLElement; curve: number; at: number }[] = [];
  let raceShown = '';
  let raceLead = -1;

  /**
   * The race strip: one cell per player, side by side, so nobody ever covers anybody.
   * Each cell is a face, a name and a bar that fills towards 1,000 as the round goes;
   * whoever is ahead right now wears the crown. Recorded runs carry their place on the
   * day's leaderboard, so it is plain who is being chased.
   */
  function lineUp() {
    const them = o.rivals().slice(0, 4);
    const who = [
      { name: o.me, you: true, avatar: o.avatar, bot: false, rank: undefined as number | undefined },
      ...them.map((r) => ({ name: r.name, you: false, avatar: r.avatar, bot: !!r.bot, rank: r.rank })),
    ];
    // Rebuilt only when the line-up changes (a party player joining), never every round.
    const key = who.map((n) => n.name).join('|');
    if (key !== raceShown) {
      raceShown = key;
      racers = who.map((n) => {
        const el = h('div', `racer${n.you ? ' you' : ''}`);
        const bar = h('i');
        const track = h('span', 'bar');
        track.append(bar);
        const label = h('em', '', n.you ? 'YOU' : shortName(n.name, who.length > 4 ? 7 : 9));
        const text = h('span', 'txt');
        text.append(label, track);
        el.append(avatar(n.name, { url: n.avatar, bot: n.bot }), text);
        if (n.rank) el.append(h('b', 'rank', `#${n.rank}`));
        // Ghost runs replay as a curve to their recorded score: some start fast, some finish strong.
        return { name: n.name, you: n.you, el, bar, curve: 0.75 + (hashStr(n.name) % 60) / 100, at: -1 };
      });
      raceEl.replaceChildren(...racers.map((r) => r.el));
      raceLead = -1;
    }
    racers.forEach((r) => {
      r.at = -1;
      r.bar.style.transform = 'scaleX(0)';
    });
  }

  /** "You are racing": the same faces, introduced by name before the first round. */
  function versus(): HTMLElement {
    const row = h('div', 'versus');
    const them = o.rivals().slice(0, 3);
    if (!them.length) return row;
    row.append(h('span', 'vs-title', them.some((r) => !r.bot) ? 'RACING TODAY’S PLAYERS' : 'RACING THE HOUSE BOTS'));
    const line = h('div', 'vs-line');
    for (const r of them) {
      const cell = h('div', 'vs-cell');
      cell.append(avatar(r.name, { url: r.avatar, bot: r.bot }), h('b', '', shortName(r.name, 12)), h('small', '', r.rank ? (r.rank === 1 ? '#1 today' : `#${r.rank} today`) : r.bot ? 'bot' : 'live'));
      line.append(cell);
    }
    row.append(line);
    return row;
  }

  function race(ph: Phase, local: number, mine: number) {
    const frac = Math.max(0, Math.min(1, local / (ph.end - ph.start)));
    const rivals = o.rivals();
    let best = 0;
    let lead = -1;
    for (const r of racers) {
      let v = mine;
      if (!r.you) {
        const rv = rivals.find((x) => x.name === r.name);
        const known = rv?.rounds[ph.round];
        // A recorded run has this round's score already; a live player only has their latest ping.
        v = known !== undefined ? known * frac ** r.curve : (rv?.live ?? 0);
      }
      // Bars move in steps of half a percent, and only when they change.
      const at = Math.round(Math.max(0, Math.min(1000, v)) / 5);
      if (at > best) {
        best = at;
        lead = racers.indexOf(r);
      }
      if (at === r.at) continue;
      r.at = at;
      r.bar.style.transform = `scaleX(${at / 200})`;
    }
    if (best <= 0) lead = -1;
    if (lead !== raceLead) {
      racers[raceLead]?.el.classList.remove('first');
      racers[lead]?.el.classList.add('first');
      raceLead = lead;
    }
  }
  const scoreEl = $('hud-score');
  let bot: ReturnType<typeof createBot> | null = null;
  let finish!: (s: number[]) => void;
  const done = new Promise<number[]>((r) => (finish = r));

  const total = () => scores.reduce((a, b) => a + b, 0);
  // Scaled, not resized: a transform never forces the page to lay out again.
  const setBar = (frac: number) => (bar.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`);
  let lastHud = -1000;

  function hud() {
    pips.replaceChildren(
      ...o.lineup.map((_, i) => h('i', i < scores.length ? 'done' : i === scores.length ? 'now' : ''))
    );
    shownScore = total();
    scoreEl.textContent = fmt(shownScore);
    scoreEl.classList.remove('live');
  }

  function setCombo(n: number) {
    combo = n;
    comboEl.textContent = n >= 3 ? `×${n}` : '';
    comboEl.dataset.heat = String(Math.min(3, Math.floor(n / 5)));
    if (n >= 3) {
      comboEl.classList.remove('bump');
      void comboEl.offsetWidth;
      comboEl.classList.add('bump');
    }
  }

  function showCard(kind: string, ...kids: (HTMLElement | string)[]) {
    // Each round's announcer card gets its own loud colour pair.
    card.className = `ui card-${kind} hue${Math.max(0, p < 0 ? 0 : phases[Math.min(p, phases.length - 1)].round) % 5}`;
    card.replaceChildren(...kids);
    card.hidden = false;
  }

  // ---- phase: intro. The announcer dictates the command one word at a time.
  function intro(ph: Phase, round: Round) {
    const meta = GAME_META[round.id];
    stage.replaceChildren();
    stage.className = '';
    fx.clear();
    setBar(1);
    bar.parentElement!.classList.remove('rush');
    setCombo(0);
    $('hud-title').textContent = meta.title;
    o.setPads(meta.labels);
    hud();

    const words = meta.shout.split(/\s+/).filter(Boolean);
    const shout = h('div', `shout n${Math.min(6, words.length)}`);
    const spans = words.map((w, i) => {
      const s = h('span', `c${i % 3}`, w);
      shout.append(s);
      return s;
    });
    const how = h('p', 'how', meta.how);
    const legend = h('div', 'legend');
    meta.labels.forEach((l, i) => {
      const chip = h('span', `c-${COLOR[i]}`, l);
      chip.prepend(h('kbd', '', 'ASD'[i]));
      legend.append(chip);
    });
    readyEl = o.gate
      ? h('div', 'ready', 'TAP WHEN READY')
      : o.paced && !ready[ph.round]
        ? h('div', 'ready', 'TAP ANY BUTTON TO START')
        : null;
    gateText = '';
    readyFrom = Infinity;
    showCard(
      'intro',
      h('div', 'eyebrow', `ROUND ${ph.round + 1} OF ${o.lineup.length} · ${meta.title}`),
      shout,
      how,
      legend,
      ...(readyEl ? [readyEl] : [])
    );

    const lead = 450;
    // Slow enough for a spoken word to fit in each beat.
    const cadence = Math.max(300, Math.min(460, (TIMING.intro - lead - 900) / words.length));
    cues.push({
      at: 150,
      run: () => {
        sfx.whoosh();
      },
    });
    // The voice says each word as it lands: one short utterance per word, started a touch
    // early because speech takes a moment to begin. A `say` spelling is used word for word
    // when it has the same number of words as the shout.
    const said = (meta.say ?? '').split(/\s+/).filter(Boolean);
    const spoken = said.length === words.length ? said : words;
    spoken.forEach((w, i) =>
      cues.push({
        at: Math.max(0, lead + i * cadence - VOICE_LEAD),
        run: () => voice.say(w.replace(/[^\p{L}\p{N}'’%-]/gu, ''), { rate: 1.35, pitch: 1.15 }),
      })
    );
    spans.forEach((s, i) =>
      cues.push({
        at: lead + i * cadence,
        run: () => {
          s.classList.add('in');
          sfx.slam(i);
          fx.lights((['red', 'green', 'blue'] as FxColor[])[i % 3]);
          o.pulsePad?.((i % 3) as Btn);
        },
      })
    );
    cues.push({
      at: lead + words.length * cadence + 120,
      run: () => {
        how.classList.add('in');
        legend.classList.add('in');
        // From here the whole instruction is on screen: a tap means "got it, go".
        readyEl?.classList.add('in');
        readyFrom = lead + words.length * cadence + 120;
      },
    });
  }

  // ---- phase: play.
  function play(round: Round) {
    const meta = GAME_META[round.id];
    card.hidden = true;
    stage.replaceChildren();
    stage.className = '';
    down.fill(false);
    rushing = false;
    lastPing = 0;
    lastHud = -1000;
    lineUp();
    sfx.go();
    fx.flash('white');
    // The first kick is heard BEAT_SYNC into the round, however late this frame is running.
    const into = Math.max(0, now() - (phases[p]?.start ?? now()));
    music.start(round.seed, round.level, { lead: (BEAT_SYNC - into) / 1000, beat: ON_THE_BEAT.has(round.id) });
    // The arena lights throb in time with the round's music.
    arena.style.setProperty('--beat', `${60 / music.bpm(round.level)}s`);
    arena.classList.add('playing');
    const factory = GAMES[round.id];
    bot = o.autoplay ? createBot(meta.think ?? 380, meta.kind !== 'mash') : null;
    try {
      inst = factory({
        root: stage,
        rng: mulberry32(round.seed),
        level: round.level,
        duration: meta.duration,
        down,
        good(at, text) {
          setCombo(combo + 1);
          sfx.good(combo, HIT_GOOD[round.id] ?? HIT_VOICE[round.id]);
          fx.burst(at ?? null, 'gold', 3);
          fx.lights('green');
          if (text) fx.pop(at ?? null, text, 'gold');
          if (combo % 10 === 0 || combo === 5) {
            sfx.milestone();
            fx.banner(`COMBO ×${combo}!`);
            fx.flash('gold');
          }
        },
        bad(at, text) {
          setCombo(0);
          sfx.bad();
          fx.shake();
          fx.buzz(35);
          fx.lights('red');
          if (text) fx.pop(at ?? null, text, 'red');
        },
        fx: {
          burst: fx.burst,
          pop: fx.pop,
          poof: fx.poof,
          flash: fx.flash,
          shake: fx.shake,
          sound: (name) => sfx.named(name, combo),
          note: (b) => sfx.tap(b, 0, HIT_VOICE[round.id]),
        },
      });
    } catch (err) {
      // One broken mini-game must never take the whole run down.
      console.error(`mini-game ${round.id} failed to start`, err);
      inst = null;
    }
    // A player who heard "HOLD!" may already be holding: tell the game.
    if (!o.paced && !o.gate) o.held?.().forEach((isDown, b) => isDown && input('press', b as Btn));
  }

  function endPlay(ph: Phase) {
    let score = 0;
    try {
      score = inst ? clamp1000(inst.score()) : 0;
    } catch (err) {
      console.error('score() failed', err);
    }
    scores[ph.round] = score;
    inst = null;
    down.fill(false);
    music.stop();
    arena.classList.remove('playing');
    sfx.roundEnd();
    stage.className = 'frozen';
    setBar(0);
    bar.parentElement!.classList.remove('rush');
    o.onRound?.([...scores]);
  }

  // ---- phase: result. Score counts up, the verdict stamps in, then standings.
  function result(ph: Phase, round: Round) {
    const meta = GAME_META[round.id];
    const score = scores[ph.round] ?? 0;
    if (o.paced && score < RETRY_UNDER && !retried[ph.round]) {
      // Next to nothing scored: the game did not click. Stop the clock and offer one free go.
      const legend = h('div', 'legend in');
      meta.labels.forEach((l, i) => legend.append(h('span', `c-${COLOR[i]}`, l)));
      showCard(
        'retry',
        h('div', 'eyebrow', meta.title),
        h('div', 'oops', 'NO WORRIES!'),
        h('p', 'why', `Under ${RETRY_UNDER} points does not count the first time. Here is the idea again:`),
        h('p', 'how in', meta.how),
        legend,
        h('div', 'ready in', 'ONE FREE RETRY')
      );
      o.setPads(['KEEP SCORE', 'RETRY', 'RETRY']);
      hud();
      hold('retry', ph.start + 1);
      return;
    }
    const tr = tier(score);
    const num = h('div', 'round-score', '+0');
    const verdict = h('div', `rating t${tr}`, TIERS[tr]);
    const box = h('div', 'standings-box');
    showCard('result', h('div', 'eyebrow', meta.title), num, verdict, box);
    hud();
    const COUNT = 700;
    for (let i = 1; i <= 14; i++) {
      cues.push({
        at: 100 + (COUNT * i) / 14,
        run: () => {
          num.textContent = `+${fmt(Math.round((score * i) / 14))}`;
          if (score > 0) sfx.tick();
        },
      });
    }
    cues.push({
      at: 100 + COUNT + 120,
      run: () => {
        verdict.classList.add('in');
        num.classList.add('landed');
        sfx.result(tr - 1);
        voice.say(TIERS[tr], { rate: 1.1, pitch: tr >= 3 ? 1.4 : 0.9 });
        if (tr >= 3) {
          fx.confetti(tr === 4 ? 90 : 45);
          fx.flash('gold');
        }
        fx.lights(tr >= 2 ? 'gold' : 'red');
      },
    });
    cues.push({
      at: 100 + COUNT + 520,
      run: () => {
        box.replaceChildren(standings(o.me, scores, o.rivals(), ph.round + 1, o.avatar));
        box.classList.add('in');
      },
    });
  }

  function enter(ph: Phase) {
    cues = [];
    const round = o.lineup[ph.round];
    if (ph.type === 'intro') intro(ph, round);
    else if (ph.type === 'play') play(round);
    else result(ph, round);
  }

  function frame() {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const t = now();
    if (t < 0) {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount) {
        lastCount = n;
        sfx.count(n);
        showCard('count', h('div', 'eyebrow', 'GET READY'), h('div', 'count', String(n)), versus());
        o.setPads(['', '', '']);
        hud();
      }
      return;
    }
    if (p < 0) enter(phases[(p = 0)]);
    // A paced intro does not run out: it waits, GO_MS short of its end, for a tap.
    const cur = phases[p];
    if (o.paced && !waitFor && cur?.type === 'intro' && !ready[cur.round] && t >= cur.end - GO_MS) {
      hold('ready', cur.end - GO_MS);
      return;
    }
    if (o.gate && cur?.type === 'intro') waitAtGate(cur, t);
    while (p < phases.length && t >= phases[p].end) {
      if (phases[p].type === 'play') endPlay(phases[p]);
      p++;
      if (p < phases.length) enter(phases[p]);
    }
    if (p >= phases.length) {
      stop();
      finish(scores);
      return;
    }
    const ph = phases[p];
    const local = t - ph.start;
    if (cues.length) {
      const due = cues.filter((c) => c.at <= local);
      cues = cues.filter((c) => c.at > local);
      due.forEach((c) => c.run());
    }
    if (ph.type === 'play') {
      const left = ph.end - t;
      setBar(left / (ph.end - ph.start));
      if (!rushing && left < 2000) {
        rushing = true;
        music.rush(true);
        bar.parentElement!.classList.add('rush');
      }
      try {
        inst?.tick(local);
        if (inst && bot && o.autoplay) bot(inst, local, o.autoplay.press, o.autoplay.release);
        // The score in the corner climbs live, so the round total is never a surprise.
        // Ten times a second is plenty for the corner score and the race track.
        if (inst && local - lastHud >= 100) {
          lastHud = local;
          const mine = clamp1000(inst.score());
          race(ph, local, mine);
          if (o.onLive && local - lastPing >= 1000 && mine > 0) {
            lastPing = local;
            o.onLive([...scores], mine);
          }
          const live = total() + mine;
          if (live !== shownScore) {
            shownScore = live;
            scoreEl.textContent = fmt(live);
            if (live > 0) scoreEl.classList.add('live');
          }
        }
      } catch (err) {
        console.error('tick() failed', err);
        inst = null;
      }
    }
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    music.stop();
    arena.classList.remove('playing');
    voice.hush();
    fx.clear();
    card.hidden = true;
  }

  /** Live Party: keeps the READY prompt saying how the wait is going, and calls GO. */
  function waitAtGate(ph: Phase, t: number) {
    if (!readyEl || !o.gate) return;
    let text = 'GO!';
    if (t <= ph.end - GO_MS) {
      if (!readyEl.classList.contains('in')) return; // still dictating the command
      const s = o.gate.status(ph.round);
      const secs = Math.max(0, Math.ceil(s.left / 1000));
      const more = Math.max(0, s.of - s.ready);
      text = !ready[ph.round]
        ? `TAP WHEN READY · ${secs}`
        : more > 0
          ? `READY! WAITING FOR ${more} MORE · ${secs}`
          : 'READY!';
    }
    if (text === gateText) return;
    gateText = text;
    readyEl.textContent = text;
    readyEl.classList.toggle('set', !!ready[ph.round] || text === 'GO!');
    if (text === 'GO!') {
      readyEl.classList.add('in');
      sfx.go();
    }
  }

  /** A tap on a card that is waiting (or about to wait) for one. True if it was used. */
  function answer(ph: Phase, b: Btn): boolean {
    if (o.gate) {
      // Live Party: the tap says "I am ready"; the round goes when everyone has.
      const t = now();
      const shown = t - ph.start >= readyFrom || t >= ph.end - GO_MS;
      if (ph.type !== 'intro' || ready[ph.round] || !shown || t > ph.end - GO_MS) return false;
      ready[ph.round] = true;
      sfx.good(2);
      o.pulsePad?.(b);
      o.gate.ready(ph.round);
      waitAtGate(ph, t);
      return true;
    }
    if (ph.type === 'intro' && !ready[ph.round] && (waitFor === 'ready' || now() - ph.start >= readyFrom)) {
      // Ready: skip whatever is left of the intro and go.
      ready[ph.round] = true;
      if (readyEl) readyEl.textContent = 'GO!';
      sfx.go();
      if (waitFor) resume();
      else heldMs -= Math.max(0, ph.end - GO_MS - now());
      return true;
    }
    if (waitFor === 'retry' && ph.type === 'result') {
      retried[ph.round] = true;
      sfx.press(b);
      if (b === 0) {
        // Keep the score: carry on to the ordinary result card.
        resume();
        cues = [];
        result(ph, o.lineup[ph.round]);
        return true;
      }
      // Retry: wind the clock back to this round's instructions, with a fresh deal so the
      // first attempt cannot be used as a peek.
      const first = p - 2;
      scores.length = ph.round;
      ready[ph.round] = false;
      o.lineup[ph.round] = { ...o.lineup[ph.round], seed: (o.lineup[ph.round].seed + 7919) >>> 0 };
      resume(phases[first].start);
      p = first;
      enter(phases[p]);
      return true;
    }
    return false;
  }

  function input(kind: 'press' | 'release', b: Btn) {
    down[b] = kind === 'press';
    const ph = phases[p];
    if (kind === 'press' && (o.paced || o.gate) && ph && answer(ph, b)) return;
    if (ph?.type !== 'play' || !inst) {
      if (kind === 'press') sfx.press(b);
      return;
    }
    // The tap itself sounds like the game: its voice, at this pad's note, as high as the streak.
    if (kind === 'press') {
      const id = o.lineup[ph.round].id;
      sfx.tap(b, FIXED_NOTES.has(id) ? 0 : combo, HIT_VOICE[id]);
    }
    try {
      if (kind === 'press') inst.press(b, now() - ph.start);
      else inst.release?.(b, now() - ph.start);
    } catch (err) {
      console.error(`${kind}() failed`, err);
    }
  }

  raf = requestAnimationFrame(frame);
  return {
    done,
    stop,
    press: (b) => input('press', b),
    release: (b) => input('release', b),
    refresh() {
      const ph = phases[p];
      const box = card.querySelector('.standings-box.in');
      if (ph?.type === 'result' && box) box.replaceChildren(standings(o.me, scores, o.rivals(), ph.round + 1, o.avatar));
    },
  };
}
