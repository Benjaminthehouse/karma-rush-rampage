import { COLOR, arrow, h, pick, pulse, randBtn, ratio, type Btn, type GameFactory } from './common';

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

export const upvote: GameFactory = ({ root, rng, level, good, bad }) => {
  const needs = [5, 7, 8, 9].map((n) => n + Math.floor(level / 2));
  const cards = needs.map((need) => ({ need, btn: randBtn(rng), title: pick(rng, TITLES) }));
  const total = needs.reduce((a, b) => a + b, 0);
  let idx = 0;
  let votes = 0;
  let banked = 0;

  const wrap = h('div', 'g-upvote');
  const card = h('div', 'post-card');
  const arr = arrow('up');
  const body = h('div', 'post-body');
  const title = h('div', 'post-title');
  const meter = h('div', 'meter');
  const fill = h('i');
  const count = h('div', 'post-count');
  meter.append(fill);
  body.append(title, meter, count);
  card.append(arr, body);
  const left = h('div', 'g-note');
  wrap.append(card, left);
  root.append(wrap);

  let shown = -1;
  function show() {
    const c = cards[idx];
    if (!c) {
      card.className = 'post-card done';
      title.textContent = 'Front page cleared!';
      count.textContent = '';
      left.textContent = '';
      return;
    }
    if (shown !== idx) {
      shown = idx;
      card.className = `post-card c-${COLOR[c.btn]}`;
      pulse(card, 'pop-in');
    }
    title.textContent = c.title;
    fill.style.width = `${(votes / c.need) * 100}%`;
    count.textContent = `${votes} / ${c.need}`;
    left.textContent = `${cards.length - idx} post${cards.length - idx === 1 ? '' : 's'} to go`;
  }
  show();

  return {
    press(b: Btn) {
      const c = cards[idx];
      if (!c) return;
      if (b === c.btn) {
        votes++;
        pulse(arr, 'bump');
        if (votes >= c.need) {
          banked += c.need;
          votes = 0;
          idx++;
          good();
        }
      } else {
        votes = Math.max(0, votes - 2);
        show();
        pulse(card, 'shake');
        bad();
        return;
      }
      show();
    },
    tick() {},
    score: () => ratio(banked + votes, total),
  };
};
