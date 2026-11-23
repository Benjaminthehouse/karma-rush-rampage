import './peak.css';
import { actor, COLOR, COLOR_NAME, clamp1000, defineSprite, h, padDots, pulse, randBtn, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

const FANS = 7; // the crowd at the foot of the tower

// The clock: a 23-pixel face with a gold rim and the hour hand at ten, and a strip of twelve
// minute-hand frames that slides one frame per tick behind a window the size of the face.
const C = 11;
const hand = (g: string[][], deg: number, len: number, ox = 0) => {
  const a = (deg * Math.PI) / 180;
  for (let i = 0; i <= len * 2; i++) g[Math.round(C - (Math.cos(a) * i) / 2)][ox + Math.round(C + (Math.sin(a) * i) / 2)] = 'k';
};
const face = Array.from({ length: 23 }, (_, y) =>
  Array.from({ length: 23 }, (_, x) => {
    const d = Math.hypot(x - C, y - C);
    const tick = d > 5.6 && (x === C || y === C);
    return d > 11.6 ? '.' : d > 10.5 ? 'k' : d > 8.7 ? (x + y < 19 ? 'Y' : x + y > 25 ? 'o' : 'y') : d > 7.8 || tick ? 'k' : 'Y';
  }),
);
hand(face, -60, 4);
for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) face[C + dy][C + dx] = 'k';
defineSprite('peak-clock', face.map((r) => r.join('')));
const strip = Array.from({ length: 23 }, () => Array<string>(23 * 12).fill('.'));
for (let f = 0; f < 12; f++) hand(strip, f * 30, 7, f * 23);
defineSprite('peak-hands', strip.map((r) => r.join('')));
// The tower's pointed roof and the marker's arrowheads.
defineSprite(
  'peak-roof',
  Array.from({ length: 6 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => {
      const o = Math.abs(x - 15.5);
      const w = 3 + y * 2.6;
      return o > w ? '.' : y === 5 || o > w - 1.5 ? 'k' : y === 1 || (x < 16 && o > w - 3) ? 'r' : 'R';
    }).join(''),
  ),
);
defineSprite('peak-arrow', `
k...
kk..
kkk.
kkkk
kkk.
kk..
k...`);

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const par = 6 + Math.floor(level / 2);
  // Every press locks input for 250 ms, so this is more targets than anyone can use up: the round never goes dead.
  const n = Math.ceil(duration / 250) + 2;
  const sweep = 1150 - level * 90; // ms for the marker to cross once
  const targets = Array.from({ length: n }, () => {
    const order = shuffled(rng, [0, 1, 2] as Btn[]);
    const a = 0.24 + rng() * 0.2;
    const b = 0.24 + rng() * 0.2;
    return { want: randBtn(rng), order, widths: [a, b, 1 - a - b] };
  });
  let idx = 0;
  let hits = 0;
  let misses = 0;
  let pos = 0;
  let pausedUntil = 0;

  // The clock tower at peak hour: a crowd meter down its face rises and falls, the crowd
  // at its foot swells and drains with it and holds up signs in the colour of the band
  // the meter is in. OP Cat waits beside it, phone out, to post at the right moment.
  const wrap = h('div', 'g-peak scene-stage');
  // The order sits at the bottom of the stage, right above the buttons, where the thumbs
  // and the eyes already are. Words pop from it, never from the marker: there they
  // drifted across the next colour to read.
  const ask = h('div', 'rule');
  const mid = h('div', 'mid');
  const poster = h('div', 'poster');
  const cat = actor('op', { px: 0.38 });
  poster.append(cat.el, sprite('phone', { px: 0.24 }, 'phone'));
  const tower = h('div', 'tower');
  const clock = sprite('peak-clock', { px: 0.254 }, 'clock');
  const hands = h('i', 'hands');
  hands.append(sprite('peak-hands', { px: 0.254 }));
  clock.append(hands);
  const track = h('div', 'track');
  const zones = [h('i'), h('i'), h('i')];
  const rail = h('div', 'rail');
  const marker = h('b', 'marker');
  marker.append(sprite('peak-arrow', { px: 0.16 }, 'tip'), sprite('peak-arrow', { px: 0.16, flip: true }, 'tip'));
  rail.append(marker);
  // The rail slides inside a clip a little wider than the meter, so it never pokes out of the tower.
  const clip = h('div', 'clip');
  clip.append(rail);
  track.append(...zones, clip);
  tower.append(sprite('peak-roof', { px: 0.3 }, 'roof'), clock, track);
  mid.append(poster, tower);
  const crowd = h('div', 'crowd');
  const fans = Array.from({ length: FANS }, (_, i) => {
    const fan = h('div', 'fan');
    const who = actor('npc', { px: 0.17 });
    fan.append(h('i', 'sign'), who.el);
    fan.style.zIndex = String(FANS - Math.abs(i - 3));
    crowd.append(fan);
    return { fan, who };
  });
  // The fans join from the middle out as the crowd swells.
  const joinOrder = [3, 2, 4, 1, 5, 0, 6];
  const note = h('div', 'g-note');
  wrap.append(note, mid, crowd, ask);
  root.append(wrap);

  let shown = -1; // fans shown
  let tint = -1; // the crowd's colour
  let y = '';
  let moodUntil = 0;
  function react(m: ActorMood, t: number) {
    cat.mood(m);
    moodUntil = t + 450;
  }

  function show() {
    const tg = targets[idx];
    if (!tg) {
      ask.textContent = 'Schedule full!';
      note.textContent = `${hits} of ${n} posts landed`;
      return;
    }
    ask.innerHTML = `Post during <b class="c-${COLOR[tg.want]}">${COLOR_NAME[tg.want]}</b>`;
    ask.append(padDots(tg.want));
    zones.forEach((z, i) => {
      z.className = `zone c-${COLOR[tg.order[i]]}`;
      z.style.flexBasis = `${tg.widths[i] * 100}%`;
    });
    tint = -1;
    note.textContent = `${hits} ${hits === 1 ? 'post' : 'posts'} landed`;
  }
  show();

  function zoneAt(p: number): Btn {
    const tg = targets[idx];
    let edge = 0;
    for (let i = 0; i < 3; i++) {
      edge += tg.widths[i];
      if (p <= edge) return tg.order[i];
    }
    return tg.order[2];
  }

  return {
    press(b, t) {
      const tg = targets[idx];
      if (!tg || t < pausedUntil) return;
      if (b === tg.want && zoneAt(pos) === tg.want) {
        hits++;
        react('happy', t);
        pulse(poster, 'bump');
        good(marker);
        fx.pop(ask, 'POSTED', 'gold');
        for (const f of fans) f.who.mood('happy');
      } else {
        misses++;
        react(b === tg.want ? 'sad' : 'shock', t);
        pulse(tower, 'shake');
        bad(marker);
        fx.pop(ask, b === tg.want ? 'BAD TIMING' : 'WRONG COLOUR', 'red');
        for (const f of fans) f.who.mood('sleep');
      }
      idx++;
      pausedUntil = t + 250;
      show();
    },
    tick(t) {
      const phase = (t / sweep) % 2;
      pos = phase < 1 ? phase : 2 - phase;
      // The meter fills from the bottom: the marker rides up the rail by `pos` of its height.
      const ny = `translateY(${(-pos * 100).toFixed(1)}%)`;
      if (ny !== y) {
        y = ny;
        rail.style.transform = ny;
      }
      const count = 1 + Math.round(pos * (FANS - 1));
      if (count !== shown) {
        shown = count;
        joinOrder.forEach((f, i) => fans[f].fan.classList.toggle('in', i < count));
      }
      if (targets[idx]) {
        const z = zoneAt(pos);
        if (z !== tint) {
          tint = z;
          crowd.className = `crowd c-${COLOR[z]}`;
        }
      }
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        cat.mood('idle');
        for (const f of fans) f.who.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (hits - misses / 2)) / par),
    hint(t) {
      const tg = targets[idx];
      return tg && t >= pausedUntil && zoneAt(pos) === tg.want ? tg.want : null;
    },
  };
};
