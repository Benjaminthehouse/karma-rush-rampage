import './voidcanvas.css';
import { actor, COLOR, COLOR_NAME, defineSprite, h, padDots, pulse, randBtn, ratio, setSprite, shuffled, sprite, type ActorMood, type Btn, type GameFactory, type Tone } from './common';

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

// A paint bucket: the queue of colours to press, and what the extras on the scaffold carry.
defineSprite('voidcanvas-bucket', `
...kkkkkk...
..k......k..
.k........k.
kkkkkkkkkkkk
kLLAAAAAAAak
kkAkkkkkkAkk
.kAwAAAAAAk.
.kLwAAAAAak.
.kLAAAAAAak.
.kLAAAAAAak.
.kaaaaaaaak.
..kkkkkkkk..`);
// The hero's brush, dipped in the colour to press next.
defineSprite('voidcanvas-brush', `
..kk..
.kLAk.
.kLAk.
kLAAak
kAAAak
kkkkkk
kdddDk
kkkkkk
.knNk.
.knNk.
.knNk.
.knNk.
.knNk.
..kk..`);
// The void's ragged, glowing front edge, two of its pixels to one canvas pixel.
defineSprite('voidcanvas-edge', `
..kk
.kPk
.kPk
kpPk
.kPk
..kk
..Pk
.kPk
kpPk
kpPk
.kPk
..kk
...k
..kk
.kPk
kpPk
kPPk
.kPk
..kk
..Pk
.kPk
kpPk
.kPk
..kk
...k
..kk
.kPk
kpPk`);

const PX = 0.65 / 2; // one void-edge pixel in em: half a canvas pixel (the canvas is 13em wide)
const TONE: Tone[] = ['red', 'green', 'blue'];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The void bites harder the more canvas you hold, so every pace finds its own frontline
  // and only a fast painter can pin it against the edge. Tuned for people, who read each
  // colour before pressing: two presses a second holds about two thirds of the canvas
  // in the first round, three a second nearly 90%.
  const biteGap = (cols: number) => 1000 / (0.7 + level * 0.1 + 3 * (cols / COLS) ** 2);
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
  let nextBite = 900 + biteGap(held); // a breath to find the first colour
  let raid = 0;
  let bracing = false; // a raid is about to land
  let proud = true; // the big cheer fires once per comeback, not on every flicker at the edge
  let best = held; // furthest the line has ever been pushed
  let line = -1;
  // When each reaction ends: the painters cheer a hit, gasp at a miss, panic at a raid;
  // the troll grins when the void bites.
  let cheerUntil = 0;
  let raidUntil = 0;
  let biteUntil = 0;
  let locked = false;

  // The scene: a rooftop at night. Painters on a scaffold defend their pixel art while the
  // void creeps in from the right with a troll grinning inside it.
  const wrap = h('div', 'g-voidcanvas scene-night');

  // The paint queue: a row of buckets, the big one first is the colour to press now.
  const queue = h('div', 'queue');
  const now = h('div', 'now');
  const nowBucket = sprite('voidcanvas-bucket', { tone: 'red', px: 0.22 });
  const label = h('b', 'label');
  const name = h('span');
  const dots = h('span', 'dots');
  label.append(name, dots);
  now.append(nowBucket, label);
  const later = [1, 2, 3, 4].map((i) => sprite('voidcanvas-bucket', { tone: 'red', px: 0.15 }, `later l${i}`));
  queue.append(now, ...later);

  // The canvas: the art underneath, the void sliding over its right-hand side.
  const canvas = h('div', 'canvas');
  const art = h('div', 'art');
  art.innerHTML = artSvg();
  const voidEl = h('div', 'void');
  const edge = sprite('voidcanvas-edge', { px: PX }, 'edge');
  const troll = actor('troll', { px: 0.17 });
  troll.el.classList.add('troll');
  voidEl.append(edge, troll.el);
  const omenEl = h('i', 'omen');
  const bite = h('i', 'bite');
  art.append(voidEl, omenEl, bite);
  const splat = h('i', 'splat');
  const front = h('i', 'front');
  // Big words rise from the middle of the canvas, so they never cover the paint queue.
  const shout = h('i', 'shout');
  canvas.append(art, splat, front, shout);

  // The scaffold in front of the canvas: the hero painter with a brush, two helpers with buckets.
  const crew = h('div', 'crew');
  const helper = actor('npc', { px: 0.18 });
  const hero = actor('op', { px: 0.29 });
  const watcher = actor('lurker', { px: 0.18 });
  const brush = sprite('voidcanvas-brush', { tone: 'red', px: 0.2 }, 'brush');
  const pail = sprite('voidcanvas-bucket', { tone: 'gold', px: 0.13 }, 'pail');
  const pail2 = sprite('voidcanvas-bucket', { tone: 'purple', px: 0.13 }, 'pail');
  const left = h('div', 'mate');
  left.append(helper.el, pail);
  const mid = h('div', 'mate hero');
  mid.append(hero.el, brush);
  const right = h('div', 'mate');
  right.append(watcher.el, pail2);
  crew.append(left, mid, right);
  // The plank they stand on doubles as the score board.
  const plank = h('div', 'plank');
  const ours = h('b', 'ours');
  const theirs = h('b', 'theirs');
  const l = h('span');
  const r = h('span');
  l.append(ours, ' CANVAS');
  r.append('VOID ', theirs);
  plank.append(l, r);
  const scaffold = h('div', 'scaffold');
  scaffold.append(crew, plank);

  const note = h('div', 'g-note');
  wrap.append(queue, canvas, scaffold, note);
  root.append(wrap);

  const want = () => seq[idx % seq.length];
  // Bars a raid will eat, and the flash where the void bit: one canvas column wide, slid and stretched.
  const span = (el: HTMLElement, x: number, w: number) => {
    el.style.translate = `${x * 100}% 0`;
    el.style.scale = `${w} 1`;
  };

  function show() {
    const b0 = want();
    setSprite(nowBucket, 'voidcanvas-bucket', { tone: TONE[b0], px: 0.22 });
    setSprite(brush, 'voidcanvas-brush', { tone: TONE[b0], px: 0.2 });
    now.className = `now c-${COLOR[b0]}`;
    name.textContent = COLOR_NAME[b0];
    dots.replaceChildren(padDots(b0));
    later.forEach((s, i) => setSprite(s, 'voidcanvas-bucket', { tone: TONE[seq[(idx + i + 1) % seq.length]], px: 0.15 }));
    front.className = `front c-${COLOR[b0]}`;
    front.style.translate = `${held * 100}% 0`;
    voidEl.style.translate = `${held * 5}% 0`;
    // Shoved into the last few columns, the troll ducks out of sight.
    troll.el.classList.toggle('gone', held > COLS - 4);
    span(omenEl, Math.max(0, held - RAID), Math.min(RAID, held));
    wrap.classList.toggle('full', held === COLS);
    const pct = Math.round((held / COLS) * 100);
    ours.textContent = `${pct}%`;
    theirs.textContent = `${100 - pct}%`;
  }
  show();

  /** The void takes up to `n` columns back, with a purple flash where they were. */
  function eat(n: number, t: number) {
    const took = Math.min(n, held);
    if (!took) return;
    held -= took;
    biteUntil = t + 260;
    span(bite, held, took);
    pulse(bite, 'go');
  }

  function moods(t: number) {
    const panic = bracing || t < raidUntil;
    const oops = t < lockedUntil;
    const cheer = t < cheerUntil;
    const won = held === COLS;
    const m = (a: ActorMood, b: ActorMood, c: ActorMood, d: ActorMood, e: ActorMood) => (panic ? a : oops ? b : cheer ? c : won ? d : e);
    hero.mood(m('shock', 'shock', 'happy', 'cool', 'idle'));
    helper.mood(m('sad', 'shock', 'happy', 'happy', 'idle'));
    watcher.mood(m('shock', 'shock', 'wink', 'cool', 'idle'));
    troll.mood(panic || t < biteUntil ? 'happy' : cheer ? 'angry' : 'idle');
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
        lockedUntil = t + 350;
        locked = true;
        wrap.classList.add('locked');
        pulse(queue, 'shake');
        pulse(mid, 'shake');
        bad(shout, 'COOLDOWN 5:00');
        moods(t);
        return;
      }
      idx++;
      if (held < COLS) held++;
      // Nothing left to repaint: the right colour holds the wall and keeps the void out a beat longer,
      // so a painter in rhythm is never out of step with the queue.
      else nextBite = Math.max(nextBite, t + biteGap(COLS));
      cheerUntil = t + 380;
      splat.className = `splat c-${COLOR[b]}`;
      splat.style.translate = `${(held - 1) * 100}% 0`;
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
      // The next bucket punches in and the hero swings the brush, so two of the same colour
      // in a row still read as a new prompt.
      pulse(now, 'next');
      pulse(mid, 'bump');
      moods(t);
    },
    tick(t) {
      if (locked && t >= lockedUntil) {
        locked = false;
        wrap.classList.remove('locked');
      }
      const before = held;
      while (raid < raids.length && t >= raids[raid]) {
        raid++;
        eat(RAID, t);
        raidUntil = t + 700;
        pulse(canvas, 'shake');
        pulse(crew, 'shake');
        fx.pop(shout, 'VOID RAID!', 'purple');
        fx.flash('purple');
        fx.shake();
        fx.sound('thud');
      }
      while (t >= nextBite) {
        eat(1, t);
        nextBite += biteGap(held);
      }
      if (held <= COLS - RAID) proud = true;
      if (held !== before) show();
      // The columns a raid is about to take flash purple first, and the chat calls it.
      const omen = raid < raids.length && t >= raids[raid] - OMEN;
      if (omen !== bracing) {
        bracing = omen;
        wrap.classList.toggle('brace', omen);
        if (omen) fx.sound('power');
      }
      moods(t);
      const cur = omen ? -2 : Math.floor(t / 1700) % chat.length;
      if (cur !== line) {
        line = cur;
        note.textContent = omen ? RAID_CHAT : chat[cur];
        note.classList.toggle('alarm', omen);
      }
    },
    // One column of grace: the void always sneaks a bite in right at the bell.
    score: () => ratio(held, COLS - 1),
    hint: (t) => (t >= lockedUntil ? want() : null),
  };
};
