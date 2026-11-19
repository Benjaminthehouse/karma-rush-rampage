import './voidcanvas.css';
import { COLOR, COLOR_NAME, h, pulse, randBtn, ratio, shuffled, type Btn, type GameFactory } from './common';

const COLS = 20;
// The community masterpiece, one letter per pixel:
// r red, o orange, y gold, g green, b blue, p purple, n pink, k ink, dot blank.
const ART = [
  '....................',
  '........g...yyyy....',
  '..rr.rr....yyyyyy..b',
  '.rrrrrrr..yykyykyy..',
  '.rrrrrrr..yykyykyy..',
  '..rrrrr...yyyyyyyy..',
  '...rrr....ykyyyyky.p',
  '....r......ykkkky...',
  '.b......p...ynny....',
  '....................',
  'rrooyyggbbpprrooyygg',
  'rrooyyggbbpprrooyygg',
];
const CHAT = [
  'the heart is non-negotiable',
  'who keeps placing black pixels??',
  'hold the line, the smiley needs us',
  'alliance with rainbow road confirmed',
  'one pixel every five minutes. worth it',
  'mods, the void is griefing again',
  'we lost a column. we ride at dawn',
  'not bots, just very dedicated',
  'streamer raid incoming, brace',
  'spent my lunch break on one pixel',
];

/** The art as one rect per run of same-coloured pixels. */
function artSvg() {
  let rects = '';
  ART.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      let end = x;
      while (row[end] === row[x]) end++;
      if (row[x] !== '.') rects += `<rect class="p-${row[x]}" x="${x}" y="${y}" width="${end - x}" height="1"/>`;
      x = end;
    }
  });
  return `<svg viewBox="0 0 ${COLS} ${ART.length}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The void bites faster the more canvas you hold, so every pace finds its own frontline.
  const biteGap = (cols: number) => 1000 / (0.4 + level * 0.27 + cols * 0.2);
  const seq: Btn[] = [];
  while (seq.length < 120) {
    const b = randBtn(rng);
    // Never three of the same in a row, so it reads as a pattern rather than a mash.
    if (seq.length >= 2 && seq[seq.length - 1] === b && seq[seq.length - 2] === b) continue;
    seq.push(b);
  }
  // A raid eats three columns at once; never in the closing second and a half.
  const raidCount = 1 + Math.floor(level / 2);
  const slot = (duration - 3300) / raidCount;
  const raids = Array.from({ length: raidCount }, (_, i) => 1700 + slot * (i + rng() * 0.7));
  const chat = shuffled(rng, CHAT);

  let held = COLS / 2; // columns that are still ours, counted from the left
  let idx = 0;
  let lockedUntil = 0;
  let nextBite = biteGap(held);
  let raid = 0;
  let proud = true; // the big cheer fires once per comeback, not on every flicker at the edge
  let line = -1;

  const wrap = h('div', 'g-voidcanvas');
  const queue = h('div', 'queue');
  const swatches = [0, 1, 2, 3, 4].map(() => queue.appendChild(h('i')));
  const canvas = h('div', 'canvas');
  canvas.innerHTML = artSvg();
  const splat = h('i', 'splat');
  const front = h('i', 'front');
  canvas.append(h('i', 'void'), splat, front);
  const ours = h('b', 'ours');
  const theirs = h('b', 'theirs');
  const tally = h('div', 'tally');
  const left = h('span');
  const right = h('span');
  left.append(ours, ' CANVAS');
  right.append('VOID ', theirs);
  tally.append(left, right);
  const note = h('div', 'g-note');
  wrap.append(queue, canvas, tally, note);
  root.append(wrap);

  const want = () => seq[idx % seq.length];

  function show() {
    swatches.forEach((s, i) => {
      const b = seq[(idx + i) % seq.length];
      s.className = `c-${COLOR[b]}`;
      if (!i) s.textContent = COLOR_NAME[b];
    });
    front.className = `front c-${COLOR[want()]}`;
    canvas.style.setProperty('--held', String(held));
    canvas.classList.toggle('full', held === COLS);
    const pct = Math.round((held / COLS) * 100);
    ours.textContent = `${pct}%`;
    theirs.textContent = `${100 - pct}%`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil || held === COLS) return;
      if (b !== want()) {
        lockedUntil = t + 400;
        wrap.classList.add('locked');
        pulse(queue, 'shake');
        bad(swatches[0], 'COOLDOWN 5:00');
        return;
      }
      splat.className = `splat c-${COLOR[b]}`;
      splat.style.left = `${held * 5}%`;
      pulse(splat, 'go');
      good(splat);
      idx++;
      held++;
      if (held === COLS && proud) {
        proud = false;
        fx.pop(canvas, 'WE HELD THE LINE!', 'gold');
        fx.burst(canvas, 'gold', 26);
        fx.flash('gold');
        fx.sound('coin');
      }
      show();
    },
    tick(t) {
      if (t >= lockedUntil) wrap.classList.remove('locked');
      let moved = false;
      while (raid < raids.length && t >= raids[raid]) {
        raid++;
        held = Math.max(0, held - 3);
        moved = true;
        pulse(canvas, 'shake');
        fx.pop(canvas, 'VOID RAID!', 'purple');
        fx.flash('purple');
        fx.shake();
        fx.sound('thud');
      }
      while (t >= nextBite) {
        if (held > 0) {
          held--;
          moved = true;
        }
        nextBite += biteGap(held);
      }
      if (held <= COLS - 3) proud = true;
      if (moved) show();
      const now = Math.floor(t / 1700) % chat.length;
      if (now !== line) {
        line = now;
        note.textContent = chat[now];
      }
    },
    // One column of grace: the void always sneaks a bite in right at the bell.
    score: () => ratio(held, COLS - 1),
    hint: (t) => (t >= lockedUntil && held < COLS ? want() : null),
  };
};
