import './copypasta.css';
import { COLOR, h, pulse, randBtn, ratio, type Btn, type GameFactory } from './common';

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

  const wrap = h('div', 'g-copypasta');
  const grid = h('div', 'pasta');
  const cells = Array.from({ length: PAGE }, () => {
    const c = h('i', 'cell');
    grid.append(c);
    return c;
  });
  const note = h('div', 'g-note');
  wrap.append(grid, note);
  root.append(wrap);

  function show() {
    const now = Math.floor(idx / PAGE);
    if (now !== page) {
      page = now;
      cells.forEach((c, i) => (c.className = `cell c-${COLOR[seq[page * PAGE + i]]}`));
      pulse(grid, 'pop-in');
    }
    cells.forEach((c, i) => {
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
        good(cells[idx % PAGE]);
        idx++;
        if (idx % PAGE === 0) {
          fx.pop(grid, 'PASTE IT AGAIN!', 'gold');
          fx.sound('coin');
        }
      } else {
        lockedUntil = t + 350;
        pulse(grid, 'shake');
        bad(cells[idx % PAGE]);
      }
      show();
    },
    tick() {},
    score: () => ratio(idx, par),
    hint: (t) => (idx < seq.length && t >= lockedUntil ? seq[idx] : null),
  };
};
