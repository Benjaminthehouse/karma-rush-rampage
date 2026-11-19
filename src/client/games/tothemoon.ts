import './tothemoon.css';
import { COLOR, clamp1000, h, randBtn, type Btn, type GameFactory } from './common';

const TICKERS = ['$KARMA', '$DOGE-ISH', '$STONK', '$HODL', '$CATCOIN', '$UPVOTE', '$COPIUM', '$BANANA'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const climbMs = 1050 - level * 95; // hold time from the pad to the top of the lane
  const par = 5 + Math.floor(level / 2);
  const launches = Array.from({ length: 24 }, (_, i) => {
    const mid = 0.52 + rng() * 0.3;
    const half = 0.11 - level * 0.008;
    return { col: randBtn(rng), lo: mid - half, hi: mid + half, ticker: TICKERS[(i + Math.floor(rng() * 8)) % 8] };
  });
  for (let i = 1; i < launches.length; i++) {
    while (launches[i].col === launches[i - 1].col) launches[i].col = ((launches[i].col + 1) % 3) as Btn;
  }

  let idx = -1;
  let phase: 'ready' | 'climb' | 'wait' = 'wait';
  let t0 = 0;
  let nextAt = 0;
  let landed = 0;
  let misses = 0;

  const wrap = h('div', 'g-tothemoon');
  const lanes = [0, 1, 2].map((i) => {
    const lane = h('div', `lane c-${COLOR[i]}`);
    const zone = h('div', 'zone', 'MOON');
    const rocket = h('div', 'rocket');
    rocket.append(h('i'));
    const tag = h('div', 'ticker');
    lane.append(zone, rocket, tag);
    wrap.append(lane);
    return { lane, zone, rocket, tag };
  });
  const note = h('div', 'g-note');
  wrap.append(note);
  root.append(wrap);

  const cur = () => launches[idx];
  const height = (t: number) => (t - t0) / climbMs;

  function arm() {
    idx++;
    phase = 'ready';
    const c = cur();
    lanes.forEach((l, i) => l.lane.classList.toggle('live', i === c.col));
    const l = lanes[c.col];
    l.zone.style.bottom = `${c.lo * 100}%`;
    l.zone.style.height = `${(c.hi - c.lo) * 100}%`;
    l.rocket.style.bottom = '0%';
    l.rocket.className = 'rocket';
    l.tag.textContent = c.ticker;
    note.textContent = `${landed} moon landing${landed === 1 ? '' : 's'}`;
  }

  function settle(t: number, ok: boolean, word: string) {
    const l = lanes[cur().col];
    if (ok) {
      landed++;
      l.rocket.className = 'rocket landed';
      good(l.rocket, word);
      fx.burst(l.zone, 'gold', 14);
      fx.sound('coin');
    } else {
      misses++;
      l.rocket.className = 'rocket crashed';
      bad(l.rocket, word);
    }
    phase = 'wait';
    nextAt = t + 320;
  }

  arm();

  return {
    press(b, t) {
      if (phase !== 'ready') return;
      if (b !== cur().col) {
        misses++;
        bad(lanes[b].lane, 'WRONG ROCKET');
        return;
      }
      phase = 'climb';
      t0 = t;
      lanes[b].rocket.className = 'rocket burning';
      fx.sound('power');
    },
    release(b, t) {
      if (phase !== 'climb' || b !== cur().col) return;
      const y = height(t);
      const c = cur();
      if (y >= c.lo && y <= c.hi) settle(t, true, 'MOON!');
      else settle(t, false, y < c.lo ? 'PAPER HANDS' : 'OVERSHOT');
    },
    tick(t) {
      if (phase === 'wait' && t >= nextAt) arm();
      if (phase !== 'climb') return;
      const y = height(t);
      lanes[cur().col].rocket.style.bottom = `${Math.min(1, y) * 86}%`;
      if (y >= 1.06) settle(t, false, 'TOO GREEDY');
    },
    score: () => clamp1000((1000 * (landed - misses / 2)) / par),
    hint(t) {
      if (phase === 'ready') return { hold: [cur().col] };
      if (phase !== 'climb') return null;
      const c = cur();
      return height(t) < (c.lo + c.hi) / 2 ? { hold: [c.col] } : { hold: [] };
    },
  };
};
