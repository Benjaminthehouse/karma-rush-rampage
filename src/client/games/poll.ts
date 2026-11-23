import './poll.css';
import { actor, COLOR, clamp1000, h, pulse, shuffled, type ActorMood, type Btn, type GameFactory } from './common';

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
  let moodUntil = 0;

  // Election night: the Mod Bear returning officer looks over one big glass ballot box
  // while poll workers drop the votes in. One box, so there is one question: which colour
  // is there the most of? (Three boxes, one over each button, read as three separate polls.)
  const wrap = h('div', 'g-poll scene-stage');
  const note = h('div', 'headline');
  const hall = h('div', 'hall');
  const back = h('div', 'back');
  const officer = actor('modbear', { mood: 'peep', px: 0.5 });
  officer.el.classList.add('officer');
  const workers = [actor('npc', { px: 0.2 }), actor('npc', { px: 0.2 })];
  back.append(workers[0].el, officer.el, workers[1].el);
  const row = h('div', 'boxes');
  const box = h('div', 'box');
  const glass = h('div', 'glass');
  const slip = h('i', 'slip');
  box.append(slip, h('i', 'lid'), glass);
  row.append(box);
  // Verdicts float up from the box's top edge, so they never cover the next poll's votes.
  const stamp = h('i', 'stamp');
  const closed = h('div', 'closed', 'POLLS CLOSED');
  hall.append(back, row, stamp, closed);
  wrap.append(note, hall);
  root.append(wrap);

  function react(m: ActorMood, t: number) {
    officer.mood(m);
    for (const w of workers) w.mood(m === 'angry' ? 'shock' : 'idle');
    moodUntil = t + 500;
  }

  function show() {
    glass.replaceChildren();
    const p = polls[idx];
    if (!p) {
      closed.classList.add('on');
      note.textContent = 'All polls called';
      return;
    }
    // Each vote is placed so the whole of it stays inside the chart's axes.
    for (const d of p.dots) {
      const dot = h('i', `dot c-${COLOR[d.c]}`);
      dot.style.left = `calc(2em + ${(d.x * 100).toFixed(1)}% - ${(d.x * 3).toFixed(2)}em)`;
      dot.style.top = `calc(1em + ${(d.y * 100).toFixed(1)}% - ${(d.y * 3).toFixed(2)}em)`;
      glass.append(dot);
    }
    pulse(glass, 'pop-in');
    pulse(slip, 'drop');
    pulse(back, 'bump');
    note.textContent = 'Which colour has the most?';
  }
  show();

  return {
    press(b, t) {
      const p = polls[idx];
      if (!p || t < lockedUntil) return;
      if (b === p.win) {
        right++;
        react('peep', t);
        for (const w of workers) w.mood('happy');
        good(stamp, 'CALLED IT');
      } else {
        wrong++;
        lockedUntil = t + 500;
        react('angry', t);
        bad(stamp, 'RECOUNT');
      }
      idx++;
      show();
    },
    tick(t) {
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        officer.mood('peep');
        for (const w of workers) w.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (polls[idx] && t >= lockedUntil ? polls[idx].win : null),
  };
};
