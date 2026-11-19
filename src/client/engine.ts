// Runs one match: five rounds on a fixed timeline (intro → play → result).
// The timeline is driven by a clock supplied by the caller, so a solo run and a
// synced party match are the same code with a different start time. Everything
// timed inside a phase (announcer words, score count-up) is a cue checked against
// that clock, never a timer, so nothing can fire after the phase is over.
import type { Rival } from '../shared/api';
import { GAME_META, MAX_ROUND_SCORE, TIMING, mulberry32, timeline, type Phase, type Round } from '../shared/daily';
import { fmt } from './api';
import { createBot } from './bot';
import { createFx } from './fx';
import { COLOR, clamp1000, h, type Btn, type FxColor, type GameInst } from './games/common';
import { GAMES } from './games/registry.gen';
import { music, sfx } from './sfx';
import { voice } from './voice';

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
export function standings(me: string, mine: number[], rivals: Rival[], through: number): HTMLElement {
  const sum = (a: number[]) => a.slice(0, through).reduce((x, y) => x + y, 0);
  const rows = [
    { name: me, total: sum(mine), you: true, bot: false, pending: false },
    ...rivals.map((r) => ({
      name: r.name,
      total: sum(r.rounds),
      you: false,
      bot: !!r.bot,
      pending: r.rounds.length < through,
    })),
  ].sort((a, b) => b.total - a.total);
  const list = h('ol', 'standings');
  const max = Math.max(1, through * MAX_ROUND_SCORE);
  rows.slice(0, 6).forEach((r, i) => {
    const li = h('li', r.you ? 'you' : '');
    li.style.setProperty('--i', String(i));
    const bar = h('i');
    bar.style.width = `${Math.max(2, (r.total / max) * 100)}%`;
    const name = h('span', 'who', r.you ? `${r.name} (you)` : r.name);
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
  rivals: () => Rival[];
  setPads: (labels: [string, string, string]) => void;
  /** Light a pad for a beat (the announcer's words chase across the pads). */
  pulsePad?: (b: Btn) => void;
  /** Demo mode: a bot plays by following each game's hint(). Practice only. */
  autoplay?: { press: (b: Btn) => void; release: (b: Btn) => void };
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
  let inst: GameInst | null = null;
  let cues: Cue[] = [];
  let combo = 0;
  let raf = 0;
  let stopped = false;
  let lastCount = 0;
  let rushing = false;
  let shownScore = -1;
  const scoreEl = $('hud-score');
  let bot: ReturnType<typeof createBot> | null = null;
  let finish!: (s: number[]) => void;
  const done = new Promise<number[]>((r) => (finish = r));

  const total = () => scores.reduce((a, b) => a + b, 0);

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
    bar.style.width = '100%';
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
    showCard('intro', h('div', 'eyebrow', `ROUND ${ph.round + 1} OF ${o.lineup.length} · ${meta.title}`), shout, how, legend);

    const lead = 450;
    const cadence = Math.max(220, Math.min(420, (TIMING.intro - lead - 1200) / words.length));
    cues.push({
      at: 150,
      run: () => {
        sfx.whoosh();
        voice.say(meta.say ?? meta.shout);
      },
    });
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
    sfx.go();
    fx.flash('white');
    music.start(round.seed, round.level);
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
          sfx.good(combo);
          fx.burst(at ?? null, 'gold', 6);
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
          fx.lights('red');
          if (text) fx.pop(at ?? null, text, 'red');
        },
        fx: {
          burst: fx.burst,
          pop: fx.pop,
          poof: fx.poof,
          flash: fx.flash,
          shake: fx.shake,
          sound: (name) => sfx.named(name),
        },
      });
    } catch (err) {
      // One broken mini-game must never take the whole run down.
      console.error(`mini-game ${round.id} failed to start`, err);
      inst = null;
    }
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
    bar.style.width = '0%';
    bar.parentElement!.classList.remove('rush');
    o.onRound?.([...scores]);
  }

  // ---- phase: result. Score counts up, the verdict stamps in, then standings.
  function result(ph: Phase, round: Round) {
    const meta = GAME_META[round.id];
    const score = scores[ph.round] ?? 0;
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
        box.replaceChildren(standings(o.me, scores, o.rivals(), ph.round + 1));
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
    const t = o.clock();
    if (t < 0) {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount) {
        lastCount = n;
        sfx.count(n);
        showCard('count', h('div', 'eyebrow', 'GET READY'), h('div', 'count', String(n)));
        o.setPads(['', '', '']);
        hud();
      }
      return;
    }
    if (p < 0) enter(phases[(p = 0)]);
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
      bar.style.width = `${(left / (ph.end - ph.start)) * 100}%`;
      if (!rushing && left < 2000) {
        rushing = true;
        music.rush(true);
        bar.parentElement!.classList.add('rush');
      }
      try {
        inst?.tick(local);
        if (inst && bot && o.autoplay) bot(inst, local, o.autoplay.press, o.autoplay.release);
        // The score in the corner climbs live, so the round total is never a surprise.
        if (inst) {
          const live = total() + clamp1000(inst.score());
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

  function input(kind: 'press' | 'release', b: Btn) {
    down[b] = kind === 'press';
    const ph = phases[p];
    if (ph?.type !== 'play' || !inst) return;
    try {
      if (kind === 'press') inst.press(b, o.clock() - ph.start);
      else inst.release?.(b, o.clock() - ph.start);
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
      if (ph?.type === 'result' && box) box.replaceChildren(standings(o.me, scores, o.rivals(), ph.round + 1));
    },
  };
}
