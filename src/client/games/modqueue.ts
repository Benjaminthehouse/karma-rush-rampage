import './modqueue.css';
import { COLOR, h, pick, pulse, randBtn, clamp1000, type GameFactory } from './common';

// 0 = spam (remove), 1 = wholesome (approve), 2 = flame war (lock)
const ITEMS: string[][] = [
  [
    'FREE KARMA!!! cl1ck here',
    'Buy 10k followers cheap',
    'I made $900/day from my couch',
    'Hot deals on totally real watches',
    'DM me for crypto secrets',
    'W1N a phone, just enter your password',
  ],
  [
    'My grandma finished her first 5k',
    'Adopted this old guy today',
    'I finally fixed my bike myself',
    'Thanks to whoever returned my wallet',
    'First loaf of bread, be gentle',
    'We planted 40 trees this weekend',
  ],
  [
    'no YOU are wrong, and here is why',
    'ACTUALLY it is pronounced gif',
    'pineapple on pizza is a crime',
    'ur opinion is bad and so are u',
    'tabs vs spaces, fight me',
    'this sub was better last year',
  ],
];
const TAG = ['SPAM', 'NICE', 'FIGHT'];
const DONE = ['REMOVED', 'APPROVED', 'LOCKED'];

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const par = 15 + level;
  const n = 34;
  const queue = Array.from({ length: n }, () => {
    const type = randBtn(rng);
    return { type, text: pick(rng, ITEMS[type]) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;

  const wrap = h('div', 'g-modqueue');
  const card = h('div', 'report');
  const tag = h('span', 'tag');
  const text = h('div', 'text');
  card.append(tag, text);
  const left = h('div', 'g-note');
  wrap.append(card, left);
  root.append(wrap);

  function show() {
    const q = queue[idx];
    if (!q) {
      card.className = 'report empty';
      tag.textContent = '';
      text.textContent = 'Queue clean. Nice modding.';
      left.textContent = '';
      return;
    }
    card.className = `report t-${q.type}`;
    pulse(card, 'pop-in');
    tag.textContent = TAG[q.type];
    text.textContent = q.text;
    left.textContent = `${right} handled`;
  }
  show();

  return {
    press(b) {
      const q = queue[idx];
      if (!q) return;
      if (b === q.type) {
        right++;
        good(card, DONE[b]);
      } else {
        wrong++;
        bad(card, 'WRONG CALL');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: () => queue[idx]?.type ?? null,
  };
};
