import './modqueue.css';
import { actor, COLOR, defineSprite, h, padDots, postCard, pulse, randBtn, shuffled, clamp1000, sprite, type Btn, type GameFactory } from './common';

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
const USERS = ['deal_bot_9', 'kind_stranger', 'well_actually', 'new_acct_77', 'bread_mom', 'hot_take_hq', 'tree_hugger', 'reply_guy'];

// A rubber stamp: wooden handle, inked pad in the button's colour.
defineSprite('modqueue-stamp', `
....kkkk....
...knnnnk...
...knnNnk...
....kNNk....
....knnk....
....knnk....
..kkkkkkkk..
.kLAAAAAAAk.
.kaaaaaaaak.
..kkkkkkkk..`);

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const par = 15 + level;
  const n = 34;
  // Each kind is dealt from its own shuffled pile, so the same report never
  // comes up twice running (that reads as "my press did nothing").
  const piles = ITEMS.map((list) => shuffled(rng, list));
  const dealt = [0, 0, 0];
  const queue = Array.from({ length: n }, () => {
    const type = randBtn(rng);
    return { type, text: piles[type][dealt[type]++ % piles[type].length] };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let calmAt = 0;

  // The scene: the mod office. Mod Bear sits at the desk with three rubber stamps;
  // reported posts roll in on a conveyor belt and get stamped and carried off.
  const wrap = h('div', 'g-modqueue scene-office');
  const top = h('div', 'top');
  const bear = actor('modbear', { mood: 'peep', px: 0.42 });
  bear.el.classList.add('mod');
  const desk = h('div', 'desk');
  const stamps = COLOR.map((c, i) => {
    const s = h('div', `tool c-${c}`);
    s.append(sprite('modqueue-stamp', { tone: c, px: 0.26 }), padDots(i as Btn));
    desk.append(s);
    return s;
  });
  top.append(bear.el, desk);

  const line = h('div', 'line');
  const slot = h('div', 'slot');
  const card = postCard({ sub: 'r/modqueue', user: USERS[0], title: '' });
  const sticker = h('div', 'sticker');
  const ink = h('div', 'ink');
  card.el.append(sticker, ink);
  slot.append(card.el);
  const belt = h('div', 'belt');
  const rollers = h('i', 'rollers');
  belt.append(rollers);
  // Verdicts float up from just above the card, so the last one never covers the next report.
  const stamp = h('i', 'stamp');
  line.append(slot, belt, stamp);
  const left = h('div', 'note');
  wrap.append(top, line, left);
  root.append(wrap);
  let gone: HTMLElement | null = null;

  function show() {
    const q = queue[idx];
    if (!q) {
      card.el.classList.add('empty');
      card.set({ sub: 'r/modqueue', user: '', title: 'Queue clean. Nice modding.' });
      sticker.replaceChildren();
      sticker.className = 'sticker';
      left.textContent = `${right} handled`;
      return;
    }
    card.tone(COLOR[q.type]);
    card.set({ user: USERS[idx % USERS.length], title: q.text, comments: (idx * 7) % 40 });
    card.votes(q.type === 0 ? 0 : 1 + ((idx * 13) % 90));
    sticker.className = `sticker c-${COLOR[q.type]}`;
    sticker.replaceChildren(h('span', '', TAG[q.type]), padDots(q.type));
    pulse(slot, 'g-modqueue-in');
    left.textContent = `${right} handled`;
  }
  show();

  // The stamped post is copied and carried off down the belt while the next rolls in.
  function carryOff(b: Btn, ok: boolean) {
    ink.textContent = DONE[b];
    ink.className = `ink c-${COLOR[b]}${ok ? '' : ' botched'}`;
    gone?.remove();
    gone = card.el.cloneNode(true) as HTMLElement;
    gone.classList.add('gone');
    line.append(gone);
    ink.className = 'ink';
    ink.textContent = '';
  }

  return {
    press(b, t) {
      const q = queue[idx];
      if (!q) return;
      pulse(stamps[b], 'slam');
      pulse(rollers, 'spin');
      carryOff(b, b === q.type);
      if (b === q.type) {
        right++;
        pulse(bear.el, 'bump');
        good(stamp, DONE[b]);
      } else {
        wrong++;
        bear.mood('angry');
        calmAt = t + 400;
        pulse(bear.el, 'shake');
        bad(stamp, 'WRONG CALL');
      }
      idx++;
      show();
    },
    tick(t) {
      if (calmAt && t >= calmAt) {
        calmAt = 0;
        bear.mood('peep');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: () => queue[idx]?.type ?? null,
  };
};
