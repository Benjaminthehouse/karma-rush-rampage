import './tothemoon.css';
import { actor, COLOR, clamp1000, defineSprite, h, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A stubby rocket with a porthole; the nose and fins take the lane's colour.
defineSprite('tothemoon-rocket', `
....kk....
...kLAk...
..kLAAak..
..kwwwdk..
.kwwkkwdk.
.kwkcckdk.
.kwkcckdk.
.kwwkkwdk.
.kwwwwwdk.
.kwwwwwdk.
kAkwwwdkAk
kAkwwwdkAk
kAakkkkaAk
kkk.kk.kkk`);
// The exhaust, shown only while the button is held.
defineSprite('tothemoon-flame', `
kooook
koyyok
koyyok
.kyyk.
..kk..`);

const TICKERS = ['$KARMA', '$DOGGO', '$STONK', '$HODL', '$CATCOIN', '$UPVOTE', '$COPIUM', '$BANANA'];

type Phase = 'ready' | 'climb' | 'wait';

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // All three rockets are in play at once, each with its own moon. One at a time is easy
  // and slow; the points are in flying two or three together and letting each go in turn.
  // Tuned for thumbs, not bots: the moon is a window of about a third of a second at
  // first, a fifth of a second by the last round.
  const climbMs = 1300 - level * 70; // hold time from the pad to the top of the lane
  const half = 0.13 - level * 0.008; // half the height of the moonlight band
  const par = 9 + level; // one rocket at a time lands about five: half marks
  // Every lane's moons are dealt up front, so everyone gets the same round.
  const deals = [0, 1, 2].map(() => Array.from({ length: 16 }, () => 0.5 + rng() * 0.28));
  const tickers = [0, 1, 2].map((i) => TICKERS[(i * 3 + Math.floor(rng() * 8)) % 8]);

  let landed = 0;
  let misses = 0;

  // The scene: a launch pad at night. Three rockets stand on their pads, and a moon hangs
  // in each lane in a band of moonlight: that band is exactly where letting go counts.
  // The Ape watches from mission control, beside the tally.
  const wrap = h('div', 'g-tothemoon scene-night');
  const ape = actor('ape', { px: 0.15 });
  let mood: ActorMood = 'idle';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number) => {
    moodUntil = t + 500;
    if (m === mood) return;
    mood = m;
    ape.mood(m);
  };
  const lanes = [0, 1, 2].map((i) => {
    const lane = h('div', `lane c-${COLOR[i]}`);
    // The track is the lane minus half a rocket at each end, and the rocket hangs half below
    // its carrier's floor, so the rocket's centre is drawn exactly at its judged height.
    const track = h('div', 'track');
    const zone = h('div', 'zone');
    zone.append(sprite('moon', {}, 'target'));
    const carrier = h('div', 'carrier');
    const ride = h('div', 'ride');
    const rocket = h('div', 'rocket');
    rocket.append(sprite('tothemoon-rocket', { tone: COLOR[i], px: 0.26 }), sprite('tothemoon-flame', { px: 0.22 }, 'flame'));
    ride.append(rocket);
    carrier.append(ride);
    track.append(zone, carrier);
    const pad = h('div', 'pad');
    pad.append(h('div', 'ticker', tickers[i]));
    lane.append(track, pad);
    wrap.append(lane);
    return { zone, rocket, carrier, phase: 'wait' as Phase, idx: -1, t0: 0, nextAt: 0, lo: 0, hi: 0, shownY: -1 };
  });
  type Lane = (typeof lanes)[number];
  const control = h('div', 'control');
  const note = h('span', 'note');
  control.append(ape.el, note);
  wrap.append(control);
  root.append(wrap);

  const lift = (l: Lane, y: number) => {
    const v = Math.round(Math.min(1, y) * 1000) / 10;
    if (v === l.shownY) return;
    l.shownY = v;
    l.carrier.style.transform = `translateY(${-v}%)`;
  };
  const height = (l: Lane, t: number) => (t - l.t0) / climbMs;
  const tally = () => {
    note.textContent = `${landed} moon landing${landed === 1 ? '' : 's'}`;
  };

  /** Back on the pad, with the moon somewhere new. */
  function arm(l: Lane, b: number) {
    l.idx++;
    l.phase = 'ready';
    const mid = deals[b][l.idx % deals[b].length];
    l.lo = mid - half;
    l.hi = mid + half;
    l.zone.style.bottom = `${l.lo * 100}%`;
    l.zone.style.height = `${(l.hi - l.lo) * 100}%`;
    l.rocket.className = 'rocket';
    lift(l, 0);
  }

  function settle(l: Lane, t: number, ok: boolean, word: string) {
    if (ok) {
      landed++;
      l.rocket.className = 'rocket landed';
      look('cool', t);
      good(l.rocket, word);
      fx.burst(l.zone, 'gold', 14);
      fx.sound('coin');
      tally();
    } else {
      misses++;
      l.rocket.className = 'rocket crashed';
      look('dead', t);
      bad(l.rocket, word);
    }
    l.phase = 'wait';
    l.nextAt = t + 320;
  }

  lanes.forEach(arm);
  tally();

  return {
    press(b, t) {
      const l = lanes[b];
      if (l.phase !== 'ready') return;
      l.phase = 'climb';
      l.t0 = t;
      l.rocket.className = 'rocket burning';
      fx.sound('power');
    },
    release(b, t) {
      const l = lanes[b];
      if (l.phase !== 'climb') return;
      const y = height(l, t);
      if (y >= l.lo && y <= l.hi) settle(l, t, true, 'MOON!');
      else settle(l, t, false, y < l.lo ? 'PAPER HANDS' : 'OVERSHOT');
    },
    tick(t) {
      lanes.forEach((l, b) => {
        if (l.phase === 'wait' && t >= l.nextAt) arm(l, b);
        if (l.phase !== 'climb') return;
        const y = height(l, t);
        lift(l, y);
        if (y >= 1.06) settle(l, t, false, 'TOO GREEDY');
      });
      if (mood !== 'idle' && t >= moodUntil) {
        mood = 'idle';
        ape.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (landed - misses / 2)) / par),
    hint(t) {
      // Hold every rocket that is on its pad or still short of the middle of its moon.
      const hold: Btn[] = [];
      lanes.forEach((l, b) => {
        if (l.phase === 'ready' || (l.phase === 'climb' && height(l, t) < (l.lo + l.hi) / 2)) hold.push(b as Btn);
      });
      return { hold };
    },
  };
};
