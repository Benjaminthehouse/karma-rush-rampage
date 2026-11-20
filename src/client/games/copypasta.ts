import './copypasta.css';
import { actor, COLOR, defineSprite, h, pulse, randBtn, ratio, setSprite, sprite, type Btn, type GameFactory } from './common';

// The pasta, one shape per colour so the order reads without colour too:
// red bow ties, green penne, blue shells.
defineSprite('copypasta-bow', `
kk......kk
kAk....kAk
kALk..kLAk
kALAkkALAk
kAAAaaAAAk
kAAAaaAAAk
kaAAkkAAak
kaak..kaak
kak....kak
kk......kk`);
defineSprite('copypasta-penne', `
......kkkk
.....kLLkk
....kLLAak
...kLLAak.
..kLLAak..
.kLLAak...
kLLAak....
kLAak.....
kkkk......
kk........`);
defineSprite('copypasta-shell', `
...kkkk...
.kkLLLLkk.
kLLkLLkLLk
kLAkAAkALk
kAAkAAkAAk
kAakAakaAk
kaakaakaak
.kaaaaaak.
..kaaaak..
...kkkk...`);
// The chef's tall white hat.
defineSprite('copypasta-hat', `
..kkkkkkkk..
.kwwWWwwwwk.
kwwWWwwwwwwk
kwwwwwwwwwdk
kwwwwwwwwwdk
.kwwwwwwwdk.
..kwwwwwwk..
..kdddddDk..
..kkkkkkkk..`);
const SHAPE = ['copypasta-bow', 'copypasta-penne', 'copypasta-shell'] as const;
const PX = 0.19; // one pasta pixel, in em: a piece is 1.9em

const PAGE = 21;

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 32 + level * 3;
  const seq: Btn[] = [];
  while (seq.length < PAGE * 5) {
    const b = randBtn(rng);
    // Never three of the same in a row, so it reads as a pattern rather than a mash.
    if (seq.length >= 2 && seq[seq.length - 1] === b && seq[seq.length - 2] === b) continue;
    seq.push(b);
  }
  let idx = 0;
  let lockedUntil = 0;
  let page = -1;
  let moodUntil = 0;

  // The kitchen: the chef's recipe laid out in pasta on a chopping board, read left to
  // right; each piece you paste flies into the pot on the stove next to Chef OP Cat.
  const wrap = h('div', 'g-copypasta scene-kitchen');
  const grid = h('div', 'pasta');
  const cells = Array.from({ length: PAGE }, () => {
    const c = h('div', 'cell');
    const piece = sprite(SHAPE[0], { tone: 'red', px: PX });
    c.append(piece);
    grid.append(c);
    return { c, piece };
  });
  const cook = h('div', 'cook');
  const chef = h('div', 'chef');
  const cat = actor('op', { px: 0.4 });
  chef.append(sprite('copypasta-hat', { px: 0.3 }, 'hat'), cat.el);
  const pot = h('div', 'pot');
  const flyer = sprite(SHAPE[0], { tone: 'red', px: 0.26 }, 'flyer');
  const water = h('i', 'water');
  const note = h('div', 'label');
  pot.append(flyer, water, h('i', 'handle l'), h('i', 'handle r'), note);
  const stove = h('i', 'stove');
  const station = h('div', 'station');
  station.append(pot, stove);
  cook.append(chef, station);
  wrap.append(grid, cook);
  root.append(wrap);

  function show() {
    const now = Math.floor(idx / PAGE);
    if (now !== page) {
      page = now;
      cells.forEach(({ piece }, i) => {
        const b = seq[page * PAGE + i];
        setSprite(piece, SHAPE[b], { tone: COLOR[b], px: PX });
      });
      pulse(grid, 'pop-in');
    }
    cells.forEach(({ c }, i) => {
      c.classList.toggle('done', page * PAGE + i < idx);
      c.classList.toggle('next', page * PAGE + i === idx);
    });
    note.textContent = `${idx} pasted`;
  }
  show();

  return {
    press(b, t) {
      if (idx >= seq.length || t < lockedUntil) return;
      if (b === seq[idx]) {
        good(cells[idx % PAGE].c);
        // That piece drops into the pot.
        setSprite(flyer, SHAPE[b], { tone: COLOR[b], px: 0.26 });
        pulse(flyer, 'drop');
        pulse(water, 'bump');
        cat.mood('happy');
        moodUntil = t + 400;
        idx++;
        if (idx % PAGE === 0) {
          fx.pop(grid, 'PASTE IT AGAIN!', 'gold');
          fx.burst(pot, 'gold', 16);
          fx.sound('coin');
        }
      } else {
        lockedUntil = t + 350;
        pulse(grid, 'shake');
        cat.mood('shock');
        moodUntil = t + 400;
        bad(cells[idx % PAGE].c);
      }
      show();
    },
    tick(t) {
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        cat.mood('idle');
      }
    },
    score: () => ratio(idx, par),
    hint: (t) => (idx < seq.length && t >= lockedUntil ? seq[idx] : null),
  };
};
