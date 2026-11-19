import './voidcanvas.css';
import { COLOR, COLOR_NAME, h, pulse, randBtn, ratio, shuffled, type Btn, type GameFactory } from './common';

const COLS = 20;
// The community masterpiece, one letter per pixel:
// r red, o orange, y gold, g green, b blue, p purple, n pink, k ink, dot blank.
const ART = [
  '....................',
  '........g...yyyyy...',
  '..rr.rr....yyyyyyy.b',
  '.rrrrrrr..yykyyykyy.',
  '.rrrrrrr..yykyyykyy.',
  '..rrrrr...yyyyyyyyy.',
  '...rrr....ykyyyyyky.',
  '....r.....yykkkkkyy.',
  '.b.....p...yynnnyy..',
  '............yyyyy...',
  '....................',
  '...p....g..........b',
  'rrooyyggbbpprrooyygg',
  'rrooyyggbbpprrooyygg',
];
const CHAT = [
  'the heart is non-negotiable',
  'who keeps placing black pixels??',
  'hold the line, the smiley needs us',
  'rainbow gang alliance confirmed',
  'one pixel every five minutes. worth it',
  'mods, the void is griefing again',
  'we lost a column. we ride at dawn',
  'not bots, just very dedicated',
  'spent my lunch break on one pixel',
];
const RAID_CHAT = 'streamer raid incoming, brace!';
const RAID = 2; // columns a raid takes in one gulp
const OMEN = 650; // ms of warning before a raid lands
const SMILEY = 15; // columns held when the smiley's first eye and half its grin are out of the void

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
  // The void bites harder the more canvas you hold, so every pace finds its own frontline
  // and only a fast painter can pin it against the edge.
  const biteGap = (cols: number) => 1000 / (1.3 + level * 0.12 + 4.3 * (cols / COLS) ** 2);
  const seq: Btn[] = [];
  while (seq.length < 120) {
    const b = randBtn(rng);
    // Never three of the same in a row, so it reads as a pattern rather than a mash.
    if (seq.length >= 2 && seq[seq.length - 1] === b && seq[seq.length - 2] === b) continue;
    seq.push(b);
  }
  // A raid eats RAID columns in one gulp: one raid in the first round, three in the last,
  // never in the closing second and a half.
  const raidCount = 1 + Math.floor(level / 2);
  const slot = (duration - 3300) / raidCount;
  const raids = Array.from({ length: raidCount }, (_, i) => 1700 + slot * (i + rng() * 0.7));
  const chat = shuffled(rng, CHAT);

  let held = COLS / 2; // columns that are still ours, counted from the left
  let idx = 0;
  let lockedUntil = 0;
  let nextBite = 400 + biteGap(held); // a breath to find the first colour
  let raid = 0;
  let bracing = false; // a raid is about to land
  let proud = true; // the big cheer fires once per comeback, not on every flicker at the edge
  let best = held; // furthest the line has ever been pushed
  let line = -1;

  const wrap = h('div', 'g-voidcanvas');
  const queue = h('div', 'queue');
  const swatches = [0, 1, 2, 3, 4].map(() => queue.appendChild(h('i')));
  const canvas = h('div', 'canvas');
  canvas.innerHTML = artSvg();
  canvas.style.setProperty('--raid', String(RAID));
  const splat = h('i', 'splat');
  const bite = h('i', 'bite');
  const front = h('i', 'front');
  // Big words rise from the middle of the canvas, so they never cover the paint queue.
  const shout = h('i', 'shout');
  canvas.append(h('i', 'void'), h('i', 'omen'), bite, splat, front, shout);
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
    wrap.classList.toggle('full', held === COLS);
    const pct = Math.round((held / COLS) * 100);
    ours.textContent = `${pct}%`;
    theirs.textContent = `${100 - pct}%`;
  }
  show();

  /** The void takes up to `n` columns back, with a purple flash where they were. */
  function eat(n: number) {
    const took = Math.min(n, held);
    if (!took) return;
    held -= took;
    bite.style.left = `${held * 5}%`;
    bite.style.width = `${took * 5}%`;
    pulse(bite, 'go');
  }

  return {
    press(b, t) {
      if (t < lockedUntil) {
        // Still cooling down: the press is felt, but it neither paints nor restarts the clock.
        pulse(queue, 'shake');
        fx.sound('tick');
        return;
      }
      if (b !== want()) {
        lockedUntil = t + 400;
        wrap.classList.add('locked');
        pulse(queue, 'shake');
        bad(shout, 'COOLDOWN 5:00');
        return;
      }
      idx++;
      if (held < COLS) held++;
      // Nothing left to repaint: the right colour holds the wall and keeps the void out a beat longer,
      // so a painter in rhythm is never out of step with the queue.
      else nextBite = Math.max(nextBite, t + biteGap(COLS));
      splat.className = `splat c-${COLOR[b]}`;
      splat.style.left = `${(held - 1) * 5}%`;
      pulse(splat, 'go');
      good(splat);
      if (held === COLS && proud) {
        proud = false;
        fx.pop(shout, 'WE HELD THE LINE!', 'gold');
        fx.burst(canvas, 'gold', 26);
        fx.flash('gold');
        fx.sound('coin');
      }
      // One cheer on the way up, for painters who never reach the edge.
      if (held > best) {
        best = held;
        if (best === SMILEY) {
          fx.pop(shout, 'SMILEY SPOTTED!', 'gold');
          fx.burst(front, 'gold', 14);
          fx.sound('ding');
        }
      }
      show();
      // The next colour punches in, so two of the same in a row still read as a new prompt.
      pulse(swatches[0], 'next');
    },
    tick(t) {
      if (t >= lockedUntil) wrap.classList.remove('locked');
      const before = held;
      while (raid < raids.length && t >= raids[raid]) {
        raid++;
        eat(RAID);
        pulse(canvas, 'shake');
        fx.pop(shout, 'VOID RAID!', 'purple');
        fx.flash('purple');
        fx.shake();
        fx.sound('thud');
      }
      while (t >= nextBite) {
        eat(1);
        nextBite += biteGap(held);
      }
      if (held <= COLS - RAID) proud = true;
      if (held !== before) show();
      // The columns a raid is about to take flash purple first, and the chat calls it.
      const omen = raid < raids.length && t >= raids[raid] - OMEN;
      if (omen !== bracing) {
        bracing = omen;
        canvas.classList.toggle('brace', omen);
        if (omen) fx.sound('power');
      }
      const now = omen ? -2 : Math.floor(t / 1700) % chat.length;
      if (now !== line) {
        line = now;
        note.textContent = omen ? RAID_CHAT : chat[now];
        note.classList.toggle('alarm', omen);
      }
    },
    // One column of grace: the void always sneaks a bite in right at the bell.
    score: () => ratio(held, COLS - 1),
    hint: (t) => (t >= lockedUntil ? want() : null),
  };
};
