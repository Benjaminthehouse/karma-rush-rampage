import './hypeballoon.css';
import { COLOR, h, padDots, pulse, randBtn, ratio, shuffled, type GameFactory } from './common';

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
const BUZZ = ['we’re live', 'trending', 'UNICORN??']; // the launch post's status as the balloon swells
const GAP = 200; // ms before the next balloon arrives
const POP_MS = 500; // extra pause after a pop
const KINK_MS = 350; // the hose stays kinked this long after a wrong-colour press
const SURGE = (2 * Math.PI) / 700; // how fast the pump surges and stalls, in radians per ms

export const create: GameFactory = ({ root, rng, level, down, good, bad, fx }) => {
  const speed = (70 + 12 * level) / 100000; // share of the balloon filled per ms of holding
  const sway = level >= 2 ? 0.25 : 0; // later rounds: the fill rate swings by a quarter
  const par = 360 + 50 * level; // four launches let go at 95% on level 0, six on level 4
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
  let held = false; // the balloon's own button is down, pressed since this balloon arrived
  let hype = 0; // banked
  let live = 0; // what the balloon being pumped would bank right now
  let buzz = -1;
  let notch = 0; // tenths of the balloon already ticked off

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
  const which = h('i', 'which'); // which pad this colour is, for anyone who cannot tell the colours apart
  balloon.append(count, h('span', 'cap', 'waitlist'), which);
  sky.append(line, balloon, h('div', 'boom', 'POP!'));
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
    // The pump is heard as well as seen: a tick every tenth, and a rising whine once it starts to tremble.
    const tenth = Math.floor(f * 10);
    if (tenth > notch) fx.sound(tenth === 8 ? 'power' : 'tick');
    notch = tenth;
    const s = f < 0.5 ? 0 : f < 0.85 ? 1 : 2;
    if (s === buzz) return;
    buzz = s;
    tag.className = `tag s${s}`;
    tag.textContent = BUZZ[s];
    if (s) pulse(tag, 'pop-in');
  }

  function bank() {
    bar.style.width = `${Math.min(100, (hype / par) * 100)}%`;
    // Until something is banked the caption is the one-line tutorial.
    note.textContent = hype ? `${hype} hype banked` : 'hold the balloon’s colour, then let go';
  }

  // The pump only runs on the balloon's own button: any other button down, or just pressed, kinks the hose.
  const kinked = (t: number) => t < jamUntil || down.some((on, b) => on && b !== cur().col);

  function pump(t: number) {
    state = 'pump';
    t0 = t;
    balloon.classList.remove('jam');
    fx.sound('power');
  }

  function arm() {
    idx++;
    state = 'ready';
    held = false;
    buzz = -1;
    sky.className = 'sky';
    balloon.className = `balloon c-${COLOR[cur().col]}`;
    which.replaceChildren(padDots(cur().col));
    app.textContent = cur().app;
    paint(0);
    pulse(balloon, 'pop-in');
  }

  function leave(t: number, pause: number) {
    state = 'gap';
    live = 0;
    nextAt = t + pause;
    sky.classList.add('empty');
  }

  function launch(t: number, f: number) {
    const pts = worth(f);
    hype += pts;
    leave(t, GAP);
    bank();
    if (f < 0.5) {
      balloon.classList.add('flop');
      bad(balloon, pts ? `FLOP +${pts}` : 'FLOP');
      return;
    }
    balloon.classList.add('fly');
    good(balloon);
    fx.pop(meter, `BANKED ${pts}!`, 'gold'); // rises off the hype meter, clear of the next launch post
    fx.sound('whoosh');
    if (f >= 0.9) {
      fx.burst(balloon, 'gold', 20);
      fx.sound('coin');
    }
  }

  function pop(t: number) {
    leave(t, POP_MS + GAP);
    balloon.classList.add('popped');
    sky.classList.add('popped'); // a big POP! where the balloon was; the post above says what went wrong
    tag.className = 'tag bust';
    tag.textContent = cur().pop;
    pulse(tag, 'pop-in');
    bad(sky);
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
        balloon.classList.add('jam');
        pulse(balloon, 'shake');
        bad(balloon, 'WRONG PUMP');
        return;
      }
      // Pressed while the hose is kinked: keep holding and it pumps the moment the kink clears (see tick).
      held = true;
      if (state === 'ready' && !kinked(t)) pump(t);
    },
    release(b, t) {
      if (b !== cur().col) return;
      held = false;
      if (state !== 'pump') return;
      const f = fillAt(t);
      if (f >= 1) pop(t);
      else launch(t, f);
    },
    tick(t) {
      if (state === 'gap' && t >= nextAt) arm();
      if (state === 'ready') {
        const stuck = kinked(t);
        balloon.classList.toggle('jam', stuck);
        if (held && !stuck) pump(t);
      }
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
      if (state === 'ready') return { hold: [cur().col] };
      if (state !== 'pump') return null;
      // Let go about three frames before the pop line.
      return fillAt(t + 50) < 1 ? { hold: [cur().col] } : { hold: [] };
    },
  };
};
