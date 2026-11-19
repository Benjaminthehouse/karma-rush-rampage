import './worksonmine.css';
import { COLOR, clamp1000, h, pick, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

const ERRORS = ['segfault', 'off by one', 'NaN', 'undefined', 'exit 1', 'it’s DNS', 'timeout', '404', 'bad merge', 'missing ;'];
const EXCUSES = [
  'Then we ship your machine.',
  'Cannot reproduce. Closing.',
  'Have you tried rebooting?',
  'It worked five minutes ago.',
  'Must be a caching issue.',
  'It’s a feature now.',
  'Did you clear the cache?',
  'Works in the demo, though.',
];
const CHEERS = ['SHIP IT!', 'LGTM!', 'MERGED!', 'NO BUGS!'];
const PAIRS: Btn[][] = [
  [0, 1],
  [1, 2],
  [0, 2],
];
const TICK = '<svg class="tick" viewBox="0 0 24 24"><path d="M4 13l5.5 5.5L20 6"/></svg>';
const CROSS = '<svg class="cross" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19"/></svg>';
const SWAP_MS = [290, 265, 225, 208, 190]; // per level: later rounds add swaps and speed them up
const LEAD_MS = 1320; // tick on to question mark, the same at every level: faster swaps buy more swaps, not more picks
const OK_MS = 350; // celebration before the next laptop lights up
const OOPS_MS = 700; // a wrong pick also costs time

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const swaps = 3 + Math.floor(level / 2);
  const swapMs = SWAP_MS[level];
  const showMs = LEAD_MS - swaps * swapMs; // the tick stays up 450 ms at level 0, 370 at level 4
  const par = 3.5 + level / 16; // correct picks that earn 1000
  const excuses = shuffled(rng, EXCUSES);
  // More bouts than fit in a round. The same laptop works all round: each bout starts where the last one
  // ended, and it never ends a shuffle where it began, so no answer repeats and no button is a safe bet.
  let from = randBtn(rng);
  const bouts = Array.from({ length: 9 }, () => {
    const start = from;
    const end = pick(rng, ([0, 1, 2] as Btn[]).filter((slot) => slot !== start));
    from = end;
    let moves: Btn[][];
    // Deal shuffles until one carries the working laptop to this bout's answer.
    do {
      moves = [];
      while (moves.length < swaps) {
        const pair = pick(rng, PAIRS);
        if (pair !== moves[moves.length - 1]) moves.push(pair);
      }
    } while (moves.reduce((s, [a, b]) => (s === a ? b : s === b ? a : s), start) !== end);
    return { start, end, moves, errors: shuffled(rng, ERRORS).slice(0, 2) };
  });

  let n = 0; // bouts finished
  let phase: 'show' | 'shuffle' | 'ask' | 'after' = 'show';
  let shuffleAt = 0;
  let askAt = 0;
  let nextAt = 0;
  let step = 0; // swaps already started in this bout
  let earned = 0;
  let right = 0;
  let wrong = 0;

  const wrap = h('div', 'g-worksonmine');
  wrap.style.setProperty('--ms', `${Math.round(swapMs * 0.88)}ms`);
  const say = h('div', 'say');
  const banner = h('div', 'rule');
  banner.innerHTML = 'Watch the <b>green tick</b>!';
  say.append(banner);
  const desk = h('div', 'desk');
  const pads = [0, 1, 2].map((i) => {
    const pad = h('div', `pad c-${COLOR[i]}`);
    desk.append(pad);
    return pad;
  });
  const rigs = ([0, 1, 2] as Btn[]).map((slot) => {
    const el = h('div', 'rig');
    const laptop = h('div', 'laptop');
    const screen = h('div', 'screen');
    screen.innerHTML = `${TICK}${CROSS}<b>?</b>`;
    const msg = h('span');
    screen.append(msg);
    laptop.append(screen, h('div', 'base'));
    el.append(laptop);
    desk.append(el);
    return { el, laptop, msg, slot };
  });
  type Rig = (typeof rigs)[number];
  const builds = h('div', 'builds');
  // Four slots: nobody fits a fifth pick into a round.
  const pips = Array.from({ length: 4 }, () => {
    const pip = h('i');
    builds.append(pip);
    return pip;
  });
  const note = h('div', 'g-note', '0 shipped');
  wrap.append(say, desk, builds, note);
  root.append(wrap);

  const bout = () => bouts[n % bouts.length];
  const rigAt = (slot: Btn) => rigs.find((r) => r.slot === slot)!;
  const place = (r: Rig) => (r.el.style.left = `${r.slot * 35}%`);
  const face = (r: Rig, state: string, text = '') => {
    r.el.className = `rig ${state}`;
    r.laptop.className = 'laptop';
    r.msg.textContent = text;
  };

  function begin(t: number) {
    shuffleAt = t + showMs;
    askAt = shuffleAt + swaps * swapMs;
    step = 0;
    phase = 'show';
    let e = 0;
    rigs.forEach((r) => (r.slot === bout().start ? face(r, 'ok', 'WORKS') : face(r, 'err', bout().errors[e++])));
  }

  // The laptop heading right arcs round the back, the one heading left swings past the front, so both stay in view.
  function swap([a, b]: Btn[]) {
    const over = rigAt(a);
    const under = rigAt(b);
    over.slot = b;
    under.slot = a;
    rigs.forEach((r) => (r.laptop.className = 'laptop'));
    [over, under].forEach(place);
    pulse(over.laptop, 'over');
    pulse(under.laptop, 'under');
    fx.sound('whoosh');
  }

  function choose(b: Btn, t: number) {
    const mine = rigAt(b);
    const lucky = rigAt(bout().end);
    const ok = mine === lucky;
    phase = 'after';
    desk.className = 'desk';
    rigs.forEach((r) => face(r, 'off'));
    if (ok) {
      // Full marks for a pick within 250 ms of the question mark, three quarters for a slow one.
      earned += 0.75 + 0.25 * Math.max(0, Math.min(1, 1 - (t - askAt - 250) / 650));
      right++;
      const clean = right >= 3 && !wrong; // three for three, and a fourth keeps the gold
      face(mine, 'win', 'WORKS');
      banner.innerHTML = clean ? '<span class="stamp gold">CERTIFIED: WORKS EVERYWHERE</span>' : '<span class="stamp">WORKS ON MY MACHINE!</span>';
      good(mine.el, CHEERS[right % CHEERS.length]);
      fx.burst(mine.el, 'green', 18);
      fx.sound('coin');
      if (clean) {
        fx.flash('gold');
        fx.burst(desk, 'gold', 30);
      }
      nextAt = t + OK_MS;
    } else {
      face(mine, 'boom', bout().errors[0]);
      face(lucky, 'was', 'WORKS');
      banner.innerHTML = `<i>“${excuses[wrong % excuses.length]}”</i>`;
      wrong++;
      bad(mine.el, 'NOPE');
      fx.sound('boing');
      nextAt = t + OOPS_MS;
    }
    const pip = pips[n];
    if (pip) {
      pip.className = ok ? 'ok' : 'fail';
      pip.innerHTML = ok ? TICK : CROSS;
      pulse(pip, 'pop-in');
    }
    n++;
    note.textContent = `${right} shipped`;
  }

  rigs.forEach(place);
  begin(250); // the very first tick stays up a little longer

  return {
    press(b, t) {
      if (phase === 'ask') return choose(b, t);
      // Too early: the slot's pad rattles, nothing is picked.
      pulse(pads[b], 'shake');
      fx.sound('tick');
    },
    tick(t) {
      if (phase === 'after' && t >= nextAt) begin(nextAt);
      if (phase === 'show' && t >= shuffleAt) {
        phase = 'shuffle';
        rigs.forEach((r) => face(r, 'off'));
        banner.textContent = 'Don’t lose it…';
      }
      if (phase !== 'shuffle') return;
      while (step < swaps && t >= shuffleAt + step * swapMs) swap(bout().moves[step++]);
      if (t >= askAt) {
        phase = 'ask';
        desk.className = 'desk ask';
        rigs.forEach((r) => face(r, 'ask'));
        banner.innerHTML = '<b>Which one works?</b>';
        fx.sound('ding');
      }
    },
    score: () => clamp1000((1000 * (earned - 0.3 * wrong)) / par),
    hint: () => (phase === 'ask' ? bout().end : null),
  };
};
