import { COLOR, h, pulse, shuffled, type Btn, type GameFactory } from './common';

export const poll: GameFactory = ({ root, rng, level, good, bad }) => {
  const n = level >= 3 ? 5 : 4;
  const margin = Math.max(1, 3 - Math.floor(level / 2));
  const polls = Array.from({ length: n }, () => {
    const [win, a, b] = shuffled(rng, [0, 1, 2] as Btn[]);
    const top = 6 + Math.floor(rng() * 4);
    const counts = [0, 0, 0];
    counts[win] = top;
    counts[a] = top - margin - Math.floor(rng() * 2);
    counts[b] = Math.max(1, top - margin - Math.floor(rng() * 4));
    const dots: Btn[] = [];
    counts.forEach((c, colour) => {
      for (let i = 0; i < c; i++) dots.push(colour as Btn);
    });
    return { win, dots: shuffled(rng, dots).map((c) => ({ c, x: rng(), y: rng() })) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-poll');
  const box = h('div', 'ballot');
  const note = h('div', 'g-note');
  wrap.append(box, note);
  root.append(wrap);

  function show() {
    box.replaceChildren();
    const p = polls[idx];
    if (!p) {
      box.append(h('div', 'ballot-done', 'Polls closed!'));
      note.textContent = '';
      return;
    }
    for (const d of p.dots) {
      const dot = h('i', `dot c-${COLOR[d.c]}`);
      dot.style.left = `${6 + d.x * 88}%`;
      dot.style.top = `${8 + d.y * 84}%`;
      box.append(dot);
    }
    pulse(box, 'pop-in');
    note.textContent = `Poll ${idx + 1} of ${n} — most votes?`;
  }
  show();

  return {
    press(b: Btn, t: number) {
      const p = polls[idx];
      if (!p || t < lockedUntil) return;
      if (b === p.win) {
        right++;
        good();
      } else {
        wrong++;
        lockedUntil = t + 500;
        pulse(wrap, 'shake');
        bad();
      }
      idx++;
      show();
    },
    tick() {},
    score: () => Math.max(0, Math.round((1000 * (right - wrong / 2)) / n)),
  };
};
