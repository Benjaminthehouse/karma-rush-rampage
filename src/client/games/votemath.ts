import './votemath.css';
import { arrow, clamp1000, h, pulse, shuffled, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 8 + Math.floor(level / 2);
  const rounds = Array.from({ length: 16 }, () => {
    // Three different net scores; the gap between first and second shrinks each level.
    const gap = Math.max(1, 4 - level);
    const top = 4 + Math.floor(rng() * 5);
    const nets = shuffled(rng, [top, top - gap - Math.floor(rng() * 2), top - gap - 2 - Math.floor(rng() * 3)]);
    const posts = nets.map((net) => {
      const down = 1 + Math.floor(rng() * (3 + level));
      return { up: net + down, down, net };
    });
    return { posts, win: nets.indexOf(top) as Btn };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-votemath');
  const row = h('div', 'row');
  const cards = [0, 1, 2].map(() => {
    const card = h('div', 'card');
    const up = h('div', 'line up');
    const upN = h('b');
    up.append(arrow('up'), upN);
    const down = h('div', 'line down');
    const downN = h('b');
    down.append(arrow('down'), downN);
    card.append(up, down);
    row.append(card);
    return { card, upN, downN };
  });
  const note = h('div', 'g-note');
  wrap.append(row, note);
  root.append(wrap);

  function show() {
    const r = rounds[idx % rounds.length];
    cards.forEach((c, i) => {
      c.upN.textContent = String(r.posts[i].up);
      c.downN.textContent = String(r.posts[i].down);
    });
    pulse(row, 'pop-in');
    note.textContent = `${right} solved`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const r = rounds[idx % rounds.length];
      if (b === r.win) {
        right++;
        good(cards[b].card, `+${r.posts[b].net}`);
        fx.burst(cards[b].card, 'gold', 10);
      } else {
        wrong++;
        lockedUntil = t + 500;
        bad(cards[b].card, `ONLY +${r.posts[b].net}`);
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].win : null),
  };
};
