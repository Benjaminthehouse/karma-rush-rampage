import './doomscroll.css';
import { COLOR, h, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

const POSTS = [
  'You won’t believe this',
  'Day 412 of posting this',
  'Thread (1/87)',
  'BREAKING: nothing happened',
  'Hot take incoming',
  'This you?',
  'Update: still scrolling',
  'It’s 3am, one more',
  'Ratio + you fell off',
  'Wait, read this',
];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The par climbs gently: later rounds flip far more often, and every flip costs a person a beat.
  const par = Math.round((duration / 1000) * (6.8 + level * 0.25));
  // The roll direction flips after each run of posts; later rounds flip more often.
  const runs: number[] = [];
  for (let i = 0; i < 40; i++) runs.push(Math.max(4, 12 - level * 2 + Math.floor(rng() * 5)));
  const posts = shuffled(rng, POSTS); // dealt in order, so the feed never shows a post twice at once
  const texts = posts.slice(0, 6);
  let dealt = texts.length;
  let run = 0;
  let leftInRun = runs[0];
  let dir = 1; // 1 = red → green → blue, -1 = blue → green → red
  let expect: Btn = 0;
  let rolled = 0;
  let lockedUntil = 0;
  // Nobody reverses a drum roll on the very next beat: right after a flip, the pad
  // the old direction wanted is ignored instead of buzzed.
  let slipBtn = -1;
  let slipUntil = 0;

  const wrap = h('div', 'g-doomscroll');
  const order = h('div', 'order');
  const chips = [0, 1, 2].map((i) => h('i', `c-${COLOR[i]}`));
  const way = h('b', 'way');
  order.append(chips[0], chips[1], chips[2], way);
  const phone = h('div', 'phone');
  const cards = texts.map(() => {
    const c = h('div', 'card');
    phone.append(c);
    return c;
  });
  const note = h('div', 'g-note');
  wrap.append(order, phone, note);
  root.append(wrap);

  function show() {
    order.classList.toggle('back', dir < 0);
    way.textContent = dir > 0 ? '→' : '←';
    chips.forEach((c, i) => c.classList.toggle('next', i === expect));
    // The post whose scroll flips the direction is gold, so the flip is seen climbing the feed.
    cards.forEach((c, i) => {
      const flip = i === leftInRun - 1;
      c.className = flip ? 'card flip' : 'card';
      c.textContent = flip ? 'FLIP HERE' : texts[i];
    });
    note.textContent = `${rolled} posts scrolled`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      if (b !== expect) {
        if (b === slipBtn && t < slipUntil) return;
        lockedUntil = t + 300;
        phone.classList.remove('g-doomscroll-roll'); // its animation would override the shake
        pulse(phone, 'shake');
        bad(chips[expect], 'THUMB SLIPPED');
        return;
      }
      rolled++;
      good(chips[b]);
      // Recycle the top card to the bottom, with the next post, so the feed never ends.
      const top = cards.shift()!;
      phone.append(top);
      cards.push(top);
      texts.shift();
      texts.push(posts[dealt++ % posts.length]);
      pulse(phone, 'g-doomscroll-roll');
      if (--leftInRun <= 0) {
        run++;
        leftInRun = runs[run % runs.length];
        slipBtn = (b + dir + 3) % 3;
        slipUntil = t + 300;
        dir = -dir;
        fx.pop(order, dir > 0 ? 'ROLL RIGHT!' : 'ROLL LEFT!', 'gold');
        fx.sound('whoosh');
        expect = b; // the flip restarts from the pad you are already on
      }
      expect = (((expect + dir) % 3) + 3) % 3 as Btn;
      show();
    },
    tick() {},
    score: () => ratio(rolled, par),
    hint: (t) => (t >= lockedUntil ? expect : null),
  };
};
