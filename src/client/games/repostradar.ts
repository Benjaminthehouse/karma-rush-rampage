import './repostradar.css';
import { actor, clamp1000, defineSprite, h, pulse, randBtn, setSprite, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// The Lurker's magnifying glass, held up at an angle: a brass rim, a glinting lens, a wooden handle.
defineSprite('repostradar-glass', `
...........kk.
..........knnk
.........knnk.
........knnk..
.......kyyk...
..kkkkkyyk....
.kyyyyyyk.....
kyywccyyk.....
kywccccyk.....
kycccccyk.....
kycccccyk.....
kyyccccyk.....
.kyyyyyk......
..kkkkk.......`);
// A red push pin for the evidence board.
defineSprite('repostradar-pin', `
.kkk.
krrRk
kRRRk
.kkk.
..k..`);

const SHAPES = ['disc', 'box', 'tri', 'star', 'gem', 'drop', 'cross', 'bolt', 'moon', 'ring'];
const TINTS = ['gold', 'purple', 'ink', 'teal', 'pink'] as const;
// Each polaroid shape as a pixel sprite: a test on a 14x14 grid, outlined in k and lit from the top left.
const poly = (pts: number[]) => (u: number, v: number) => {
  let hit = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const round = (u: number, v: number, x = 0.5, y = 0.5) => Math.hypot(u - x, v - y);
const TESTS: Record<string, (u: number, v: number) => boolean> = {
  disc: (u, v) => round(u, v) < 0.5,
  box: () => true,
  tri: poly([0.5, 0, 1, 1, 0, 1]),
  star: poly([0.5, 0, 0.62, 0.35, 1, 0.38, 0.7, 0.6, 0.8, 1, 0.5, 0.76, 0.2, 1, 0.3, 0.6, 0, 0.38, 0.38, 0.35]),
  gem: (u, v) => Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.52,
  drop: (u, v) => round(u, v, 0.5, 0.64) < 0.36 || poly([0.5, 0, 0.84, 0.56, 0.16, 0.56])(u, v),
  cross: (u, v) => Math.abs(u - 0.5) < 0.17 || Math.abs(v - 0.5) < 0.17,
  bolt: poly([0.62, 0, 0.08, 0.56, 0.44, 0.56, 0.32, 1, 0.92, 0.4, 0.56, 0.4]),
  moon: (u, v) => round(u, v) < 0.5 && round(u, v, 0.78, 0.32) > 0.42,
  ring: (u, v) => round(u, v) < 0.5 && round(u, v) > 0.22,
};
for (const [name, test] of Object.entries(TESTS)) {
  const on = (x: number, y: number) => x >= 1 && y >= 1 && x <= 14 && y <= 14 && test((x - 0.5) / 14, (y - 0.5) / 14);
  defineSprite(
    `repostradar-${name}`,
    Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => {
        if (!on(x, y)) return on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ? 'k' : '.';
        if (!on(x + 1, y) || !on(x, y + 1)) return 'a';
        return !on(x - 1, y) || !on(x, y - 1) ? 'L' : 'A';
      }).join(''),
    ),
  );
}
const CAPTIONS = ['wow', 'OC', 'look', 'lol', 'me irl', 'TIL', 'cute', 'huh'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.floor(level * 0.75);
  // Every post is a shape + tint pair. Pairs are dealt once, then come back as reposts.
  const deck = shuffled(
    rng,
    SHAPES.flatMap((s) => TINTS.map((c) => ({ shape: s, tint: c, cap: CAPTIONS[Math.floor(rng() * CAPTIONS.length)] })))
  );
  let fresh = 0;
  const seen: typeof deck = [];
  const next = () => deck[fresh++ % deck.length];
  // Opening screen: three fresh posts to remember, nothing to press yet.
  const intro = [next(), next(), next()];
  seen.push(...intro);
  // Two fresh posts a screen, and never more screens than the deck can fill: a "fresh"
  // post that has been shown before would be a second repost, and calling it out a "miss".
  const screens = Array.from({ length: Math.floor((deck.length - intro.length) / 2) }, () => {
    // Later rounds reach further back for the repost.
    const reach = Math.min(seen.length, 3 + level * 2);
    const repost = seen[seen.length - 1 - Math.floor(rng() * reach)];
    const slot = randBtn(rng);
    const tiles = [0, 1, 2].map((i) => (i === slot ? repost : next()));
    tiles.forEach((t) => t !== repost && seen.push(t));
    return { tiles, slot };
  });
  const INTRO_MS = 1100;
  let idx = -1;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  // The scene: a detective's office. Three posts are pinned to the evidence board with red
  // string; the Lurker sits below with a magnifying glass and swings it at your pick.
  // Every repost caught goes into the case files on the desk.
  const wrap = h('div', 'g-repostradar scene-office');
  const banner = h('div', 'rule', 'Remember these!');
  const board = h('div', 'board');
  const row = h('div', 'row');
  const cells = [0, 1, 2].map(() => {
    const c = h('div', 'tile');
    const photo = h('div', 'photo');
    const art = sprite('repostradar-disc', { px: 0.21 });
    photo.append(art);
    const cap = h('span');
    c.append(sprite('repostradar-pin', { px: 0.2 }, 'pin'), photo, cap);
    row.append(c);
    return { c, art, cap };
  });
  // Verdicts float up from above the row, so they never cover the next three posts
  // (or get cut off at the edge of the stage).
  const stamp = h('i', 'stamp');
  row.append(stamp);
  board.append(h('i', 'string'), row);
  const desk = h('div', 'desk');
  const sleuth = h('div', 'sleuth');
  const lurker = actor('lurker', { mood: 'peep', px: 0.42 });
  sleuth.append(lurker.el);
  const glassWay = h('div', 'glassway');
  const glass = sprite('repostradar-glass', { px: 0.3 }, 'glass');
  glassWay.append(glass);
  const files = h('div', 'files');
  const note = h('span', 'count');
  files.append(note);
  desk.append(glassWay, sleuth, files);
  wrap.append(banner, board, desk);
  root.append(wrap);

  let mood: ActorMood = 'peep';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number) => {
    moodUntil = t + 420;
    if (m === mood) return;
    mood = m;
    lurker.mood(m);
  };

  function show() {
    const tiles = idx < 0 ? intro : screens[idx % screens.length].tiles;
    cells.forEach((cell, i) => {
      setSprite(cell.art, `repostradar-${tiles[i].shape}`, { px: 0.21, tone: tiles[i].tint });
      cell.cap.textContent = tiles[i].cap;
    });
    pulse(row, 'pop-in');
    banner.textContent = idx < 0 ? 'Remember these!' : 'Which one is a repost?';
    note.textContent = `${right} caught`;
  }
  show();

  return {
    press(b: Btn, t) {
      if (idx < 0 || t < lockedUntil) {
        // Too early: still answer the press.
        fx.sound('tick');
        if (idx < 0) pulse(banner, 'bump');
        return;
      }
      const s = screens[idx % screens.length];
      if (b === s.slot) {
        right++;
        good(stamp, 'REPOST!');
        fx.burst(cells[b].c, 'gold', 10);
        look('cool', t);
        // The caught repost goes into the case files: one stamped folder per catch.
        if (files.childElementCount < 9) files.insertBefore(h('i', 'case'), note);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(stamp, 'THAT WAS OC');
        look('shock', t);
      }
      glassWay.className = `glassway at-${b}`;
      pulse(glass, 'bump');
      idx++;
      show();
    },
    tick(t) {
      // Red frames while a wrong call has the buttons locked.
      row.classList.toggle('locked', t < lockedUntil);
      if (mood !== 'idle' && idx >= 0 && t >= moodUntil) {
        mood = 'idle';
        lurker.mood('idle');
      }
      if (idx < 0 && t >= INTRO_MS) {
        idx = 0;
        show();
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (idx >= 0 && t >= lockedUntil ? screens[idx % screens.length].slot : null),
  };
};
