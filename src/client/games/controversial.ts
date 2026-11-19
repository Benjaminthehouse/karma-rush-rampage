import './controversial.css';
import { h, pick, randInt, ratio, type GameFactory } from './common';

const TAKES = [
  'Pineapple belongs on pizza',
  'Cereal is a soup',
  'A hot dog is a sandwich',
  'Socks with sandals are fine',
  'The book was worse',
  'Mornings are the best part of the day',
  'Water is not wet',
  'GIF has a hard G',
];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const half = 0.1 - level * 0.0075; // half-width of the gold zone
  const nudge = 0.07;
  const speed = 0.00016 + level * 0.000035; // how hard the crowd shoves, per ms
  // The crowd shoves in bursts, and mostly piles on: away from the middle.
  const shoves: { until: number; roll: number }[] = [];
  for (let at = 0; at < duration + 1000; ) {
    at += randInt(rng, 450, 850);
    shoves.push({ until: at, roll: rng() });
  }
  let shove = 0;
  let dir = rng() < 0.5 ? -1 : 1;

  let pos = 0.5;
  let last = 0;
  let inZone = 0;
  let frozenUntil = 0;
  let freezeReadyAt = 0;
  let wasIn = true;
  let streak = 0;

  const wrap = h('div', 'g-controversial');
  const take = h('div', 'take', `“${pick(rng, TAKES)}”`);
  const bar = h('div', 'bar');
  const zone = h('i', 'zone');
  zone.style.left = `${(0.5 - half) * 100}%`;
  zone.style.width = `${half * 200}%`;
  const dagger = h('b', 'dagger');
  bar.append(zone, dagger);
  const ends = h('div', 'ends');
  ends.append(h('span', 't-red', 'downvoted'), h('span', 't-blue', 'upvoted'));
  const note = h('div', 'g-note');
  wrap.append(take, bar, ends, note);
  root.append(wrap);

  return {
    press(b, t) {
      if (b === 1) {
        if (t < freezeReadyAt) return;
        frozenUntil = t + 450;
        freezeReadyAt = t + 1400;
        fx.sound('zap');
        fx.pop(dagger, 'FROZEN', 'green');
        return;
      }
      pos = Math.max(0, Math.min(1, pos + (b === 2 ? nudge : -nudge)));
      fx.sound('pop');
    },
    tick(t) {
      const dt = Math.min(60, Math.max(0, t - last));
      last = t;
      while (shoves[shove + 1] && t >= shoves[shove].until) {
        shove++;
        const away = pos >= 0.5 ? 1 : -1;
        dir = shoves[shove].roll < 0.72 ? away : -away;
      }
      if (t >= frozenUntil) pos = Math.max(0, Math.min(1, pos + dir * speed * dt));
      const inside = Math.abs(pos - 0.5) <= half;
      if (inside) {
        inZone += dt;
        streak += dt;
        if (streak >= 900) {
          streak = 0;
          good(dagger, '50/50');
        }
      } else {
        streak = 0;
        if (wasIn) bad(dagger, pos > 0.5 ? 'TOO POPULAR' : 'BURIED');
      }
      wasIn = inside;
      dagger.style.left = `${pos * 100}%`;
      bar.classList.toggle('out', !inside);
      note.textContent = `${Math.round(pos * 100)}% upvoted`;
    },
    score: () => ratio(inZone, duration * 0.88),
    hint() {
      const off = pos - 0.5;
      return Math.abs(off) < nudge * 0.55 ? null : off > 0 ? 0 : 2;
    },
  };
};
