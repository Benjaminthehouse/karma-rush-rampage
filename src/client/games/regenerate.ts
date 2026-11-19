import './regenerate.css';
import { COLOR, clamp1000, defineSprite, h, person, pick, pulse, setSprite, shuffled, sprite, type Btn, type GameFactory, type Mood } from './common';

// Chunky verdicts for the three checks: a cross in the button's colour, a tick when it passes.
defineSprite('regenerate-cross', `
.kk.....kk.
kLAk...kAAk
kAAAk.kAAAk
.kAAAkAAAk.
..kAAAAAk..
...kAAAk...
..kAAAAAk..
.kAAAkAAAk.
kAAAk.kAAak
kAAk...kaak
.kk.....kk.`);
defineSprite('regenerate-check', `
..........kk.
.........kAAk
........kAAAk
.......kAAAk.
.kk...kAAAk..
kAAk.kAAAk...
kAAAkAAAk....
.kAAAAAk.....
..kAAAk......
...kak.......
....k........`);

const CHECKS = ['BUILD', 'TESTS', 'DEPLOY'];
// The AI's side of the chat: its opening boast, a reprompt that still fails,
// a fresh change that breaks everything, and what it did when you poked a pass.
const OPENERS = ['Done! It all works perfectly.', 'All done! Zero bugs, I promise.', 'Finished! No need to test it.', 'Perfect code. Just run it!', 'Ready to ship! Probably.'];
const RETRY = [
  'You’re absolutely right!',
  'Great catch! Fixed.',
  'Fixed! (it is not fixed)',
  'Ah, I see the issue now!',
  'Good eye! Truly fixed now.',
  'My mistake! Try it again.',
  'That should do it! (no)',
  'Works on my machine!',
  'Simple fix! Attempt nine.',
  'I added more comments.',
];
const AGAIN = ['I upgraded all your packages!', 'One tiny tweak… oops.', 'New feature! What could go wrong?', 'I tidied up. Nothing works now.'];
const BROKE = ['I also refactored your auth. Hope that’s ok!', 'While I was in there, I deleted the tests.', 'You said fix it, so I rewrote it all.', 'It worked, so I improved it. Now it doesn’t.'];

const SPIN = 160; // ms a reprompt takes to land
const GRACE = 400; // ms after a pass lands in which one stray press is forgiven (nobody stops a finger faster)
const JAM = 400; // ms a broken check ignores you
const BREAK = 0.3; // ships that breaking a pass costs
const PARTY = 400; // ms of celebration after a ship; nothing can be pressed
const SYM = 0.36; // sprite pixel size of the verdicts, in em

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 4.8 - level * 0.15; // ships for a full score; later jobs also take more reprompts
  // How many reprompts fail before a check passes: 0-2, up to 0-4 by level 4.
  const draw = () => Math.floor(rng() * (3 + level / 2));
  // A fresh job never lines up on its own: one check passes at once and another holds out,
  // so each pass has to be left alone while the rest catch up.
  const jobs = Array.from({ length: 24 }, () => {
    const c = [draw(), draw(), draw()];
    if (Math.max(...c) - Math.min(...c) < 2) {
      const [i, j] = shuffled(rng, [0, 1, 2]);
      c[i] = 0;
      c[j] = Math.max(2, c[j]);
    }
    return c;
  });
  const mends = Array.from({ length: 60 }, () => 1 + draw()); // a broken pass takes at least two reprompts to mend
  const retry = [RETRY[0], ...shuffled(rng, RETRY.slice(1))]; // the classic always comes first
  const again = shuffled(rng, AGAIN);
  const broke = shuffled(rng, BROKE);
  let said = 0;
  let quietUntil = 900; // a line stays up long enough to read before small talk replaces it
  let ships = 0;
  let breaks = 0;
  let bank = 0; // ships, less what breaking things cost; never below zero
  let partyUntil = -1; // -1 unless a ship is being celebrated
  let alarmUntil = -1; // -1 unless something just broke

  // The scene: the ever-confident AI up top, the three checks it keeps "fixing", and what has shipped.
  const wrap = h('div', 'g-regenerate scene-grid');
  const chat = h('div', 'chat');
  const bot = person({ kind: 'bot', tone: 'purple', mood: 'happy', px: 0.27 });
  const bubble = h('div', 'bubble', pick(rng, OPENERS));
  chat.append(bot.el, bubble);
  const pipe = h('div', 'pipe');
  const reels = CHECKS.map((name, i) => {
    const el = h('div');
    const sym = sprite('regenerate-cross', { tone: COLOR[i], px: SYM }, 'sym');
    const view = h('div', 'view');
    view.append(sym);
    const state = h('span', 'state');
    el.append(h('span', 'name', name), view, state);
    pipe.append(el);
    return { i, el, sym, state, mode: 'fail' as 'fail' | 'spin' | 'pass', landAt: 0, spare: false, jamUntil: 0, left: jobs[0][i] };
  });
  type Reel = (typeof reels)[number];
  const dock = h('div', 'dock');
  const tags = Array.from({ length: Math.ceil(par) }, () => h('span', 'tag'));
  const note = h('div', 'note', 'ALL 3 PASS = SHIP IT');
  const shelf = h('div', 'shelf');
  shelf.append(...tags);
  dock.append(shelf, note);
  wrap.append(chat, pipe, dock);
  root.append(wrap);

  function paint(r: Reel) {
    r.el.className = `reel c-${COLOR[r.i]} ${r.mode}`;
    r.state.textContent = r.mode === 'pass' ? 'PASS' : 'FAIL';
    if (r.mode === 'pass') setSprite(r.sym, 'regenerate-check', { tone: 'ink', px: SYM });
    else setSprite(r.sym, 'regenerate-cross', { tone: COLOR[r.i], px: SYM });
  }
  reels.forEach(paint);

  function speak(t: number, line: string, mood: Mood, cls = '', hold = 650) {
    quietUntil = t + hold;
    bubble.textContent = line;
    chat.className = `chat ${cls}`;
    bot.mood(mood);
    pulse(bubble, 'pop-in');
  }

  const backdrop = () => (wrap.className = `g-regenerate ${partyUntil >= 0 ? 'scene-sun' : alarmUntil >= 0 ? 'scene-danger' : 'scene-grid'}`);

  function ship(t: number) {
    ships++;
    bank++;
    partyUntil = t + PARTY;
    // The next job starts broken; the reels keep showing PASS until the party ends.
    reels.forEach((r) => {
      r.mode = 'fail';
      r.left = jobs[ships % jobs.length][r.i];
    });
    pipe.classList.add('shipped');
    speak(t, 'IT WORKS. DON’T TOUCH IT.', 'cool', 'win', PARTY);
    backdrop();
    // The shelf shows the newest releases; once it is full the oldest scrolls off.
    const first = Math.max(1, ships - tags.length + 1);
    tags.forEach((el, k) => {
      el.textContent = first + k <= ships ? `v${first + k}` : '';
      el.classList.toggle('on', first + k <= ships);
    });
    const tag = tags[ships - first];
    pulse(tag, 'pop-in');
    fx.poof(tag);
    note.textContent = `${ships} SHIPPED`;
    good(pipe);
    fx.pop(pipe, 'SHIPPED!', 'gold');
    fx.burst(pipe, 'gold', 26);
    fx.flash('gold');
    fx.sound('coin');
    fx.sound('power');
  }

  function sync(t: number) {
    if (alarmUntil >= 0 && t >= alarmUntil) {
      alarmUntil = -1;
      backdrop();
    }
    if (partyUntil >= 0 && t >= partyUntil) {
      partyUntil = -1;
      pipe.classList.remove('shipped');
      reels.forEach(paint);
      backdrop();
      speak(t, again[ships % again.length], 'wink');
    }
    const landed = reels.filter((r) => r.mode === 'spin' && t >= r.landAt);
    if (!landed.length) return;
    for (const r of landed) {
      if (r.left > 0) {
        r.left--;
        r.mode = 'fail';
      } else {
        r.mode = 'pass';
        r.spare = true;
      }
      paint(r);
      pulse(r.el, 'land');
    }
    if (reels.every((r) => r.mode === 'pass')) return ship(t);
    const fixed = landed.filter((r) => r.mode === 'pass');
    if (fixed.length) {
      good(fixed[0].el);
      fixed.forEach((r) => fx.burst(r.el, 'gold', 8));
    }
    if (fixed.length < landed.length) {
      fx.sound('thud');
      if (t >= quietUntil) speak(t, retry[said++ % retry.length], 'happy');
    }
  }

  return {
    press(b, t) {
      sync(t);
      const r = reels[b];
      if (partyUntil >= 0 || r.mode === 'spin' || t < r.jamUntil) return;
      if (r.mode === 'fail') {
        r.mode = 'spin';
        r.landAt = t + SPIN;
        paint(r);
        fx.sound('tick');
      } else if (r.spare && t < r.landAt + GRACE) {
        // A finger that was already coming down when the pass landed.
        r.spare = false;
        pulse(r.el, 'bump');
        fx.pop(pipe, 'HANDS OFF!', 'white');
        fx.sound('pop');
      } else {
        r.mode = 'fail';
        r.jamUntil = t + JAM;
        r.left = mends[breaks % mends.length];
        bank = Math.max(0, bank - BREAK);
        alarmUntil = t + 300;
        paint(r);
        pulse(r.el, 'jam');
        backdrop();
        speak(t, broke[breaks++ % broke.length], 'shock', 'oops', 900);
        fx.poof(r.sym);
        bad(pipe, 'YOU BROKE IT');
        fx.sound('boing');
      }
    },
    tick: sync,
    score: () => clamp1000((1000 * (bank + 0.2 * reels.filter((r) => r.mode === 'pass').length)) / par),
    hint(t) {
      if (partyUntil >= 0) return null;
      const todo = reels.flatMap((r) => (r.mode === 'fail' && t >= r.jamUntil ? [r.i as Btn] : []));
      return todo.length ? todo : null;
    },
  };
};
