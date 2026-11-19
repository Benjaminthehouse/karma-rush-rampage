import './crosspost.css';
import { COLOR, clamp1000, h, pick, pulse, type Btn, type GameFactory } from './common';

const PAIRS: Btn[][] = [
  [0, 1],
  [1, 2],
  [0, 2],
];
const POSTS = [
  'Cat discovers stairs',
  'I drew my lunch',
  'Is this rock a meteorite?',
  'Bird stole my sandwich',
  'My plant finally bloomed',
  'Look at this weird cloud',
  'Dog wearing tiny shoes',
  'I fixed it with tape',
];
const WINDOW = 140; // ms allowed between the presses of one chord

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 16 + level;
  let last = -1;
  const prompts = Array.from({ length: 48 }, () => {
    // Later rounds sometimes light all three.
    if (level >= 2 && rng() < 0.12 + level * 0.04 && last !== 3) {
      last = 3;
      return { lit: [0, 1, 2] as Btn[], text: pick(rng, POSTS) };
    }
    let i = Math.floor(rng() * 3);
    while (i === last) i = Math.floor(rng() * 3);
    last = i;
    return { lit: PAIRS[i], text: pick(rng, POSTS) };
  });
  let idx = 0;
  let done = 0;
  let wrong = 0;
  let pending: Btn[] = [];
  let firstAt = 0;

  const wrap = h('div', 'g-crosspost');
  const post = h('div', 'post');
  const subs = h('div', 'subs');
  const tiles = [0, 1, 2].map((i) => {
    const t = h('div', `sub c-${COLOR[i]}`, ['r/RED', 'r/GREEN', 'r/BLUE'][i]);
    subs.append(t);
    return t;
  });
  const note = h('div', 'g-note');
  wrap.append(post, subs, note);
  root.append(wrap);

  function show() {
    const p = prompts[idx % prompts.length];
    post.textContent = p.text;
    pulse(post, 'pop-in');
    tiles.forEach((t, i) => {
      t.classList.toggle('lit', p.lit.includes(i as Btn));
      t.classList.remove('half');
    });
    note.textContent = `${done} crossposted`;
  }
  show();

  function miss(word: string, at: HTMLElement) {
    wrong++;
    pending = [];
    tiles.forEach((t) => t.classList.remove('half'));
    bad(at, word);
  }

  return {
    press(b, t) {
      const lit = prompts[idx % prompts.length].lit;
      if (!lit.includes(b)) return miss('NOT THAT SUB', tiles[b]);
      if (pending.includes(b)) return;
      if (!pending.length) firstAt = t;
      pending.push(b);
      tiles[b].classList.add('half');
      if (pending.length < lit.length) return;
      pending = [];
      done++;
      idx++;
      good(post, lit.length === 3 ? 'EVERYWHERE!' : 'X-POSTED');
      if (lit.length === 3) fx.burst(subs, 'gold', 18);
      show();
    },
    tick(t) {
      if (pending.length && t - firstAt > WINDOW) miss('TOGETHER!', tiles[pending[0]]);
    },
    score: () => clamp1000((1000 * (done - wrong)) / par),
    hint: () => (pending.length ? null : prompts[idx % prompts.length].lit),
  };
};
