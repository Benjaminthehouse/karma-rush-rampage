import './worksonmine.css';
import { COLOR, clamp1000, h, pick, pulse, shuffled, type Btn, type GameFactory } from './common';

const ERRORS = ['segfault', 'npm ERR!', 'NaN', 'undefined', 'exit 1', 'it’s DNS', 'timeout', '404', 'bad merge', 'missing ;'];
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
const SHOW_MS = 500; // the working laptop shows its tick
const OK_MS = 400; // celebration before the next shuffle
const OOPS_MS = 700; // a wrong pick also costs time

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const swaps = 3 + Math.floor(level / 2);
  const swapMs = 290 - 30 * level;
  const par = 3.5 + level / 8; // correct picks that earn 1000
  // More bouts than fit in a round. The answer visits every slot before it repeats, so no button is a safe bet.
  const ends: Btn[] = [];
  while (ends.length < 9) {
    const block = shuffled(rng, [0, 1, 2] as Btn[]);
    if (block[0] === ends[ends.length - 1]) block.reverse();
    ends.push(...block);
  }
  const excuses = shuffled(rng, EXCUSES);
  const bouts = ends.map((end) => {
    const moves: Btn[][] = [];
    while (moves.length < swaps) {
      const pair = pick(rng, PAIRS);
      if (pair !== moves[moves.length - 1]) moves.push(pair);
    }
    // Run the shuffle backwards to find where the working laptop has to start.
    const start = moves.reduceRight((s, [a, b]) => (s === a ? b : s === b ? a : s), end);
    return { start, end, moves, errors: [pick(rng, ERRORS), pick(rng, ERRORS)] };
  });

  let n = 0; // bouts finished
  let phase: 'show' | 'shuffle' | 'ask' | 'after' = 'show';
  let t0 = 0; // when the current bout began
  let askAt = 0;
  let nextAt = 0;
  let step = 0; // swaps already started in this bout
  let earned = 0;
  let right = 0;
  let wrong = 0;

  const wrap = h('div', 'g-worksonmine');
  wrap.style.setProperty('--ms', `${Math.round(swapMs * 0.88)}ms`);
  const banner = h('div', 'rule');
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
  const pips = Array.from({ length: 5 }, () => {
    const pip = h('i');
    builds.append(pip);
    return pip;
  });
  const note = h('div', 'g-note');
  wrap.append(banner, desk, builds, note);
  root.append(wrap);

  const bout = () => bouts[n % bouts.length];
  const rigAt = (slot: Btn) => rigs.find((r) => r.slot === slot)!;
  const place = (r: Rig) => (r.el.style.left = `${r.slot * 6}em`);
  const face = (r: Rig, state: string, text = '') => {
    r.el.className = `rig ${state}`;
    r.laptop.className = 'laptop';
    r.msg.textContent = text;
  };

  function begin(t: number) {
    t0 = t;
    askAt = t + SHOW_MS + swaps * swapMs;
    step = 0;
    phase = 'show';
    let e = 0;
    rigs.forEach((r) => (r.slot === bout().start ? face(r, 'ok', 'WORKS') : face(r, 'err', bout().errors[e++])));
    banner.innerHTML = 'Watch the <b>green tick</b>!';
    note.textContent = `${right} shipped`;
  }

  // The laptop heading right arcs over the top, the one heading left ducks under.
  function swap([a, b]: Btn[]) {
    const over = rigAt(a);
    const under = rigAt(b);
    over.slot = b;
    under.slot = a;
    [over, under].forEach((r, i) => {
      place(r);
      r.laptop.className = 'laptop';
      pulse(r.laptop, i ? 'under' : 'over');
    });
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
      face(mine, 'win', 'WORKS');
      const clean = right === 3 && !wrong;
      banner.innerHTML = `<span class="stamp${clean ? ' gold' : ''}">${clean ? 'CERTIFIED: WORKS EVERYWHERE' : 'WORKS ON MY MACHINE!'}</span>`;
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
  begin(0);

  return {
    press(b, t) {
      if (phase === 'ask') choose(b, t);
      else pulse(pads[b], 'shake');
    },
    tick(t) {
      if (phase === 'after' && t >= nextAt) begin(nextAt);
      if (phase === 'show' && t >= t0 + SHOW_MS) {
        phase = 'shuffle';
        rigs.forEach((r) => face(r, 'off'));
        banner.textContent = 'Don’t lose it…';
      }
      if (phase !== 'shuffle') return;
      while (step < swaps && t >= t0 + SHOW_MS + step * swapMs) swap(bout().moves[step++]);
      if (t >= askAt) {
        phase = 'ask';
        desk.className = 'desk ask';
        rigs.forEach((r) => face(r, 'ask'));
        banner.innerHTML = '<b>Which one works?</b>';
        fx.sound('ding');
      }
    },
    score: () => clamp1000((1000 * (earned - 0.4 * wrong)) / par),
    hint: () => (phase === 'ask' ? bout().end : null),
  };
};
