import './ninetynine.css';
import { COLOR, clamp1000, h, pick, shuffled, type Btn, type GameFactory } from './common';

const STEPS = ['Installing', 'Building', 'Deploying'];
const THINGS = ['left-pad', 'node_modules', 'the vibes', 'prod', 'a fix', 'v2-final', 'dark mode', 'the hotfix', 'everything'];
const OVER = 1.05; // a bar this far past 100 crashes on its own; any stop before that still counts

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + Math.floor(level * 0.75);
  // The gold zone drawn on every track (7% wide in the CSS): stop inside it, or on 100, for full marks.
  // It stays the same size at every level so the picture never lies; faster bars make later rounds harder.
  const near = 0.93;
  const sets = Array.from({ length: 14 }, () => {
    // Finish times are spread out so two bars never need stopping in the same instant.
    const gap = () => 330 - level * 18 + rng() * 240;
    const first = 820 - level * 60 + rng() * 300;
    const second = first + gap();
    return shuffled(rng, [first, second, second + gap()]);
  });
  let set = 0;
  let startAt = 250;
  const stopped: (number | null)[] = [null, null, null];
  let points = 0;
  let fails = 0;

  const wrap = h('div', 'g-ninetynine');
  const bars = [0, 1, 2].map((i) => {
    const rowEl = h('div', `row c-${COLOR[i]}`);
    const label = h('span', 'step', `${STEPS[i]} ${pick(rng, THINGS)}…`);
    const track = h('div', 'track');
    const fill = h('i');
    const goal = h('b');
    track.append(fill, goal);
    const pct = h('span', 'pct', '0%');
    rowEl.append(label, track, pct);
    wrap.append(rowEl);
    return { rowEl, fill, pct };
  });
  const note = h('div', 'g-note');
  wrap.append(note);
  root.append(wrap);

  const value = (i: number, t: number) => Math.max(0, (t - startAt) / sets[set % sets.length][i]);

  function settle(i: Btn, v: number) {
    stopped[i] = v;
    const b = bars[i];
    b.rowEl.classList.add('stopped');
    b.fill.style.width = `${Math.min(100, v * 100)}%`; // freeze the bar exactly where it was stopped
    if (v >= OVER) {
      fails++;
      b.rowEl.classList.add('crashed');
      b.pct.textContent = 'CRASH';
      bad(b.rowEl, 'WENT OVER');
    } else if (v >= near) {
      points++;
      b.pct.textContent = `${Math.min(100, Math.round(v * 100))}%`;
      good(b.rowEl, v >= 0.995 ? 'EXACTLY 100' : 'SHIPPED');
    } else {
      fails += 0.5;
      b.pct.textContent = `${Math.round(v * 100)}%`;
      bad(b.rowEl, 'TOO EARLY');
    }
  }

  let resting = false;
  function finishSet(t: number) {
    if (stopped.includes(null)) return;
    if (stopped.every((v) => v !== null && v >= near && v < OVER)) {
      points++;
      fx.pop(null, 'CLEAN RELEASE!', 'gold');
      fx.burst(null, 'gold', 20);
      fx.sound('coin');
    }
    set++;
    startAt = t + 380;
    resting = true;
  }

  return {
    press(b, t) {
      if (resting || t < startAt || stopped[b] !== null) return;
      settle(b, value(b, t));
      finishSet(t);
    },
    tick(t) {
      note.textContent = `${Math.floor(points)} shipped`;
      if (resting) {
        if (t < startAt) return;
        // The next set starts: wipe the board.
        resting = false;
        stopped.forEach((_, i) => (stopped[i] = null));
        bars.forEach((b) => (b.rowEl.className = b.rowEl.className.replace(/ stopped| crashed/g, '')));
      }
      bars.forEach((b, i) => {
        if (stopped[i] !== null) return;
        const v = t < startAt ? 0 : value(i, t);
        if (v >= OVER) return settle(i as Btn, v);
        b.fill.style.width = `${Math.min(100, v * 100)}%`;
        b.pct.textContent = `${Math.min(99, Math.floor(v * 100))}%`;
      });
      finishSet(t);
    },
    score: () => clamp1000((1000 * (points - fails)) / par),
    hint(t) {
      if (resting || t < startAt) return null;
      for (const i of [0, 1, 2] as Btn[]) if (stopped[i] === null && value(i, t) >= 0.965) return i;
      return null;
    },
  };
};
