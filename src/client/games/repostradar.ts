import './repostradar.css';
import { clamp1000, h, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

const SHAPES = ['disc', 'box', 'tri', 'star', 'gem', 'drop', 'cross', 'bolt', 'moon', 'ring'];
const TINTS = ['gold', 'purple', 'ink', 'teal', 'pink'];
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

  const wrap = h('div', 'g-repostradar');
  const banner = h('div', 'rule', 'Remember these!');
  const row = h('div', 'row');
  const cells = [0, 1, 2].map(() => {
    const c = h('div', 'tile');
    const art = h('i');
    const cap = h('span');
    c.append(art, cap);
    row.append(c);
    return { c, art, cap };
  });
  // Verdicts float up from above the row, so they never cover the next three posts
  // (or get cut off at the edge of the stage).
  const stamp = h('i', 'stamp');
  row.append(stamp);
  const note = h('div', 'g-note');
  wrap.append(banner, row, note);
  root.append(wrap);

  function show() {
    const tiles = idx < 0 ? intro : screens[idx % screens.length].tiles;
    cells.forEach((cell, i) => {
      cell.art.className = `${tiles[i].shape} ${tiles[i].tint}`;
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
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(stamp, 'THAT WAS OC');
      }
      idx++;
      show();
    },
    tick(t) {
      // Red frames while a wrong call has the buttons locked.
      row.classList.toggle('locked', t < lockedUntil);
      if (idx < 0 && t >= INTRO_MS) {
        idx = 0;
        show();
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (idx >= 0 && t >= lockedUntil ? screens[idx % screens.length].slot : null),
  };
};
