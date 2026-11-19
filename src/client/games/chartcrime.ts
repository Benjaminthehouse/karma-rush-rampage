import './chartcrime.css';
import { COLOR, clamp1000, h, pick, pulse, shuffled, type Btn, type GameFactory } from './common';

const TITLES = ['Users (trust us)', 'Growth, probably', 'Speed vs competitors', 'Vibes per second', 'Benchmarks we chose', 'Totally fair comparison'];
const UNITS = ['k', 'x', '%', 'ms', ''];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.floor(level * 0.75);
  const charts = Array.from({ length: 24 }, () => {
    // Three distinct numbers; closer together on later levels.
    const spread = Math.max(2, 14 - level * 2);
    const base = 12 + Math.floor(rng() * 70);
    const nums = shuffled(rng, [base, base + 1 + Math.floor(rng() * spread), base + spread + 2 + Math.floor(rng() * spread)]);
    const win = nums.indexOf(Math.max(...nums)) as Btn;
    // The lie: bar heights are shuffled so the tallest bar is usually not the biggest number.
    let heights = shuffled(rng, [0.34, 0.62, 0.95]);
    if (heights[win] === 0.95 && rng() < 0.8) heights = [heights[1], heights[2], heights[0]];
    return { nums, win, heights, title: pick(rng, TITLES), unit: pick(rng, UNITS) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-chartcrime');
  const title = h('div', 'title');
  const chart = h('div', 'chart');
  const bars = [0, 1, 2].map((i) => {
    const col = h('div', 'col');
    const num = h('b');
    const bar = h('i', `c-${COLOR[i]}`);
    col.append(num, bar);
    chart.append(col);
    return { col, num, bar };
  });
  const note = h('div', 'g-note');
  wrap.append(title, chart, note);
  root.append(wrap);

  function show() {
    const c = charts[idx % charts.length];
    title.textContent = c.title;
    bars.forEach((b, i) => {
      b.num.textContent = `${c.nums[i]}${c.unit}`;
      b.bar.style.height = `${c.heights[i] * 100}%`;
    });
    pulse(chart, 'pop-in');
    note.textContent = `${right} crime${right === 1 ? '' : 's'} solved`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const c = charts[idx % charts.length];
      if (b === c.win) {
        right++;
        // The word floats from the title, never over the numbers of the next chart.
        good(bars[b].col);
        fx.pop(title, 'BUSTED', 'gold');
        fx.burst(bars[b].col, 'gold', 10);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(bars[b].col);
        fx.pop(title, 'FOOLED', 'red');
        fx.burst(bars[b].col, 'red', 8);
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? charts[idx % charts.length].win : null),
  };
};
