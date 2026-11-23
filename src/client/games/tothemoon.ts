import './tothemoon.css';
import { actor, clamp1000, defineSprite, h, pulse, sprite, type ActorMood, type Btn, type GameFactory } from './common';

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

// One rocket, flown by hand. Red and blue are the thrusters: every tap is a kick upward,
// and gravity never lets go, so stopping means falling. Green lands, but only counts
// while the rocket is on the moon. Come in fast and the moment is short; hover and it is
// easy but slow. Each landing moves the moon.
export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const GRAVITY = 1.1; // lane heights per second, per second
  const KICK = 0.275; // speed one thrust adds: four taps a second hovers, eight climbs hard
  const DRAG = 1.5; // per second: caps the speed at about 0.7 lanes a second either way
  const half = 0.11 - level * 0.007; // half the height of the moonlight band
  const par = 4 + Math.floor(level / 2); // a clean flight and landing takes a little over a second
  // The moons are dealt up front. Each is well away from the last, sometimes above it and
  // sometimes below, so every landing is a new flight.
  const moons: number[] = [0.5 + rng() * 0.25];
  while (moons.length < 24) {
    const m = 0.28 + rng() * 0.57;
    if (Math.abs(m - moons[moons.length - 1]) >= 0.25) moons.push(m);
  }
  const ticker = TICKERS[Math.floor(rng() * TICKERS.length)];

  let idx = 0;
  let y = 0; // the rocket's height: 0 on the pad, 1 at the top of the lane
  let v = 0;
  let last = 0;
  let lastThrust = -1;
  let flameUntil = 0;
  let restUntil = 0; // sitting on the moon after a landing
  let lockUntil = 0; // LAND is jammed for a moment after a miss
  let landed = 0;
  let misses = 0;

  // The scene: a launch pad at night. The moon hangs in a band of moonlight right across
  // the sky: that band is exactly where landing counts. The Ape watches from mission
  // control, beside the tally.
  const wrap = h('div', 'g-tothemoon scene-night');
  const sky = h('div', 'sky');
  // The track is the sky minus half a rocket at each end, and the rocket hangs half below
  // its carrier's floor, so the rocket's centre is drawn exactly at its judged height.
  const track = h('div', 'track');
  const zone = h('div', 'zone');
  zone.append(sprite('moon', {}, 'target'));
  const carrier = h('div', 'carrier');
  const ride = h('div', 'ride');
  const rocket = h('div', 'rocket');
  rocket.append(sprite('tothemoon-rocket', { tone: 'gold', px: 0.34 }), sprite('tothemoon-flame', { px: 0.3 }, 'flame'));
  ride.append(rocket);
  carrier.append(ride);
  track.append(zone, carrier);
  const pad = h('div', 'pad');
  pad.append(h('div', 'ticker', ticker));
  sky.append(track, pad);
  const control = h('div', 'control');
  const ape = actor('ape', { px: 0.15 });
  const note = h('span', 'note');
  control.append(ape.el, note);
  wrap.append(sky, control);
  root.append(wrap);

  let mood: ActorMood = 'idle';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number) => {
    moodUntil = t + 500;
    if (m === mood) return;
    mood = m;
    ape.mood(m);
  };
  const lo = () => moons[idx % moons.length] - half;
  const hi = () => moons[idx % moons.length] + half;
  function place() {
    zone.style.bottom = `${lo() * 100}%`;
    zone.style.height = `${half * 200}%`;
    pulse(zone, 'pop-in');
    note.textContent = `${landed} moon landing${landed === 1 ? '' : 's'}`;
  }
  place();

  let shownY = '';
  let burning = false;

  return {
    press(b, t) {
      if (b === 1) {
        if (t < lockUntil || t < restUntil) return;
        if (y >= lo() && y <= hi()) {
          landed++;
          v = 0;
          restUntil = t + 400;
          look('cool', t);
          good(rocket, 'MOON!');
          fx.burst(zone, 'gold', 16);
          fx.sound('coin');
          pulse(rocket, 'landed');
        } else {
          misses++;
          lockUntil = t + 300;
          look('dead', t);
          pulse(rocket, 'wobble');
          bad(rocket, y < lo() ? 'TOO LOW' : 'TOO HIGH');
        }
        return;
      }
      if (t < restUntil) return;
      // Alternating thumbs is a full kick; the same thruster twice in a row is weaker, but
      // one thumb mashing one button can still (just) get off the pad.
      v += b === lastThrust ? KICK * 0.7 : KICK;
      lastThrust = b;
      flameUntil = t + 120;
    },
    tick(t) {
      const dt = Math.min(50, Math.max(0, t - last)) / 1000;
      last = t;
      if (restUntil && t >= restUntil) {
        // Lift-off again: the moon has moved.
        restUntil = 0;
        idx++;
        place();
      }
      if (!restUntil) {
        v -= GRAVITY * dt;
        v *= Math.exp(-DRAG * dt);
        y += v * dt;
        if (y <= 0) {
          y = 0;
          v = Math.max(0, v);
        } else if (y >= 1) {
          y = 1;
          v = Math.min(0, v);
        }
      }
      const ny = (y * 100).toFixed(1);
      if (ny !== shownY) {
        shownY = ny;
        carrier.style.transform = `translateY(${-ny}%)`;
      }
      const fire = t < flameUntil;
      if (fire !== burning) {
        burning = fire;
        rocket.classList.toggle('burning', fire);
      }
      if (mood !== 'idle' && t >= moodUntil) {
        mood = 'idle';
        ape.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (landed - misses / 2)) / par),
    hint(t) {
      if (t < restUntil) return null;
      const mid = moons[idx % moons.length];
      // On the moon: land. Otherwise thrust whenever the rocket is heading below it.
      if (t >= lockUntil && Math.abs(y - mid) <= half * 0.7) return 1;
      return y + v * 0.3 < mid ? ((lastThrust === 0 ? 2 : 0) as Btn) : null;
    },
  };
};
