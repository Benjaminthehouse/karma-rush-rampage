import './hypeballoon.css';
import { actor, COLOR, defineSprite, h, padDots, pulse, randBtn, ratio, setSprite, shuffled, sprite, type ActorMood, type GameFactory } from './common';

// The Dev's foot pump: a pedal on a bellows. Its top half squashes while pumping.
defineSprite('hypeballoon-pump', `
....kkkkkkkk....
...kddddddddk...
...kkkkkkkkkk...
....kRrrrrrk....
....kkkkkkkk....
....kRrrrrrk....
....kkkkkkkk....
....kRrrrrrk....
..kkkkkkkkkkkk..
.kxxxxxxxxxxxdk.
kkkkkkkkkkkkkkkk`);

// The balloon at full size (40 art pixels across, a knot below), lit from the top left, and
// the dashed pop line it must not touch. Both are scaled to the sky box; pumping only scales.
const R = 20;
const inside = (x: number, y: number) => (x - R + 0.5) ** 2 + (y - R + 0.5) ** 2 <= R * R;
defineSprite(
  'hypeballoon-balloon',
  Array.from({ length: 2 * R + 4 }, (_, y) => {
    let row = '';
    for (let x = 0; x < 2 * R; x++) {
      const dx = x - R + 0.5;
      const dy = y - R + 0.5;
      if (y >= 2 * R - 1) {
        // The knot.
        const k = Math.abs(dx);
        row += y === 2 * R + 3 ? (k < 3 ? 'k' : '.') : k < y - 2 * R + 1.5 ? 'a' : k < y - 2 * R + 2.5 ? 'k' : inside(x, y) ? 'k' : '.';
        continue;
      }
      if (!inside(x, y)) row += '.';
      else if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) row += 'k';
      else {
        const hl = (dx + 7) ** 2 + (dy + 8) ** 2;
        row += hl < 5 ? 'W' : hl < 16 ? 'L' : (dx + 4) ** 2 + (dy + 5) ** 2 > 19 * 19 ? 'a' : 'A';
      }
    }
    return row;
  }),
);
defineSprite(
  'hypeballoon-line',
  Array.from({ length: 64 }, (_, y) => {
    let row = '';
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5);
      const ring = d <= 32 && d > 30.9;
      const dash = Math.floor(((Math.atan2(y - 31.5, x - 31.5) + Math.PI) / (2 * Math.PI)) * 40) % 2 === 0;
      row += ring && dash ? 'k' : '.';
    }
    return row;
  }),
);

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
  let wasTense = false;
  let shownStep = -1;
  let wasStuck = false;

  // The scene: a rooftop launch party on feed street. The Dev stomps a foot pump to blow up
  // the hype balloon while two NPC investors cheer it on; it floats off or pops into confetti.
  const wrap = h('div', 'g-hypeballoon scene-street');
  const post = h('div', 'post');
  const app = h('b');
  const tag = h('span', 'tag');
  post.append(app, tag);
  const party = h('div', 'party');
  const sky = h('div', 'sky');
  const line = h('div', 'line');
  line.append(sprite('hypeballoon-line', {}, 'ring'), h('span', '', 'POP LINE'));
  const balloon = h('div', 'balloon');
  const skin = sprite('hypeballoon-balloon', { tone: 'red' }, 'skin'); // the rubber: scaled, never resized, so pumping costs no layout
  const text = h('div', 'text');
  const count = h('b');
  const which = h('i', 'which'); // which pad this colour is, for anyone who cannot tell the colours apart
  text.append(count, h('span', 'cap', 'waitlist'), which);
  balloon.append(skin, text);
  sky.append(line, balloon, h('div', 'boom', 'POP!'));
  const rig = h('div', 'rig');
  const dev = actor('dev', { px: 0.38 });
  const pedal = sprite('hypeballoon-pump', { px: 0.24 }, 'pump');
  rig.append(dev.el, pedal);
  const crowd = h('div', 'crowd');
  const investors = [actor('npc', { px: 0.22 }), actor('npc', { px: 0.22 })];
  crowd.append(...investors.map((n) => n.el));
  party.append(rig, sky, crowd);
  const roof = h('div', 'roof');
  const meter = h('div', 'gauge');
  const bar = h('i');
  meter.append(bar);
  const note = h('div', 'tally');
  roof.append(meter, note);
  wrap.append(post, party, roof);
  root.append(wrap);
  // Faces: actor.mood() only repaints on a change.
  const faces = (d: ActorMood, c: ActorMood) => {
    dev.mood(d);
    investors.forEach((n) => n.mood(c));
  };
  let pumping = false;
  const setPumping = (on: boolean) => {
    if (on !== pumping) wrap.classList.toggle('pumping', (pumping = on));
  };

  const cur = () => launches[idx % launches.length];
  const worth = (f: number) => Math.round(100 * f * f);
  // Fill after holding since t0. The sine makes the pump surge and stall but never run backwards.
  const fillAt = (t: number) => {
    const x = t - t0;
    return speed * (x + (sway / SURGE) * (Math.cos(cur().phase) - Math.cos(cur().phase + SURGE * x)));
  };

  function paint(f: number) {
    skin.style.transform = `scale(${(0.34 + 0.66 * f).toFixed(3)})`;
    text.style.transform = `scale(${(1 + 1.3 * f).toFixed(3)})`;
    const tense = f >= 0.8;
    if (tense !== wasTense) balloon.classList.toggle('tense', (wasTense = tense));
    // The waitlist number ticks over in steps rather than every frame.
    const step = Math.floor(f * 40);
    if (step !== shownStep) {
      shownStep = step;
      count.textContent = Math.round(12 * 4000 ** (step / 40)).toLocaleString('en-US');
    }
    // The pump is heard as well as seen: a tick every tenth, and a rising whine once it starts to tremble.
    const tenth = Math.floor(f * 10);
    if (tenth > notch) fx.sound(tenth === 8 ? 'power' : 'tick');
    notch = tenth;
    const s = f < 0.5 ? 0 : f < 0.85 ? 1 : 2;
    if (s === buzz) return;
    buzz = s;
    // The investors start cheering at half full; the Dev starts sweating near the line.
    if (s === 0) faces(state === 'pump' ? 'talk' : 'idle', 'idle');
    else faces(s === 1 ? 'happy' : 'shock', 'happy');
    tag.className = `tag s${s}`;
    tag.textContent = BUZZ[s];
    if (s) pulse(tag, 'pop-in');
  }

  function bank() {
    bar.style.transform = `scaleX(${Math.min(1, hype / par).toFixed(3)})`;
    // Until something is banked the caption is the one-line tutorial.
    note.textContent = hype ? `${hype} hype banked` : 'hold the balloon’s colour, then let go';
  }

  // The pump only runs on the balloon's own button: any other button down, or just pressed, kinks the hose.
  const kinked = (t: number) => t < jamUntil || down.some((on, b) => on && b !== cur().col);

  function pump(t: number) {
    state = 'pump';
    t0 = t;
    balloon.classList.remove('jam');
    wasStuck = false;
    setPumping(true);
    faces('talk', 'idle');
    fx.sound('power');
  }

  function arm() {
    idx++;
    state = 'ready';
    held = false;
    buzz = -1;
    sky.className = 'sky';
    balloon.className = `balloon c-${COLOR[cur().col]}`;
    setSprite(skin, 'hypeballoon-balloon', { tone: COLOR[cur().col] });
    wasTense = wasStuck = false;
    shownStep = -1;
    which.replaceChildren(padDots(cur().col));
    app.textContent = cur().app;
    setPumping(false);
    paint(0);
    pulse(balloon, 'pop-in');
  }

  function leave(t: number, pause: number) {
    state = 'gap';
    live = 0;
    nextAt = t + pause;
    setPumping(false);
    sky.classList.add('empty');
  }

  function launch(t: number, f: number) {
    const pts = worth(f);
    hype += pts;
    leave(t, GAP);
    bank();
    if (f < 0.5) {
      balloon.classList.add('flop');
      faces('sad', 'sad');
      bad(balloon, pts ? `FLOP +${pts}` : 'FLOP');
      return;
    }
    balloon.classList.add('fly');
    faces('cool', 'happy');
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
    faces('dead', 'shock');
    bad(sky);
    fx.burst(sky, COLOR[cur().col], 26);
    fx.burst(sky, 'gold', 12); // confetti
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
        setPumping(false);
        faces('angry', 'idle');
        balloon.classList.add('jam');
        wasStuck = true;
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
        if (stuck !== wasStuck) balloon.classList.toggle('jam', (wasStuck = stuck));
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
