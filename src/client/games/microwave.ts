import './microwave.css';
import { COLOR, clamp1000, h, pick, pulse, randBtn, randInt, type GameFactory } from './common';

const SNACKS = [
  ['wrap', 'freezer burrito'],
  ['wrap', 'gas station burrito'],
  ['slice', 'last slice (not yours)'],
  ['slice', 'pizza from Tuesday'],
  ['bowl', 'instant noodles'],
  ['bowl', 'mystery leftovers'],
  ['bowl', 'mac and cheese, day 3'],
  ['mug', 'mug cake'],
  ['mug', 'tea, reheated twice'],
  ['mug', 'this morning’s coffee'],
];
const NINJA = ['SILENT NINJA', 'NOT A SOUND', 'STEALTH SNACK', 'LIKE A SHADOW', 'ZERO BEEPS'];
const COLD = ['STILL FROZEN', 'COLD IN THE MIDDLE', 'ICE CORE'];
const WOKEN = ['IT IS 3 AM!', 'WHO IS COOKING?!', 'AGAIN?!', 'SERIOUSLY?'];
const FIRST = 300; // head start before the first countdown moves
const GAP = 380; // ms an opened microwave shows off before the next one arrives
const BEEPING = 800; // ms the house suffers after a countdown reaches zero

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const beat = 320 - level * 20; // ms per number
  let lastBtn = -1;
  const queue = Array.from({ length: 24 }, () => {
    let btn = randBtn(rng);
    while (btn === lastBtn) btn = randBtn(rng);
    lastBtn = btn;
    const from = randInt(rng, 3, 5);
    // From level 2 the clock sometimes hangs on a number, to trip anyone pressing by rhythm alone.
    const hang = level >= 2 && rng() < 0.1 + level * 0.1 ? randInt(rng, 2, from) : 0;
    const [shape, name] = pick(rng, SNACKS);
    return { btn, from, hang, shape, label: `${randInt(rng, 1, 4)}:${randInt(rng, 10, 59)} AM · ${name}` };
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

  let cur: Oven | null = null; // null once the kitchen is closed for the night
  let state: 'live' | 'open' | 'beep' = 'live';
  let served = 0;
  let shown = 0;
  let nextAt = 0;
  let beepAt = 0;
  let rings = 0;
  let ninjas = 0;
  let warm = 0;
  let wrong = 0;
  let beeps = 0;

  const wrap = h('div', 'g-microwave');
  const house = h('div', 'house');
  const rooms = [0, 1, 2, 3].map(() => house.appendChild(h('span', 'room', 'z z z')));
  const oven = h('div', 'oven');
  const display = h('div', 'display');
  const digits = h('b');
  display.append(digits);
  const bay = h('div', 'bay');
  const cavity = h('div', 'cavity');
  const steam = h('div', 'steam');
  steam.append(h('i'), h('i'), h('i'));
  const food = h('i', 'food');
  cavity.append(steam, h('i', 'plate'), food);
  const door = h('div', 'door');
  door.append(h('i', 'handle'));
  bay.append(cavity, door);
  const tally = h('div', 'tally');
  const stars = [0, 1, 2, 3, 4, 5].map(() => tally.appendChild(h('i')));
  const body = h('div', 'body');
  body.append(bay, tally);
  oven.append(display, body);
  const note = h('div', 'g-note');
  const racket = h('div', 'racket');
  racket.append(h('b', '', 'BEEP'), h('b', '', 'BEEP'), h('b', '', 'BEEP'));
  wrap.append(house, oven, note, racket);
  root.append(wrap);

  function serve(t: number) {
    wrap.classList.remove('loud');
    cur = plan(served, t);
    if (!cur) return closeKitchen();
    state = 'live';
    shown = cur.from;
    digits.textContent = `0:0${shown}`;
    oven.className = `oven c-${COLOR[cur.btn]}`;
    food.className = `food ${cur.shape}`;
    note.textContent = cur.label;
    pulse(oven, 'pop-in');
  }

  function closeKitchen() {
    if (beeps) note.textContent = beeps < rooms.length ? `${beeps} awake. Run.` : 'House meeting. Now.';
    else if (!ninjas) note.textContent = 'Quiet. Also still frozen.';
    else {
      note.textContent = 'Nobody woke up.';
      fx.pop(oven, 'NOBODY WOKE UP', 'gold');
      fx.burst(house, 'gold', 24);
      fx.flash('gold');
      fx.sound('coin');
    }
  }

  function beep(t: number) {
    state = 'beep';
    beepAt = t;
    rings = 0;
    nextAt = t + BEEPING;
    served++;
    oven.classList.add('beep');
    wrap.classList.add('loud');
    const room = rooms[Math.min(beeps, rooms.length - 1)];
    room.className = 'room awake';
    room.textContent = '!?';
    bad(room, WOKEN[beeps % WOKEN.length]);
    fx.flash('white');
    beeps++;
  }

  serve(FIRST);

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
      nextAt = t + GAP;
      served++;
      digits.textContent = `0:0${n}`;
      oven.classList.add('open', n === 1 ? 'ninja' : n === 2 ? 'warm' : 'cold');
      if (n === 1) {
        const star = stars[Math.min(ninjas, stars.length - 1)];
        star.className = 'on';
        good(star, NINJA[ninjas % NINJA.length]);
        fx.burst(bay, 'gold', 14);
        fx.sound('whoosh');
        ninjas++;
      } else if (n === 2) {
        warm++;
        fx.pop(bay, 'LUKEWARM', 'white');
        fx.sound('pop');
      } else bad(bay, COLD[served % COLD.length]);
    },
    tick(t) {
      if (!cur) return;
      if (state === 'beep' && rings < 3 && t >= beepAt + rings * 170) {
        rings++;
        fx.sound('ding');
      }
      if (state !== 'live') {
        if (t >= nextAt) serve(t);
        return;
      }
      const n = numberAt(cur, t);
      if (n === shown) return;
      shown = n;
      digits.textContent = `0:0${n}`;
      if (n === 0) return beep(t);
      oven.classList.toggle('now', n === 1);
      pulse(digits, 'bump');
      fx.sound('tick');
    },
    score: () => clamp1000((1000 * (ninjas + 0.4 * warm - 0.25 * wrong)) / par),
    hint: (t) => (cur && state === 'live' && numberAt(cur, t) === 1 ? cur.btn : null),
  };
};
