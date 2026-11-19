import './votemath.css';
import { arrow, clamp1000, h, pulse, shuffled, type Btn, type GameFactory } from './common';

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

  const wrap = h('div', 'g-votemath');
  const row = h('div', 'row');
  const cards = [0, 1, 2].map(() => {
    const card = h('div', 'card');
    const pin = h('i', 'pin'); // feedback floats up from the card's top edge, clear of the next numbers
    const up = h('div', 'line up');
    const upN = h('b');
    up.append(arrow('up'), upN);
    const down = h('div', 'line down');
    const downN = h('b');
    down.append(arrow('down'), downN);
    card.append(pin, up, down);
    row.append(card);
    return { card, pin, upN, downN };
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
        good(cards[b].pin, `+${r.posts[b].net}`);
        fx.burst(cards[b].card, 'gold', 10);
      } else {
        wrong++;
        lockedUntil = t + 500;
        const net = r.posts[b].net;
        bad(cards[b].pin, `ONLY ${net > 0 ? '+' : ''}${net}`);
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].win : null),
  };
};
