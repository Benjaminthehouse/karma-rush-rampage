import './poll.css';
import { COLOR, clamp1000, h, pulse, shuffled, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const par = level >= 2 ? 10 : 9;
  const n = 18;
  // The winner always leads by two or more: nobody can tell 9 from 8 at a glance.
  const margin = Math.max(2, 3 - Math.floor(level / 2));
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
    // Votes never sit on top of each other, so the count you see is the real one.
    // Spacing is in dot widths on the narrowest (phone) ballot: about 10 wide by 8 tall.
    const placed: { c: Btn; x: number; y: number }[] = [];
    for (const c of shuffled(rng, dots)) {
      let x = rng();
      let y = rng();
      for (let tries = 0; tries < 40 && placed.some((d) => Math.hypot((d.x - x) * 10, (d.y - y) * 8) < 1.2); tries++) {
        x = rng();
        y = rng();
      }
      placed.push({ c, x, y });
    }
    return { win, dots: placed };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-poll');
  const box = h('div', 'ballot');
  // Verdicts float up from the ballot's top edge, so they never cover the next poll's votes.
  const stamp = h('i', 'stamp');
  const note = h('div', 'g-note');
  wrap.append(box, note);
  root.append(wrap);

  function show() {
    box.replaceChildren(stamp);
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
        good(stamp, 'CALLED IT');
      } else {
        wrong++;
        lockedUntil = t + 500;
        bad(stamp, 'RECOUNT');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (polls[idx] && t >= lockedUntil ? polls[idx].win : null),
  };
};
