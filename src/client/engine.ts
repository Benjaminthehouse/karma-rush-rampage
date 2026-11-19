// Runs one match: five rounds on a fixed timeline (intro → play → result).
// The timeline is driven by a clock supplied by the caller, so a solo run and a
// synced party match are the same code with a different start time.
import type { Rival } from '../shared/api';
import { GAME_META, MAX_ROUND_SCORE, mulberry32, timeline, type Phase, type Round } from '../shared/daily';
import { fmt } from './api';
import { GAMES } from './games';
import { COLOR, h, type Btn, type GameInst } from './games/common';
import { sfx } from './sfx';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export type Match = { done: Promise<number[]>; press(b: Btn): void; stop(): void; refresh(): void };

export function rating(score: number): string {
  if (score >= 950) return 'PERFECT!';
  if (score >= 700) return 'GREAT';
  if (score >= 400) return 'NOT BAD';
  if (score > 0) return 'OOF';
  return 'ZERO KARMA';
}

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
  rows.slice(0, 6).forEach((r) => {
    const li = h('li', r.you ? 'you' : '');
    const bar = h('i');
    bar.style.width = `${Math.max(2, (r.total / max) * 100)}%`;
    const name = h('span', 'who', r.you ? `${r.name} (you)` : r.name);
    if (r.bot) name.append(h('em', '', 'bot'));
    li.append(bar, name, h('span', 'pts', r.pending ? `${fmt(r.total)}…` : fmt(r.total)));
    list.append(li);
  });
  return list;
}

export function runMatch(o: {
  lineup: Round[];
  /** ms since the match started; negative while counting down. */
  clock: () => number;
  me: string;
  rivals: () => Rival[];
  setPads: (labels: [string, string, string]) => void;
  onRound?: (rounds: number[]) => void;
}): Match {
  const phases = timeline(o.lineup);
  const stage = $('stage');
  const card = $('card');
  const bar = $('timebar').firstElementChild as HTMLElement;
  const pips = $('pips');
  const scores: number[] = [];
  let p = -1;
  let inst: GameInst | null = null;
  let raf = 0;
  let stopped = false;
  let lastCount = 0;
  let finish!: (s: number[]) => void;
  const done = new Promise<number[]>((r) => (finish = r));

  function hud() {
    pips.replaceChildren(
      ...o.lineup.map((_, i) => {
        const cls = i < scores.length ? 'done' : i === scores.length ? 'now' : '';
        return h('i', cls);
      })
    );
    $('hud-score').textContent = fmt(scores.reduce((a, b) => a + b, 0));
  }

  function showCard(...kids: (HTMLElement | string)[]) {
    card.replaceChildren(...kids);
    card.hidden = false;
    card.classList.remove('pop-in');
    void card.offsetWidth;
    card.classList.add('pop-in');
  }

  function enter(ph: Phase) {
    const round = o.lineup[ph.round];
    const meta = GAME_META[round.id];
    if (ph.type === 'intro') {
      stage.replaceChildren();
      bar.style.width = '100%';
      $('hud-title').textContent = meta.title;
      const legend = h('div', 'legend');
      meta.labels.forEach((l, i) => legend.append(h('span', `c-${COLOR[i]}`, l)));
      showCard(
        h('div', 'eyebrow', `ROUND ${ph.round + 1} OF ${o.lineup.length}`),
        h('h2', '', meta.title),
        h('p', '', meta.how),
        legend
      );
      o.setPads(meta.labels);
      hud();
    } else if (ph.type === 'play') {
      card.hidden = true;
      stage.replaceChildren();
      stage.className = '';
      sfx.go();
      inst = GAMES[round.id]({
        root: stage,
        rng: mulberry32(round.seed),
        level: round.level,
        duration: meta.duration,
        good: () => sfx.good(),
        bad: () => sfx.bad(),
      });
    } else {
      const score = scores[ph.round] ?? 0;
      sfx.result(score);
      const res = h('div', 'round-score', `+${fmt(score)}`);
      const box = h('div', 'standings-box');
      box.append(standings(o.me, scores, o.rivals(), ph.round + 1));
      showCard(h('div', 'eyebrow', meta.title), res, h('div', 'rating', rating(score)), box);
      card.dataset.round = String(ph.round);
      hud();
    }
  }

  function leave(ph: Phase) {
    if (ph.type !== 'play') return;
    scores[ph.round] = inst ? inst.score() : 0;
    inst = null;
    stage.className = 'frozen';
    bar.style.width = '0%';
    o.onRound?.([...scores]);
  }

  function frame() {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const t = o.clock();
    if (t < 0) {
      const n = Math.ceil(-t / 1000);
      if (n !== lastCount) {
        lastCount = n;
        sfx.tick();
        showCard(h('div', 'eyebrow', 'GET READY'), h('div', 'count', String(n)));
        o.setPads(['', '', '']);
        hud();
      }
      return;
    }
    if (p < 0) enter(phases[(p = 0)]);
    while (p < phases.length && t >= phases[p].end) {
      leave(phases[p]);
      p++;
      if (p < phases.length) enter(phases[p]);
    }
    if (p >= phases.length) {
      stop();
      finish(scores);
      return;
    }
    const ph = phases[p];
    if (ph.type === 'play' && inst) {
      inst.tick(t - ph.start);
      bar.style.width = `${(1 - (t - ph.start) / (ph.end - ph.start)) * 100}%`;
    }
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    card.hidden = true;
  }

  /** Re-renders the standings on the result card when fresher rival scores arrive. */
  function refresh() {
    const ph = phases[p];
    const box = card.querySelector('.standings-box');
    if (ph?.type === 'result' && box) box.replaceChildren(standings(o.me, scores, o.rivals(), ph.round + 1));
  }

  raf = requestAnimationFrame(frame);
  return {
    done,
    stop,
    press(b: Btn) {
      const ph = phases[p];
      if (ph?.type === 'play' && inst) inst.press(b, o.clock() - ph.start);
    },
    refresh,
  };
}
