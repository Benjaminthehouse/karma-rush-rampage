import './crosspost.css';
import { actor, COLOR, clamp1000, defineSprite, h, person, pick, pulse, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// The pitched roof on each community house.
defineSprite('crosspost-roof', `
......kkkk......
....kknnnnkk....
..kknnnnnnnnkk..
kknnnnnnnnnnnnkk
kNNNNNNNNNNNNNNk
kkkkkkkkkkkkkkkk`);
const PX = 0.36; // one art pixel of a house roof, in em: each house is about 5.8em wide
const SUBS = ['r/RED', 'r/GREEN', 'r/BLUE'];

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
  // Always exactly two lit: the shout says BOTH, and three at once cannot be
  // pressed with two thumbs on a phone (the prompt would never clear).
  const prompts = Array.from({ length: 48 }, () => {
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
  let deaf = 0; // presses are ignored until then, so one fumbled chord costs one miss, not two

  // The scene: feed street. OP Cat stands up top holding the post; below, three community
  // houses with red, green and blue doors. The houses whose windows are lit want the post.
  const wrap = h('div', 'g-crosspost scene-street');
  const top = h('div', 'top');
  const op = actor('op', { px: 0.42 });
  const parcel = h('div', 'parcel');
  const env = sprite('envelope', { px: 0.2 }, 'env');
  const post = h('div', 'post');
  parcel.append(env, post);
  top.append(op.el, parcel);
  const note = h('div', 'tally');
  const subs = h('div', 'subs');
  const houses = [0, 1, 2].map((i) => {
    const house = h('div', `house c-${COLOR[i]}`);
    house.style.width = `${16 * PX}em`;
    const roof = sprite('crosspost-roof', { px: PX }, 'roof');
    const wall = h('div', 'wall');
    const win = h('div', 'win');
    const fan = person({ tone: (['red', 'green', 'blue'] as const)[i], px: 0.14, mood: 'happy' });
    fan.el.classList.add('fan');
    win.append(fan.el);
    const sign = h('div', 'sign', SUBS[i]);
    const door = h('div', 'door');
    const leaf = h('i', 'leaf');
    door.append(leaf);
    const mail = sprite('envelope', { px: 0.16 }, 'mail');
    // An upstairs pair of windows: only shows when the stage is tall enough to have the room.
    const attic = h('div', 'attic');
    attic.append(h('i'), h('i'));
    wall.append(attic, win, sign, door, mail);
    house.append(roof, wall);
    subs.append(house);
    return { house, mail, fan };
  });
  const tiles = houses.map((x) => x.house);
  wrap.append(top, note, subs);
  root.append(wrap);
  let moodUntil = 0;
  let calm = true;
  function face(m: ActorMood, t: number) {
    op.mood(m);
    moodUntil = t + 350;
    calm = false;
  }

  function show() {
    const p = prompts[idx % prompts.length];
    post.textContent = p.text;
    pulse(parcel, 'pop-in');
    tiles.forEach((t, i) => {
      t.classList.toggle('lit', p.lit.includes(i as Btn));
      t.classList.remove('half');
    });
    note.textContent = `${done} crossposted`;
  }
  show();

  function miss(word: string, at: HTMLElement, t: number) {
    wrong++;
    face('shock', t);
    pulse(parcel, 'shake');
    pending = [];
    deaf = t + 200; // swallows the other finger of the same fumbled chord
    tiles.forEach((el) => el.classList.remove('half'));
    bad(at, word);
  }

  return {
    press(b, t) {
      if (t < deaf) return;
      const lit = prompts[idx % prompts.length].lit;
      if (!lit.includes(b)) return miss('NOT THAT SUB', tiles[b], t);
      if (pending.includes(b)) return;
      if (!pending.length) firstAt = t;
      pending.push(b);
      tiles[b].classList.add('half');
      if (pending.length < lit.length) return;
      pending = [];
      done++;
      idx++;
      // Both copies land: an envelope drops through each lit door and OP cheers.
      for (const i of lit) {
        pulse(houses[i].mail, 'drop');
        fx.poof(houses[i].mail);
      }
      face('happy', t);
      good(parcel, 'X-POSTED');
      show();
    },
    tick(t) {
      if (!calm && t >= moodUntil) {
        calm = true;
        op.mood('idle');
      }
      if (pending.length && t - firstAt > WINDOW) miss('TOGETHER!', tiles[pending[0]], t);
    },
    score: () => clamp1000((1000 * (done - wrong)) / par),
    hint: (t) => (pending.length || t < deaf ? null : prompts[idx % prompts.length].lit),
  };
};
