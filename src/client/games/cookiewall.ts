import './cookiewall.css';
import { clamp1000, defineSprite, h, pick, pulse, randBtn, setSprite, shuffled, sprite, type GameFactory } from './common';

// The guard: a cookie-jar robot. Its head is the jar's lid and neck; the face shows its mood.
const LID = [
  '......kkkk......',
  '......kyyk......',
  '.......kk.......',
  '..kkkkkkkkkkkk..',
  '.knnnnnnnnnnnnk.',
  '.knNnnNnnNnnNnk.',
  '.kNNNNNNNNNNNNk.',
  '..kkkkkkkkkkkk..',
  'kcccccccccccccck',
];
const FACES = {
  // Arms folded, blocking the door.
  idle: ['kccrrccccccrrcck', 'kccrrccccccrrcck', 'kcccccccccccccck', 'kcccckkkkkkcccck', 'kcccccccccccccck'],
  // You fell for it: a grin and gold eyes.
  glee: ['kccyyccccccyycck', 'kccYYccccccYYcck', 'kcccccccccccccck', 'kcckwwwwwwwwkcck', 'kccckkkkkkkkccck'],
  // You got past: droopy eyes, a wobbly frown.
  sad: ['kcckccccccccckck', 'kccckkccccckkcck', 'kcccccccccccccck', 'kccccckkkkccccck', 'kcccckcccckcccck'],
};
for (const [m, face] of Object.entries(FACES)) defineSprite(`cookiewall-${m}`, [...LID, ...face]);
type Face = keyof typeof FACES;

const REAL = ['Reject all', 'Decline all', 'No thanks', 'Refuse all', 'Reject everything'];
const TRAPS = [
  'Accept all',
  'Accept & continue',
  'Reject none',
  'Yes to cookies',
  'Allow everything',
  'Reject privacy',
  'Reject later',
  'OK, track me',
  'Manage 847 partners',
  'I love cookies',
  'Agree to all',
  'Sounds good',
];
const SITES = ['recipe-blog', 'news-but-loud', 'free-pdf-tool', 'weather-app', 'quiz-results', 'one-weird-trick'];
const CRUMBS = 9; // cookies in one shower
const HEAD = 0.56; // one pixel of the guard's head, in em

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.floor(level * 0.75);
  const walls = Array.from({ length: 24 }, () => {
    const slot = randBtn(rng);
    const traps = shuffled(rng, TRAPS);
    const text = [0, 1, 2].map((i) => (i === slot ? pick(rng, REAL) : traps[i]));
    // Dark pattern: the real option gets the dullest styling more often on later levels.
    const loud = [0, 1, 2].map((i) => (i === slot ? rng() > 0.45 + level * 0.12 : rng() < 0.8));
    return { slot, text, loud, site: pick(rng, SITES) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;
  let faceUntil = 0;

  // A back-alley door with a neon sign. The cookie-jar robot guarding it has three buttons
  // on its chest; only one really rejects. The others shower you in cookies.
  const wrap = h('div', 'g-cookiewall scene-alley');
  const sign = h('div', 'site');
  const yard = h('div', 'yard');
  const door = h('div', 'door');
  door.append(h('i', 'knob'));
  const guard = h('div', 'guard');
  const head = sprite('cookiewall-idle', { px: HEAD }, 'head');
  const chest = h('div', 'chest');
  const row = h('div', 'row');
  const opts = [0, 1, 2].map(() => {
    const o = h('div', 'opt');
    row.append(o);
    return o;
  });
  // The bottom of the jar is full of cookies.
  const stash = h('div', 'stash');
  for (let i = 0; i < 6; i++) stash.append(sprite('cookie', { px: 0.24, flip: i % 2 === 1 }, 'deco'));
  chest.append(row, stash);
  guard.append(head, chest, h('i', 'feet'));
  // The cookie shower, ready to fall from the top of the stage.
  const shower = h('div', 'shower');
  const crumbs = Array.from({ length: CRUMBS }, (_, i) => {
    const c = sprite('cookie', { px: 0.26 }, 'crumb');
    c.style.left = `${2 + ((i * 29) % 78)}%`;
    c.style.animationDelay = `${(i % 4) * 40}ms`;
    shower.append(c);
    return c;
  });
  yard.append(door, guard);
  const note = h('div', 'g-note');
  wrap.append(sign, yard, note, shower);
  root.append(wrap);

  function face(f: Face, t: number) {
    setSprite(head, `cookiewall-${f}`, { px: HEAD });
    faceUntil = f === 'idle' ? 0 : t + 450;
  }

  function show() {
    const w = walls[idx % walls.length];
    sign.textContent = `${w.site} values your privacy`;
    opts.forEach((o, i) => {
      o.textContent = w.text[i];
      o.className = `opt ${w.loud[i] ? 'loud' : 'quiet'}`;
    });
    pulse(chest, 'pop-in');
    note.textContent = `${right} wall${right === 1 ? '' : 's'} dodged`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const w = walls[idx % walls.length];
      pulse(opts[b], 'bump');
      if (b === w.slot) {
        right++;
        face('sad', t);
        // The door swings open for a moment behind the beaten guard.
        pulse(door, 'open');
        // The word floats from the header, never over the options of the next wall.
        good(opts[b]);
        fx.pop(sign, 'REJECTED', 'gold');
        fx.burst(opts[b], 'green', 10);
      } else {
        wrong++;
        lockedUntil = t + 450;
        face('glee', t);
        for (const c of crumbs) pulse(c, 'rain');
        bad(opts[b]);
        fx.pop(sign, 'TRACKED', 'red');
        fx.burst(opts[b], 'red', 8);
      }
      idx++;
      show();
    },
    tick(t) {
      if (faceUntil && t >= faceUntil) face('idle', t);
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? walls[idx % walls.length].slot : null),
  };
};
