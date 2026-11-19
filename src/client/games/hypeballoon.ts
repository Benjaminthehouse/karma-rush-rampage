import './hypeballoon.css';
import { COLOR, h, pulse, randBtn, ratio, shuffled, type GameFactory } from './common';

const APPS = [
  'To-do list, but AI',
  'Dating app for plants',
  'Chat with your fridge',
  'Blockchain for dogs',
  'A wrapper for a wrapper',
  'Habit tracker no. 4,000',
  'Weather app (vibes only)',
  'Spreadsheet, but spicy',
  'Social network for one',
  'Smart toaster dashboard',
];
const POPS = [
  'it was a to-do app',
  'the demo was a video',
  'the waitlist was bots',
  'it was a wrapper',
  'servers: one laptop',
  'pivoting to B2B',
  'zero paying users',
  'the founder logged off',
];
const STAGES = ['we’re live', 'trending', 'UNICORN??'];
const GAP = 200; // ms before the next balloon arrives
const POP_MS = 500; // extra pause after a pop
const KINK_MS = 350; // the pump jams after a wrong-colour press
const SURGE = (2 * Math.PI) / 700; // how fast the pump surges and stalls, in radians per ms

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const speed = (70 + 12 * level) / 100000; // share of the balloon filled per ms of holding
  const sway = level >= 2 ? 0.25 : 0; // later rounds: the fill rate swings by a quarter
  const par = 340 + 50 * level;
  const apps = shuffled(rng, APPS);
  const pops = shuffled(rng, POPS);
  let prev = -1;
  const launches = Array.from({ length: 30 }, (_, i) => {
    let col = randBtn(rng);
    while (col === prev) col = randBtn(rng);
    prev = col;
    return { col, phase: rng() * 2 * Math.PI, app: apps[i % apps.length], pop: pops[i % pops.length] };
  });
  let idx = -1;
  let state: 'ready' | 'pump' | 'gap' = 'gap';
  let t0 = 0; // when the current hold began
  let nextAt = 0;
  let jamUntil = 0;
  let hype = 0; // banked
  let live = 0; // what the balloon being pumped would bank right now
  let stage = -1;

  const wrap = h('div', 'g-hypeballoon');
  const post = h('div', 'post');
  const app = h('b');
  const tag = h('span', 'tag');
  post.append(app, tag);
  const sky = h('div', 'sky');
  const line = h('div', 'line');
  line.append(h('span', '', 'POP LINE'));
  const balloon = h('div', 'balloon');
  const count = h('b');
  balloon.append(count, h('span', '', 'waitlist'));
  sky.append(line, balloon);
  const meter = h('div', 'meter big');
  const bar = h('i');
  meter.append(bar);
  const note = h('div', 'g-note');
  wrap.append(post, sky, meter, note);
  root.append(wrap);

  const cur = () => launches[idx % launches.length];
  const worth = (f: number) => Math.round(100 * f * f);
  // Fill after holding since t0. The sine makes the pump surge and stall but never run backwards.
  const fillAt = (t: number) => {
    const x = t - t0;
    return speed * (x + (sway / SURGE) * (Math.cos(cur().phase) - Math.cos(cur().phase + SURGE * x)));
  };

  function paint(f: number) {
    balloon.style.setProperty('--f', f.toFixed(3));
    balloon.classList.toggle('tense', f >= 0.8);
    count.textContent = Math.round(12 * 4000 ** f).toLocaleString('en-US');
    const s = f < 0.5 ? 0 : f < 0.85 ? 1 : 2;
    if (s === stage) return;
    stage = s;
    tag.className = `tag s${s}`;
    tag.textContent = STAGES[s];
    if (s) {
      pulse(tag, 'pop-in');
      fx.sound('tick');
    }
  }

  function bank() {
    bar.style.width = `${Math.min(100, (hype / par) * 100)}%`;
    note.textContent = `${hype} hype banked`;
  }

  function arm() {
    idx++;
    state = 'ready';
    stage = -1;
    balloon.className = `balloon c-${COLOR[cur().col]}`;
    app.textContent = cur().app;
    paint(0);
    pulse(balloon, 'pop-in');
  }

  function leave(t: number, pause: number) {
    state = 'gap';
    live = 0;
    nextAt = t + pause;
  }

  function launch(t: number, f: number) {
    const pts = worth(f);
    hype += pts;
    leave(t, GAP);
    bank();
    if (f < 0.5) {
      balloon.classList.add('flop');
      bad(balloon, `FLOP +${pts}`);
      return;
    }
    balloon.classList.add('fly');
    good(balloon, `BANKED ${pts}!`);
    fx.sound('whoosh');
    if (f >= 0.9) {
      fx.burst(balloon, 'gold', 20);
      fx.sound('coin');
    }
  }

  function pop(t: number) {
    leave(t, POP_MS + GAP);
    balloon.classList.add('popped');
    tag.className = 'tag bust';
    tag.textContent = cur().pop;
    pulse(tag, 'pop-in');
    bad(sky, 'POP!');
    fx.burst(sky, COLOR[cur().col], 26);
    fx.flash('white');
    fx.shake();
    fx.sound('pop');
  }

  arm();
  bank();

  return {
    press(b, t) {
      if (state === 'gap') return;
      if (b !== cur().col) {
        // Wrong pump: the air escapes and the hose kinks for a moment.
        state = 'ready';
        live = 0;
        jamUntil = t + KINK_MS;
        paint(0);
        pulse(balloon, 'shake');
        bad(balloon, 'WRONG PUMP');
        return;
      }
      if (state === 'pump' || t < jamUntil) return;
      state = 'pump';
      t0 = t;
      fx.sound('power');
    },
    release(b, t) {
      if (state !== 'pump' || b !== cur().col) return;
      const f = fillAt(t);
      if (f >= 1) pop(t);
      else launch(t, f);
    },
    tick(t) {
      if (state === 'gap' && t >= nextAt) arm();
      if (state !== 'pump') return;
      const f = fillAt(t);
      if (f >= 1) {
        pop(t);
        return;
      }
      live = worth(f);
      paint(f);
    },
    // A balloon still being pumped at the bell counts as let go.
    score: () => ratio(hype + live, par),
    hint(t) {
      if (state === 'ready') return t < jamUntil ? null : { hold: [cur().col] };
      if (state !== 'pump') return null;
      // Let go on the last frame or two before the pop line.
      return fillAt(t + 34) < 1 ? { hold: [cur().col] } : { hold: [] };
    },
  };
};
