import './votemath.css';
import { actor, clamp1000, COLOR, h, pulse, shuffled, sprite, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Closer scores take a person longer to work out, so the par drops as the level rises: 8 8 7 6 5.
  const par = 8 - Math.floor((level * 3) / 4);
  // Winning columns are dealt from a balanced deck, so no single button is right most of the time.
  const deck = shuffled(rng, Array.from({ length: 16 }, (_, i) => (i % 3) as Btn));
  const rounds = deck.map((win) => {
    // Three different net scores; the gap between first and second shrinks each level.
    const gap = Math.max(1, 4 - level);
    const top = 4 + Math.floor(rng() * 5);
    const nets = shuffled(rng, [top - gap - Math.floor(rng() * 2), top - gap - 2 - Math.floor(rng() * 3)]);
    nets.splice(win, 0, top);
    // One post is controversial: unless it is the winner it gets a pile of extra votes both ways,
    // so the most-upvoted post is not always the answer. Upvotes never drop below zero.
    const hot = Math.floor(rng() * 3);
    const posts = nets.map((net, i) => {
      const down = Math.max(-net, 1 + Math.floor(rng() * (3 + level)) + (i === hot && net !== top ? gap + 1 : 0));
      return { up: net + down, down, net };
    });
    return { posts, win };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;
  let calmAt = 0;

  // The scene: a classroom. AutoMod teaches at the chalkboard; three posts are pinned to it
  // with coloured magnets (left, middle, right), each with its up and down tally.
  const wrap = h('div', 'g-votemath scene-office');
  const board = h('div', 'board');
  const sum = h('div', 'sum');
  sum.append(sprite('up', { tone: 'green', px: 0.1 }), h('span', '', 'minus'), sprite('up', { tone: 'purple', flipY: true, px: 0.1 }), h('span', '', '= ?'));
  const row = h('div', 'row');
  const cards = [0, 1, 2].map((i) => {
    const card = h('div', 'card');
    const pin = h('i', `magnet c-${COLOR[i]}`); // feedback floats up from the magnet, clear of the next numbers
    const up = h('div', 'line up');
    const upN = h('b');
    up.append(sprite('up', { tone: 'green', px: 0.13 }), upN);
    const down = h('div', 'line down');
    const downN = h('b');
    down.append(sprite('up', { tone: 'purple', flipY: true, px: 0.13 }), downN);
    card.append(pin, up, down);
    row.append(card);
    return { card, pin, upN, downN };
  });
  board.append(sum, row);
  const front = h('div', 'front');
  const teacher = actor('automod', { mood: 'talk', px: 0.4 });
  teacher.el.classList.add('teacher');
  const note = h('div', 'note');
  front.append(teacher.el, note);
  wrap.append(board, front);
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
      pulse(cards[b].card, 'bump');
      calmAt = t + 400;
      if (b === r.win) {
        right++;
        teacher.mood('happy');
        good(cards[b].pin, `+${r.posts[b].net}`);
        fx.burst(cards[b].card, 'gold', 10);
      } else {
        wrong++;
        lockedUntil = t + 500;
        teacher.mood('angry');
        pulse(teacher.el, 'shake');
        const net = r.posts[b].net;
        bad(cards[b].pin, `ONLY ${net > 0 ? '+' : ''}${net}`);
      }
      idx++;
      show();
    },
    tick(t) {
      if (calmAt && t >= calmAt) {
        calmAt = 0;
        teacher.mood('talk');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].win : null),
  };
};
