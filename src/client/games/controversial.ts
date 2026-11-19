import './controversial.css';
import { h, pick, pulse, randInt, ratio, type GameFactory } from './common';

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
  // The crowd builds up to full speed, so the first shove can be read before it lands.
  // (At full speed the last round would be out of the zone 0.23 s after the bell.)
  const warm = 300 + level * 150;
  // The crowd shoves in bursts, and mostly piles on: away from the middle.
  const shoves: { until: number; roll: number }[] = [];
  for (let at = 0; at < duration + 1000; ) {
    at += randInt(rng, 450, 850);
    shoves.push({ until: at, roll: rng() });
  }
  let shove = 0;
  let dir = rng() < 0.5 ? -1 : 1;
  let touched = false; // any press during the current shove

  let pos = 0.5;
  let last = 0;
  let inZone = 0;
  let frozenUntil = 0;
  let freezeReadyAt = 0;
  let wasIn = true;
  let streak = 0;
  let lastBad = -1000;

  const wrap = h('div', 'g-controversial');
  const take = h('div', 'take', `“${pick(rng, TAKES)}”`);
  const bar = h('div', 'bar');
  const zone = h('i', 'zone');
  zone.style.left = `${(0.5 - half) * 100}%`;
  zone.style.width = `${half * 200}%`;
  const dagger = h('b', 'dagger');
  // Pop-ups float up from above the bar, so they never hide the dagger or the zone.
  const stamp = h('i', 'stamp');
  bar.append(zone, dagger, stamp);
  const ends = h('div', 'ends');
  // Lit while FREEZE is ready, dim while it recharges.
  const ice = h('span', 'ice', 'freeze');
  ends.append(h('span', 't-red', 'downvoted'), ice, h('span', 't-blue', 'upvoted'));
  const note = h('div', 'g-note');
  wrap.append(take, bar, ends, note);
  root.append(wrap);

  return {
    press(b, t) {
      touched = true;
      if (b === 1) {
        if (t < freezeReadyAt) {
          fx.sound('tick');
          pulse(ice, 'shake');
          return;
        }
        frozenUntil = t + 450;
        freezeReadyAt = t + 1400;
        fx.sound('zap');
        fx.pop(stamp, 'FROZEN', 'green');
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
        // Left alone the crowd only piles on, so a vote nobody is tending never wanders
        // back into the zone (an idle round used to score up to 850 on a lucky day).
        dir = touched && shoves[shove].roll >= 0.72 ? -away : away;
        touched = false;
      }
      if (t >= frozenUntil) pos = Math.max(0, Math.min(1, pos + dir * speed * Math.min(1, t / warm) * dt));
      const inside = Math.abs(pos - 0.5) <= half;
      if (inside) {
        inZone += dt;
        // A cheer for every 0.9 s banked, like the score: a wobble does not wipe it.
        streak += dt;
        if (streak >= 900) {
          streak = 0;
          good(stamp, '50/50');
        }
      } else if (wasIn && t - lastBad >= 650) {
        // One buzz per fall, not one per wobble across the edge.
        lastBad = t;
        bad(stamp, pos > 0.5 ? 'TOO POPULAR' : 'BURIED');
      }
      wasIn = inside;
      dagger.style.left = `${pos * 100}%`;
      bar.classList.toggle('out', !inside);
      bar.classList.toggle('frozen', t < frozenUntil);
      ice.classList.toggle('off', t < freezeReadyAt);
      note.textContent = `${Math.round(pos * 100)}% upvoted`;
    },
    score: () => ratio(inZone, duration * 0.88),
    hint() {
      const off = pos - 0.5;
      return Math.abs(off) < nudge * 0.55 ? null : off > 0 ? 0 : 2;
    },
  };
};
