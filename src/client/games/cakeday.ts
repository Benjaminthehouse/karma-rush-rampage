import './cakeday.css';
import { COLOR, clamp1000, h, randBtn, type Btn, type GameFactory } from './common';

const FALL = 1100; // ms a flame takes to reach the cake
const WINDOW = 120; // ms either side of the beat that still counts

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // Same tempo as the round's music, so the flames land on the beat.
  const beat = 60000 / (128 + level * 7);
  const notes: { at: number; lane: Btn; el: HTMLElement; state: 'fall' | 'hit' | 'miss' }[] = [];

  const wrap = h('div', 'g-cakeday');
  const lanes = [0, 1, 2].map((i) => {
    const lane = h('div', `lane c-${COLOR[i]}`);
    const candle = h('div', 'candle');
    lane.append(candle);
    wrap.append(lane);
    return { lane, candle };
  });
  const cake = h('div', 'cake', 'HAPPY CAKE DAY');
  wrap.append(cake);
  root.append(wrap);

  let prev = -1;
  for (let k = 0, at = FALL + beat; at < duration - 200; k++, at += beat / 2) {
    // Early rounds play quarter notes; later rounds fill in the off-beats.
    const off = k % 2 === 1;
    if (off && rng() > level * 0.2) continue;
    let lane = randBtn(rng);
    if (off) while (lane === prev) lane = randBtn(rng);
    prev = lane;
    const el = h('i', 'flame');
    el.style.display = 'none';
    lanes[lane].lane.append(el);
    notes.push({ at, lane, el, state: 'fall' });
  }
  let hits = 0;
  let stray = 0;

  return {
    press(b, t) {
      const n = notes.find((x) => x.state === 'fall' && x.lane === b && Math.abs(t - x.at) <= WINDOW);
      if (!n) {
        stray++;
        bad(lanes[b].candle, 'OFF BEAT');
        return;
      }
      n.state = 'hit';
      n.el.style.display = 'none';
      hits++;
      lanes[b].candle.classList.add('lit');
      good(lanes[b].candle, Math.abs(t - n.at) < 45 ? 'PERFECT' : undefined);
      if (hits === notes.length) fx.burst(cake, 'gold', 26);
    },
    tick(t) {
      for (const n of notes) {
        if (n.state !== 'fall') continue;
        const p = (t - (n.at - FALL)) / FALL;
        if (p < 0) continue;
        if (t > n.at + WINDOW) {
          n.state = 'miss';
          n.el.style.display = 'none';
          lanes[n.lane].candle.classList.remove('lit');
          continue;
        }
        n.el.style.display = '';
        n.el.style.top = `${Math.min(1, p) * 74}%`;
      }
    },
    score: () => clamp1000((1000 * (hits - stray / 2)) / notes.length),
    hint(t) {
      const n = notes.find((x) => x.state === 'fall' && t >= x.at - 20 && t <= x.at + WINDOW);
      return n ? n.lane : null;
    },
  };
};
