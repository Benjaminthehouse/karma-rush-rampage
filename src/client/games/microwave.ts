import './microwave.css';
import { COLOR, clamp1000, dealer, defineSprite, h, padDots, person, pulse, randBtn, randInt, setSprite, shuffled, sprite, type GameFactory, type PersonOpts } from './common';

defineSprite('microwave-burrito', `
..kkkkkkkkkk..
.kdwnnnnnnnnk.
kdwdnnsnnnnnnk
kdddnnnnnsnnnk
kdwdnnnnnnnnNk
.kddnNNNNNNNk.
..kkkkkkkkkk..`);
defineSprite('microwave-slice', `
kkkkkkkkkkkkk
knnnnnnnnnnNk
kyyyryyyyyyok
.kyyyyyryyok.
.kyryyyyyyok.
..kyyyyyyok..
..kyyyryyok..
...kyyyyok...
...kyryyok...
....kyyok....
.....kok.....
......k......`);
defineSprite('microwave-noodles', `
..kkkkkkkkkk..
.kyyYyyyYyyyk.
kyYyyyYyyyYyyk
kkkkkkkkkkkkkk
kwwwwwwwwwwwdk
.kwwwwwwwwwdk.
.kwwwwwwwwddk.
..kwwwwwwddk..
...kkkkkkkk...`);

const SNACKS = [
  ['microwave-burrito', 'freezer burrito'],
  ['microwave-burrito', 'gas station burrito'],
  ['microwave-slice', 'last slice (not yours)'],
  ['microwave-slice', 'pizza from Tuesday'],
  ['microwave-noodles', 'instant noodles'],
  ['microwave-noodles', 'mystery leftovers'],
  ['microwave-noodles', 'mac and cheese, day 3'],
  ['cake', 'birthday cake, week 2'],
  ['cookie', 'one frozen cookie'],
  ['banana', 'a banana (why)'],
];
const ROOMIES: PersonOpts[] = [{ tone: 'pink' }, { tone: 'gold', kind: 'cat' }, { tone: 'orange', kind: 'bear' }, { tone: 'teal', kind: 'bot' }];
const NINJA = ['SILENT NINJA', 'NOT A SOUND', 'STEALTH SNACK', 'LIKE A SHADOW', 'ZERO BEEPS'];
const COLD = ['STILL FROZEN', 'COLD IN THE MIDDLE', 'ICE CORE'];
const WOKEN = ['IT IS 3 AM!', 'WHO IS COOKING?!', 'AGAIN?!', 'SERIOUSLY?'];
const FIRST = 300; // head start before the first countdown moves
const GAP = 380; // ms an opened microwave shows off before the next one arrives
const BEEPING = 800; // ms the house suffers after a countdown reaches zero

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const beat = 320 - level * 20; // ms per number
  const snack = dealer(rng, SNACKS);
  let lastBtn = -1;
  const queue = Array.from({ length: 24 }, () => {
    let btn = randBtn(rng);
    while (btn === lastBtn) btn = randBtn(rng);
    lastBtn = btn;
    const from = randInt(rng, 3, 5);
    // From level 2 the clock sometimes hangs on a number, to trip anyone pressing by rhythm alone.
    const hang = level >= 2 && rng() < 0.1 + level * 0.1 ? randInt(rng, 2, from) : 0;
    const [art, name] = snack();
    return { btn, from, hang, art, label: `${randInt(rng, 1, 4)}:${randInt(rng, 10, 59)} AM · ${name}` };
  });

  /** Microwave `i` as it would run from time `s`, or null when its 0:01 cannot finish before the bell. */
  function plan(i: number, s: number) {
    const m = queue[i % queue.length];
    const beats = (duration - s) / beat;
    const from = Math.min(m.from, Math.floor(beats));
    if (from < 3) return null;
    const hang = m.hang <= from && beats >= from + 0.7 ? m.hang : 0;
    const ends: number[] = []; // ends[n] is when the display stops showing n
    let at = s;
    for (let n = from; n >= 1; n--) ends[n] = at += beat * (n === hang ? 1.7 : 1);
    return { ...m, from, ends };
  }
  type Oven = NonNullable<ReturnType<typeof plan>>;
  const numberAt = (m: Oven, t: number) => {
    let n = m.from;
    while (n > 0 && t >= m.ends[n]) n--;
    return n;
  };

  // Par is the slowest clean run: every door opened at the very end of its 0:01.
  let par = 0;
  for (let m = plan(0, FIRST); m; m = plan(par, m.ends[1] + GAP)) par++;

  let cur: Oven | null = null; // the microwave on the counter
  let next = plan(0, FIRST); // the one after it; null once the kitchen has closed for the night
  let state: 'live' | 'open' | 'beep' = 'open';
  let served = 0;
  let shown = 0;
  let nextAt = 0;
  let beepAt = 0;
  let rings = 0;
  let ninjas = 0;
  let warm = 0;
  let wrong = 0;
  let beeps = 0;

  // The scene: a sleeping house under the night sky, and down in the kitchen one
  // microwave on the counter with tonight's snack going round inside.
  const wrap = h('div', 'g-microwave scene-night');
  const house = h('div', 'house');
  const rooms = shuffled(rng, ROOMIES).map((look) => {
    const el = h('div', 'room');
    const who = person({ ...look, mood: 'sleep', px: 0.2 });
    const sign = sprite('zed', { px: 0.14 }, 'sign');
    el.append(who.el, sign);
    house.append(el);
    return { el, who, sign };
  });
  const oven = h('div', 'oven');
  const display = h('div', 'display');
  const digits = h('b');
  display.append(digits);
  const bay = h('div', 'bay');
  const cavity = h('div', 'cavity');
  const food = sprite('cookie', { px: 0.3 }, 'food');
  cavity.append(food, h('i', 'plate'));
  const door = h('div', 'door');
  const which = h('span', 'which');
  door.append(h('i', 'handle'), which);
  bay.append(cavity, door);
  const tally = h('div', 'tally');
  const stars = [0, 1, 2, 3, 4, 5].map(() => tally.appendChild(sprite('star', { px: 0.13 })));
  const body = h('div', 'body');
  body.append(bay, tally);
  oven.append(display, body);
  const counter = h('div', 'counter');
  const kitchen = h('div', 'kitchen');
  kitchen.append(oven, counter);
  const racket = h('div', 'racket');
  racket.append(h('b', '', 'BEEP'), h('b', '', 'BEEP'), h('b', '', 'BEEP'));
  wrap.append(house, kitchen, racket);
  root.append(wrap);

  function serve() {
    cur = next;
    if (!cur) return;
    state = 'live';
    shown = cur.from;
    digits.textContent = `0:0${shown}`;
    oven.className = `oven c-${COLOR[cur.btn]}`;
    which.replaceChildren(padDots(cur.btn));
    setSprite(food, cur.art, { px: 0.3 });
    counter.textContent = cur.label;
    pulse(oven, 'pop-in');
  }
  serve();

  /** This microwave is done: line up the next one, or close the kitchen if none fits before the bell. */
  function rest(t: number, ms: number) {
    served++;
    nextAt = t + ms;
    next = plan(served, nextAt);
    if (next) return;
    if (beeps) counter.textContent = beeps < rooms.length ? `${beeps} awake. Run.` : 'House meeting. Now.';
    else if (!ninjas) counter.textContent = 'Quiet. Also still frozen.';
    else {
      counter.textContent = 'Nobody woke up.';
      fx.pop(house, 'NOBODY WOKE UP', 'gold');
      fx.burst(house, 'gold', 24);
      fx.flash('gold');
      fx.sound('coin');
    }
  }

  function beep(t: number) {
    state = 'beep';
    beepAt = t;
    rings = 0;
    oven.classList.remove('now');
    oven.classList.add('beep');
    wrap.className = 'g-microwave scene-sun'; // every light in the house snaps on
    const room = rooms[Math.min(beeps, rooms.length - 1)];
    room.el.className = 'room awake';
    room.who.mood('angry');
    setSprite(room.sign, 'bang', { px: 0.14 });
    pulse(room.el, 'bump');
    counter.textContent = WOKEN[beeps % WOKEN.length];
    bad(room.el);
    fx.flash('white');
    beeps++;
    rest(t, BEEPING);
  }

  return {
    press(b, t) {
      if (!cur || state !== 'live') return;
      const n = numberAt(cur, t);
      if (n === 0) return; // too late: the next frame beeps
      if (b !== cur.btn) {
        wrong++;
        pulse(oven, 'shake');
        bad(door, 'WRONG DOOR');
        return;
      }
      state = 'open';
      digits.textContent = `0:0${n}`;
      oven.classList.add('open');
      if (n > 1) oven.classList.add(n === 2 ? 'warm' : 'cold');
      if (n === 1) {
        const star = stars[Math.min(ninjas, stars.length - 1)];
        star.classList.add('on');
        fx.poof(food);
        good(oven, NINJA[ninjas % NINJA.length]);
        fx.burst(star, 'gold', 12);
        fx.sound('whoosh');
        ninjas++;
      } else if (n === 2) {
        warm++;
        fx.pop(oven, 'LUKEWARM', 'white');
        fx.sound('boing');
      } else bad(oven, COLD[served % COLD.length]);
      rest(t, GAP);
    },
    tick(t) {
      if (state === 'beep' && rings < 3 && t >= beepAt + rings * 170) {
        rings++;
        fx.sound('ding');
      }
      if (!cur || state !== 'live') {
        if (t < nextAt) return;
        if (state === 'beep') {
          state = 'open';
          wrap.className = 'g-microwave scene-night';
        }
        if (next) serve();
        return;
      }
      const n = numberAt(cur, t);
      if (n === shown) return;
      shown = n;
      digits.textContent = `0:0${n}`;
      if (n === 0) return beep(t);
      oven.classList.toggle('now', n === 1);
      pulse(digits, 'bump');
      fx.sound(n === 1 ? 'pop' : 'tick');
    },
    score: () => clamp1000((1000 * (ninjas + 0.4 * warm - 0.25 * wrong)) / par),
    hint: (t) => (cur && state === 'live' && numberAt(cur, t) === 1 ? cur.btn : null),
  };
};
