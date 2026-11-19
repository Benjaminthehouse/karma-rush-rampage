import './poll.css';
import { COLOR, clamp1000, h, pulse, shuffled, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const par = level >= 2 ? 10 : 9;
  const n = 18;
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
      box.append(h('div', 'closed', 'Polls closed!'));
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
    note.textContent = `Poll ${idx + 1} — most votes?`;
  }
  show();

  return {
    press(b, t) {
      const p = polls[idx];
      if (!p || t < lockedUntil) return;
      if (b === p.win) {
        right++;
        good(box, 'CALLED IT');
      } else {
        wrong++;
        lockedUntil = t + 500;
        bad(box, 'RECOUNT');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (polls[idx] && t >= lockedUntil ? polls[idx].win : null),
  };
};
