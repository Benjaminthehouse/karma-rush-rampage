import './sixfingers.css';
import { actor, clamp1000, defineSprite, h, hasSprite, pick, pulse, randBtn, sprite, type ActorMood, type GameFactory, type Tone } from './common';

// The AI painter's beret and palette: AutoMod has taken up art.
defineSprite('sixfingers-beret', `
.......kk.......
......kppk......
...kkkkkkkkkk...
.kkppppppppppkk.
kppPppppppppppPk
kPPPPPPPPPPPPPPk
.kkkkkkkkkkkkkk.`);
defineSprite('sixfingers-palette', `
...kkkkkkk..
.kknnnnnnnkk
knnrrnnggnnk
knrrnnnggnnk
knnnnnn..nnk
knbbnnn..nnk
knbbnnyynnnk
.knnnnyynnk.
..kkkkkkkk..`);

// A painted hand, in pixels: fingers up, thumb out to the left, a shirt cuff at the wrist.
// `count` is every digit, thumb included, so a real hand is 5. The fill is drawn first
// and the outline is whatever empty pixel touches it.
const PALM_TOP = 13; // row where the fingers meet the palm; the longest finger is 12 pixels
const PALM_LEFT = 6; // room on the left for the thumb
const NATURAL = [9, 11, 10, 7]; // index to little finger, in pixels
function handSprite(count: number, gap: number, lens: number[]): { name: string; w: number } {
  const n = count - 1; // fingers, without the thumb
  // A natural hand's profile stretched over however many fingers there are, each nudged a pixel or so.
  const len = Array.from({ length: n }, (_, i) => {
    const at = (i / (n - 1)) * 3;
    const lo = Math.floor(at);
    const base = NATURAL[lo] + (NATURAL[Math.min(3, lo + 1)] - NATURAL[lo]) * (at - lo);
    return Math.max(5, Math.min(12, Math.round(base + (lens[i] - 0.8) * 5)));
  });
  const name = `sixfingers-hand-${gap}-${len.join('-')}`;
  const right = PALM_LEFT + n * 3 + (n - 1) * gap - 1; // the palm's last column
  const W = right + 2;
  if (hasSprite(name)) return { name, w: W };
  const H = PALM_TOP + 15;
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const fill = (x0: number, x1: number, y0: number, y1: number, ch = 'A') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
  };
  len.forEach((l, i) => {
    const x = PALM_LEFT + i * (3 + gap);
    fill(x, x + 2, PALM_TOP - l + 1, PALM_TOP - 1);
    g[PALM_TOP - l][x + 1] = 'A'; // a rounded tip
  });
  fill(PALM_LEFT, right, PALM_TOP, PALM_TOP + 8);
  g[PALM_TOP + 8][PALM_LEFT] = g[PALM_TOP + 8][right] = '.';
  // The thumb: a three-pixel stroke out from the side of the palm, then up.
  for (let j = 0; j <= 5; j++) {
    const cx = PALM_LEFT - 1 - Math.min(j, 3);
    fill(cx - 1, j === 5 ? cx : cx + 1, PALM_TOP + 6 - j, PALM_TOP + 6 - j);
  }
  fill(PALM_LEFT + 2, right - 2, PALM_TOP + 9, PALM_TOP + 10); // the wrist
  fill(PALM_LEFT + 1, right - 1, PALM_TOP + 11, PALM_TOP + 13, 'w'); // the cuff
  // Shade the right-hand edge of everything, then outline.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '.' && (g[y][x + 1] ?? '.') === '.') g[y][x] = g[y][x] === 'w' ? 'd' : 'a';
  const solid = (x: number, y: number) => !!g[y]?.[x] && g[y][x] !== '.' && g[y][x] !== 'k';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g[y][x] = 'k';
  defineSprite(name, g.map((r) => r.join('')));
  return { name, w: W };
}

const SKINS: Tone[] = ['gold', 'pink', 'teal', 'ink'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + Math.floor(level * 0.75);
  const rounds = Array.from({ length: 24 }, () => {
    const fake = randBtn(rng);
    // Early on the AI always adds a finger; later it sometimes loses one.
    const wrongCount = level >= 2 && rng() < 0.4 ? 4 : 6;
    return {
      fake,
      hands: [0, 1, 2].map((i) => ({
        n: i === fake ? wrongCount : 5,
        skin: pick(rng, SKINS),
        lens: Array.from({ length: 6 }, () => 0.62 + rng() * 0.38),
        // Decoys: left or right hand, fingers together or spread, painted bigger or smaller.
        flip: rng() < 0.5,
        gap: rng() < 0.45 ? 2 : 1,
        wide: 4.5 + Math.floor(rng() * 3) * 0.4, // how wide the painting of it is, in em
      })),
    };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  // The scene: a street art fair. Three framed hands stand on easels; the AI painter
  // (AutoMod in a beret) waits at the front to see if you can tell which one it painted.
  const wrap = h('div', 'g-sixfingers scene-street');
  // The one rule, kept on screen as the fair's banner: colour, size, spread and finger length are all decoys.
  const rule = h('div', 'rule');
  rule.innerHTML = 'Real hands have <b>5</b> fingers';
  const row = h('div', 'row');
  const slots = [0, 1, 2].map(() => {
    const easel = h('div', 'easel');
    const slot = h('div', 'slot');
    easel.append(slot, h('i', 'legs'));
    row.append(easel);
    return slot;
  });
  const front = h('div', 'front');
  const painter = h('div', 'painter');
  const bot = actor('automod', { px: 0.4 });
  painter.append(sprite('sixfingers-beret', { px: 0.4 }, 'beret'), bot.el);
  const palette = sprite('sixfingers-palette', { px: 0.26 }, 'palette');
  const note = h('div', 'tally');
  front.append(palette, painter, note);
  wrap.append(rule, row, front);
  root.append(wrap);
  let moodUntil = 0;
  function face(m: ActorMood, t: number) {
    bot.mood(m);
    moodUntil = t + 450;
  }

  function show() {
    const r = rounds[idx % rounds.length];
    slots.forEach((slot, i) => {
      const hand = r.hands[i];
      // Every hand is painted to fill its frame, so a sixth finger makes the fingers thinner, not the hand wider.
      const art = handSprite(hand.n, hand.gap, hand.lens);
      const px = Math.min(0.25, hand.wide / art.w);
      slot.replaceChildren(sprite(art.name, { tone: hand.skin, flip: hand.flip, px }, 'hand'));
    });
    pulse(row, 'pop-in');
    note.textContent = `${right} fakes caught`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const r = rounds[idx % rounds.length];
      if (b === r.fake) {
        right++;
        good(slots[b], r.hands[b].n === 6 ? 'SIX!' : 'FOUR!');
        fx.burst(slots[b], 'purple', 10);
        face('shock', t); // caught out
        pulse(bot.el, 'shake');
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(slots[b], 'THAT ONE IS REAL');
        face('happy', t); // fooled you
        pulse(bot.el, 'bump');
      }
      idx++;
      show();
    },
    tick(t) {
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        bot.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].fake : null),
  };
};
