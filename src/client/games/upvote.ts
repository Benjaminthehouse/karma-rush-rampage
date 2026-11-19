import './upvote.css';
import { COLOR, arrow, h, pick, pulse, randBtn, ratio, type GameFactory } from './common';

const TITLES = [
  'My cat filed my taxes (correctly)',
  'TIL bananas are technically berries',
  'I built a keyboard out of soup cans',
  'Unpopular opinion: soup is a drink',
  'After 3 years, my sourdough finally rose',
  'Found this rock. Is it a good rock?',
  'LPT: label your leftovers',
  'My dog thinks the vacuum is his rival',
  'I mapped every bench in my town',
  'Showerthought: stairs are just angry floors',
];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // More posts than anyone can clear; 1000 points means hitting the par press count.
  const par = Math.round((duration / 1000) * (6.4 + level * 0.45));
  let prev = -1;
  const cards = Array.from({ length: 16 }, (_, i) => {
    let btn = randBtn(rng);
    while (btn === prev) btn = randBtn(rng);
    prev = btn;
    return { need: 5 + (i % 4) + Math.floor(level / 2), btn, title: pick(rng, TITLES) };
  });
  let idx = 0;
  let votes = 0;
  let banked = 0;
  let shown = -1;

  const wrap = h('div', 'g-upvote');
  const card = h('div', 'card');
  const arr = arrow('up');
  const body = h('div', 'body');
  const title = h('div', 'title');
  const meter = h('div', 'meter');
  const fill = h('i');
  const count = h('div', 'count');
  meter.append(fill);
  body.append(title, meter, count);
  card.append(arr, body);
  const left = h('div', 'g-note');
  wrap.append(card, left);
  root.append(wrap);

  function show() {
    const c = cards[idx];
    if (!c) {
      card.className = 'card done';
      title.textContent = 'Front page cleared!';
      count.textContent = '';
      left.textContent = '';
      return;
    }
    if (shown !== idx) {
      shown = idx;
      card.className = `card c-${COLOR[c.btn]}`;
      pulse(card, 'pop-in');
    }
    title.textContent = c.title;
    fill.style.width = `${(votes / c.need) * 100}%`;
    count.textContent = `${votes} / ${c.need}`;
    left.textContent = idx ? `${idx} on the front page` : 'Get it to the front page!';
  }
  show();

  return {
    press(b) {
      const c = cards[idx];
      if (!c) return;
      if (b !== c.btn) {
        votes = Math.max(0, votes - 2);
        show();
        pulse(card, 'shake');
        bad(arr, '-2');
        return;
      }
      votes++;
      pulse(arr, 'bump');
      good(arr);
      if (votes >= c.need) {
        banked += c.need;
        votes = 0;
        idx++;
        fx.pop(card, 'FRONT PAGE!', COLOR[c.btn]);
        fx.burst(card, COLOR[c.btn], 16);
        fx.sound('coin');
      }
      show();
    },
    tick() {},
    score: () => ratio(banked + votes, par),
    hint: () => cards[idx]?.btn ?? null,
  };
};
