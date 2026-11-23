import './peak.css';
import { actor, COLOR, clamp1000, defineSprite, h, pulse, randBtn, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// The arrowhead at each end of the marker (pointing down; flipped for the one underneath).
defineSprite('peak-pin', `
kkkkkkkkk
kyyYYYyyk
.kyyYyyk.
..kyyyk..
...kyk...
....k....`);

// One bar, one arrow, one coloured zone. The arrow sweeps back and forth; the zone is the
// peak hour. Its colour says which button, the arrow says when. Nothing else moves.
export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const par = 6 + Math.floor(level / 2);
  const sweep = 1150 - level * 70; // ms for the arrow to cross once
  // Every press locks input for 250 ms, so this is more zones than anyone can use up.
  const n = Math.ceil(duration / 250) + 2;
  // Wide enough to hit by eye: the arrow is inside for about a third of a second at
  // first, a fifth of a second in the last round.
  const zones = Array.from({ length: n }, () => ({
    want: randBtn(rng),
    width: 0.26 - level * 0.02 + rng() * 0.08,
    u: rng(),
  }));
  for (let i = 1; i < n; i++) while (zones[i].want === zones[i - 1].want) zones[i].want = ((zones[i].want + 1) % 3) as Btn;

  let idx = -1;
  let lo = 0;
  let hi = 0;
  let hits = 0;
  let misses = 0;
  let pos = 0;
  let pausedUntil = 0;

  // The scene: OP Cat, phone out, over the day's timeline. The lit zone is when everyone
  // is online; the gold arrow is the time now.
  const wrap = h('div', 'g-peak scene-stage');
  const note = h('div', 'g-note');
  const poster = h('div', 'poster');
  const cat = actor('op', { px: 0.5 });
  poster.append(cat.el, sprite('phone', { px: 0.3 }, 'phone'));
  const bar = h('div', 'bar');
  const zone = h('div', 'zone');
  const carrier = h('div', 'carrier');
  const marker = h('b', 'marker');
  marker.append(sprite('peak-pin', { px: 0.16 }, 'tip'), sprite('peak-pin', { px: 0.16, flipY: true }, 'tip'));
  carrier.append(marker);
  // The carrier slides inside a clip a little bigger than the bar, so it never pokes out of the stage.
  const clip = h('div', 'clip');
  clip.append(carrier);
  bar.append(zone, clip);
  const rule = h('div', 'rule', 'Tap the zone’s colour while the arrow is in it');
  wrap.append(note, poster, bar, rule);
  root.append(wrap);

  let x = '';
  let moodUntil = 0;
  function react(m: ActorMood, t: number) {
    cat.mood(m);
    moodUntil = t + 450;
  }

  /** The next peak hour: a new colour, somewhere the arrow is not. */
  function next() {
    idx++;
    const z = zones[idx % n];
    const half = z.width / 2;
    let mid = half + z.u * (1 - z.width);
    // Never under the arrow: a zone that appeared around it would be a free hit or a trap.
    if (Math.abs(mid - pos) < half + 0.14) mid = 1 - mid;
    if (Math.abs(mid - pos) < half + 0.14) mid = pos < 0.5 ? 1 - half : half;
    lo = mid - half;
    hi = mid + half;
    zone.className = `zone c-${COLOR[z.want]}`;
    zone.style.left = `${lo * 100}%`;
    zone.style.width = `${z.width * 100}%`;
    pulse(zone, 'pop-in');
    note.textContent = `${hits} ${hits === 1 ? 'post' : 'posts'} landed`;
  }
  next();

  return {
    press(b, t) {
      if (t < pausedUntil) return;
      const want = zones[idx % n].want;
      const inside = pos >= lo && pos <= hi;
      if (b === want && inside) {
        hits++;
        react('happy', t);
        pulse(poster, 'bump');
        good(zone, 'POSTED');
        fx.burst(zone, 'gold', 10);
      } else {
        misses++;
        react(b === want ? 'sad' : 'shock', t);
        pulse(bar, 'shake');
        bad(zone, b === want ? 'NOBODY ONLINE' : 'WRONG COLOUR');
      }
      pausedUntil = t + 250;
      next();
    },
    tick(t) {
      const phase = (t / sweep) % 2;
      pos = phase < 1 ? phase : 2 - phase;
      const nx = `translateX(${(pos * 100).toFixed(1)}%)`;
      if (nx !== x) {
        x = nx;
        carrier.style.transform = nx;
      }
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        cat.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (hits - misses / 2)) / par),
    hint(t) {
      // A touch inside the edges, so a bot's press lands before the arrow has left.
      return t >= pausedUntil && pos >= lo + 0.02 && pos <= hi - 0.02 ? zones[idx % n].want : null;
    },
  };
};
