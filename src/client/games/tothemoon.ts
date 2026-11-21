import './tothemoon.css';
import { actor, COLOR, clamp1000, defineSprite, h, randBtn, sprite, type ActorMood, type Btn, type GameFactory } from './common';

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

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Tuned for thumbs, not bots: the rocket is slow enough to follow, and the moon is a
  // window of about a third of a second at first, a fifth of a second by the last round.
  const climbMs = 1400 - level * 80; // hold time from the pad to the top of the lane
  const par = 4 + Math.floor(level / 3); // a person fits five or six launches in a round
  const launches = Array.from({ length: 24 }, (_, i) => {
    const mid = 0.5 + rng() * 0.28;
    const half = 0.13 - level * 0.008;
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

  // The scene: a launch pad at night. Three rockets stand on their pads. The moon hangs
  // in the lit rocket's lane, in a band of moonlight: that band is exactly where letting
  // go counts. The Ape watches from mission control, beside the tally.
  const wrap = h('div', 'g-tothemoon scene-night');
  const ape = actor('ape', { px: 0.15 });
  let mood: ActorMood = 'idle';
  const look = (m: ActorMood) => {
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
    const tag = h('div', 'ticker');
    track.append(zone, carrier);
    const pad = h('div', 'pad');
    pad.append(tag);
    lane.append(track, pad);
    wrap.append(lane);
    return { lane, zone, rocket, carrier, tag };
  });
  const control = h('div', 'control');
  const note = h('span', 'note');
  control.append(ape.el, note);
  wrap.append(control);
  root.append(wrap);
  let shownY = -1;
  const lift = (l: (typeof lanes)[number], y: number) => {
    const v = Math.round(Math.min(1, y) * 1000) / 10;
    if (v === shownY) return;
    shownY = v;
    l.carrier.style.transform = `translateY(${-v}%)`;
  };

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
    // Every rocket is back on its pad for the next launch.
    shownY = -1;
    lanes.forEach((other) => {
      other.carrier.style.transform = '';
      other.rocket.className = 'rocket';
    });
    lift(l, 0);
    look('idle');
    l.tag.textContent = c.ticker;
    note.textContent = `${landed} moon landing${landed === 1 ? '' : 's'}`;
  }

  function settle(t: number, ok: boolean, word: string) {
    const l = lanes[cur().col];
    if (ok) {
      landed++;
      l.rocket.className = 'rocket landed';
      look('cool');
      good(l.rocket, word);
      fx.burst(l.zone, 'gold', 14);
      fx.sound('coin');
    } else {
      misses++;
      l.rocket.className = 'rocket crashed';
      look('dead');
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
        look('shock');
        return;
      }
      phase = 'climb';
      t0 = t;
      lanes[b].rocket.className = 'rocket burning';
      look('happy');
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
      lift(lanes[cur().col], y);
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
