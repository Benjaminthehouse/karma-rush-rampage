import './peak.css';
import { actor, COLOR, clamp1000, defineSprite, h, hasSprite, pulse, randBtn, setSprite, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// The clock, in pixels: a 45-pixel face with a gold rim and a mark at every hour.
const S = 45;
const C = 22;
const FACE_R = 16.9; // the face inside the rim
/** Where a pixel is on the dial, in hours: 0 at twelve o'clock, clockwise. */
const hourAt = (x: number, y: number) => ((Math.atan2(x - C, C - y) / (2 * Math.PI)) * 12 + 12) % 12;
const grid = (cell: (x: number, y: number, d: number, hr: number) => string) =>
  Array.from({ length: S }, (_, y) => Array.from({ length: S }, (_, x) => cell(x, y, Math.hypot(x - C, y - C), hourAt(x, y))).join(''));

defineSprite(
  'peak-face',
  grid((x, y, d, hr) => {
    if (d > 22.4) return '.';
    if (d > 21.2) return 'k';
    if (d > 17.9) {
      // The rim: gold, lit from the top left, with a dark mark at each hour.
      const off = Math.abs(hr - Math.round(hr)) * ((2 * Math.PI * d) / 12);
      return off < 0.65 ? 'k' : x + y < 36 ? 'Y' : x + y > 52 ? 'o' : 'y';
    }
    if (d > FACE_R) return 'k';
    return d > 14.6 ? 'd' : 'w';
  }),
);
// The arrowhead on the end of the hand.
defineSprite('peak-tip', `
...k...
..kyk..
.kyYyk.
kyyYyyk
kkkkkkk`);

/** A slice of the face from `start`, `width` hours wide (both in quarter hours), in the sprite's tone. */
function wedge(startQ: number, widthQ: number): string {
  const name = `peak-wedge-${startQ}-${widthQ}`;
  if (!hasSprite(name)) {
    const start = startQ / 4;
    const width = widthQ / 4;
    defineSprite(
      name,
      grid((x, y, d, hr) => {
        const into = (hr - start + 12) % 12;
        if (d > FACE_R || d < 2.6 || into > width) return '.';
        // A dark edge along both sides, and a stripe of light for texture.
        const side = Math.min(into, width - into) * ((2 * Math.PI * d) / 12);
        return side < 0.8 ? 'k' : (x + y) % 5 === 0 ? 'L' : 'A';
      }),
    );
  }
  return name;
}

const PX = 0.34; // one clock pixel, in em

// One clock, one hand, one coloured slice. The hand sweeps round; the slice is the peak
// hour. Its colour says which button, the hand says when. Nothing else moves.
export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const par = 6 + Math.floor(level / 2);
  const lap = 2300 - level * 150; // ms for the hand to go once round
  // Wide enough to hit by eye: the hand is inside for about a third of a second at
  // first, a fifth of a second in the last round.
  const widthQ = Math.round((2 - level * 0.15) * 4);
  const width = widthQ / 4;
  // Every press locks input for 250 ms, so this is more slices than anyone can use up.
  const n = Math.ceil(duration / 250) + 2;
  const slices = Array.from({ length: n }, () => ({ want: randBtn(rng), ahead: 2.5 + rng() * 3.5 }));
  for (let i = 1; i < n; i++) while (slices[i].want === slices[i - 1].want) slices[i].want = ((slices[i].want + 1) % 3) as Btn;

  let idx = -1;
  let start = 0; // where the slice begins, in hours
  let hits = 0;
  let misses = 0;
  let hour = 0; // where the hand points
  let pausedUntil = 0;

  // The scene: OP Cat, phone out, under the town clock. The lit slice is when everyone is
  // online; the gold hand is the time now.
  const wrap = h('div', 'g-peak scene-stage');
  const top = h('div', 'top');
  const cat = actor('op', { px: 0.24 });
  const note = h('span', 'note');
  top.append(cat.el, sprite('phone', { px: 0.16 }, 'phone'), note);
  const clock = h('div', 'clock');
  const slice = sprite(wedge(0, widthQ), { tone: 'red', px: PX }, 'slice');
  const hand = h('b', 'hand');
  hand.append(sprite('peak-tip', { px: 0.2 }, 'tip'));
  // Words pop from the top of the clock, clear of the hand and the slice.
  const stamp = h('i', 'stamp');
  clock.append(sprite('peak-face', { px: PX }, 'face'), slice, hand, h('i', 'hub'), stamp);
  const rule = h('div', 'rule', 'Tap the slice’s colour while the hand is in it');
  wrap.append(top, clock, rule);
  root.append(wrap);

  let turn = '';
  let moodUntil = 0;
  function react(m: ActorMood, t: number) {
    cat.mood(m);
    moodUntil = t + 450;
  }
  const inside = (margin = 0) => {
    const into = (hour - start + 12) % 12;
    return into >= margin && into <= width - margin;
  };

  /** The next peak hour: a new colour, a few hours ahead of the hand. */
  function next() {
    idx++;
    const s = slices[idx % n];
    const startQ = Math.round((hour + s.ahead) * 4) % 48;
    start = startQ / 4;
    setSprite(slice, wedge(startQ, widthQ), { tone: COLOR[s.want], px: PX });
    pulse(slice, 'pop-in');
    note.textContent = `${hits} ${hits === 1 ? 'post' : 'posts'} landed`;
  }
  next();

  return {
    press(b, t) {
      if (t < pausedUntil) return;
      const want = slices[idx % n].want;
      if (b === want && inside()) {
        hits++;
        react('happy', t);
        good(stamp, 'POSTED');
        fx.burst(clock, 'gold', 10);
      } else {
        misses++;
        react(b === want ? 'sad' : 'shock', t);
        pulse(clock, 'shake');
        bad(stamp, b === want ? 'NOBODY ONLINE' : 'WRONG COLOUR');
      }
      pausedUntil = t + 250;
      next();
    },
    tick(t) {
      hour = ((t / lap) * 12) % 12;
      const deg = `rotate(${(hour * 30).toFixed(1)}deg)`;
      if (deg !== turn) {
        turn = deg;
        hand.style.transform = deg;
      }
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        cat.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (hits - misses / 2)) / par),
    // A touch inside the edges, so a bot's press lands before the hand has left.
    hint: (t) => (t >= pausedUntil && inside(0.12) ? slices[idx % n].want : null),
  };
};
