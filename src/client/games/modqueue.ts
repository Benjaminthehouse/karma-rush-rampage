import { h, pick, pulse, randBtn, type Btn, type GameFactory } from './common';

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

export const modqueue: GameFactory = ({ root, rng, level, good, bad }) => {
  const n = 8 + Math.floor(level / 2);
  const queue = Array.from({ length: n }, () => {
    const type = randBtn(rng);
    return { type, text: pick(rng, ITEMS[type]) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;

  const wrap = h('div', 'g-modqueue');
  const card = h('div', 'report');
  const tag = h('span', 'report-tag');
  const text = h('div', 'report-text');
  card.append(tag, text);
  const stamp = h('div', 'stamp');
  const left = h('div', 'g-note');
  wrap.append(card, stamp, left);
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
    left.textContent = `${n - idx} in queue`;
  }
  show();

  return {
    press(b: Btn) {
      const q = queue[idx];
      if (!q) return;
      const ok = b === q.type;
      if (ok) {
        right++;
        good();
      } else {
        wrong++;
        bad();
      }
      stamp.textContent = ok ? DONE[b] : 'WRONG CALL';
      stamp.className = `stamp ${ok ? `s-${b}` : 's-bad'}`;
      pulse(stamp, 'stamp-in');
      idx++;
      show();
    },
    tick() {},
    score: () => Math.max(0, Math.round((1000 * (right - wrong / 2)) / n)),
  };
};
