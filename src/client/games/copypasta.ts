import { COLOR, h, pulse, randBtn, ratio, type Btn, type GameFactory } from './common';

export const copypasta: GameFactory = ({ root, rng, level, good, bad }) => {
  const len = 14 + level * 2;
  const seq: Btn[] = [];
  while (seq.length < len) {
    const b = randBtn(rng);
    // Never three of the same in a row, so it reads as a pattern rather than a mash.
    if (seq.length >= 2 && seq[seq.length - 1] === b && seq[seq.length - 2] === b) continue;
    seq.push(b);
  }
  let idx = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-copypasta');
  const grid = h('div', 'pasta');
  const cells = seq.map((b) => {
    const c = h('i', `cell c-${COLOR[b]}`);
    grid.append(c);
    return c;
  });
  const note = h('div', 'g-note');
  wrap.append(grid, note);
  root.append(wrap);

  function show() {
    cells.forEach((c, i) => {
      c.classList.toggle('done', i < idx);
      c.classList.toggle('next', i === idx);
    });
    note.textContent = idx >= len ? 'Pasted!' : `${idx} / ${len}`;
  }
  show();

  return {
    press(b: Btn, t: number) {
      if (idx >= len || t < lockedUntil) return;
      if (b === seq[idx]) {
        idx++;
        if (idx === len) good();
      } else {
        lockedUntil = t + 350;
        pulse(grid, 'shake');
        bad();
      }
      show();
    },
    tick() {},
    score: () => ratio(idx, len),
  };
};
