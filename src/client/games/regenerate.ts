import './regenerate.css';
import { COLOR, clamp1000, h, pick, pulse, shuffled, type Btn, type GameFactory } from './common';

const CHECKS = ['BUILD', 'TESTS', 'DEPLOY'];
// The AI's side of the chat: its opening boast, a reprompt that still fails,
// a fresh change that breaks everything, and what it did when you poked a pass.
const OPENERS = [
  'Done! It all works perfectly.',
  'All done! Zero bugs, I promise.',
  'Finished! No need to test it.',
  'Perfect code. Just run it!',
  'Implemented! Tests are optional, right?',
  'Ready to ship! Probably.',
];
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
const BROKE = [
  'I also refactored your auth. Hope that’s ok!',
  'While I was in there, I deleted the tests.',
  'You said fix it, so I rewrote it all.',
  'It worked, so I improved it. Now it doesn’t.',
];

const SPIN = 160; // ms a reprompt takes to land
const GRACE = 250; // ms after a pass lands in which one stray press is forgiven
const JAM = 400; // ms a broken check ignores you
const BREAK = 0.3; // ships that breaking a pass costs
const PARTY = 400; // ms of celebration after a ship; nothing can be pressed

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 5.5 - level * 0.35; // ships for a full score
  const retry = [RETRY[0], ...shuffled(rng, RETRY.slice(1))]; // the classic always comes first
  const again = shuffled(rng, AGAIN);
  const broke = shuffled(rng, BROKE);
  let said = 0;
  let ships = 0;
  let bank = 0; // ships, less what breaking things cost; never below zero
  let partyUntil = -1; // -1 unless a ship is being celebrated

  const wrap = h('div', 'g-regenerate');
  const chat = h('div', 'chat');
  const bubble = h('div', 'bubble', pick(rng, OPENERS));
  chat.append(h('i', 'bot'), bubble);
  const pipe = h('div', 'pipe');
  const reels = CHECKS.map((name, i) => {
    const el = h('div');
    const state = h('span', 'state');
    el.append(h('span', 'name', name), h('i', 'sym'), state);
    pipe.append(el);
    // Each check has its own seeded stream: how many reprompts fail before the next pass (0-2, up to 0-4 by level 4).
    const fails = Array.from({ length: 40 }, () => Math.floor(rng() * (3 + level / 2)));
    return { el, state, cls: `reel c-${COLOR[i]}`, mode: 'fail' as 'fail' | 'spin' | 'pass', landAt: 0, spare: false, jamUntil: 0, fails, n: 1, left: fails[0] };
  });
  type Reel = (typeof reels)[number];
  const shelf = h('div', 'shelf');
  const tags = Array.from({ length: Math.ceil(par) }, () => h('span', 'tag'));
  shelf.append(...tags);
  const note = h('div', 'g-note', 'All three PASS = shipped');
  wrap.append(chat, pipe, shelf, note);
  root.append(wrap);

  function paint(r: Reel) {
    r.el.className = `${r.cls} ${r.mode}`;
    r.state.textContent = r.mode === 'pass' ? 'PASS' : 'FAIL';
  }
  reels.forEach(paint);

  const refill = (r: Reel) => (r.left = r.fails[r.n++ % r.fails.length]);

  function speak(pool: string[], mood = '') {
    bubble.textContent = pool[said++ % pool.length];
    chat.className = `chat ${mood}`;
    pulse(bubble, 'pop-in');
  }

  function ship(t: number) {
    ships++;
    bank++;
    partyUntil = t + PARTY;
    // The next job starts broken; the reels keep showing PASS until the party ends.
    reels.forEach((r) => {
      r.mode = 'fail';
      refill(r);
    });
    pipe.classList.add('shipped');
    bubble.textContent = 'IT WORKS. DON’T TOUCH IT.';
    chat.className = 'chat win';
    const tag = tags[Math.min(ships, tags.length) - 1];
    tag.textContent = `v${ships}`;
    tag.classList.add('on');
    pulse(tag, 'pop-in');
    note.textContent = `${ships} shipped`;
    good(pipe);
    fx.pop(pipe, 'SHIPPED!', 'gold');
    fx.burst(pipe, 'gold', 26);
    fx.flash('gold');
    fx.sound('coin');
    fx.sound('power');
  }

  function sync(t: number) {
    if (partyUntil >= 0 && t >= partyUntil) {
      partyUntil = -1;
      pipe.classList.remove('shipped');
      reels.forEach(paint);
      speak(again);
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
      speak(retry);
      fx.sound('thud');
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
      } else {
        r.mode = 'fail';
        r.jamUntil = t + JAM;
        refill(r);
        bank = Math.max(0, bank - BREAK);
        paint(r);
        pulse(r.el, 'jam');
        speak(broke, 'oops');
        bad(pipe, 'YOU BROKE IT');
        fx.sound('boing');
      }
    },
    tick: sync,
    score: () => clamp1000((1000 * (bank + 0.2 * reels.filter((r) => r.mode === 'pass').length)) / par),
    hint(t) {
      if (partyUntil >= 0) return null;
      const todo = reels.flatMap((r, i) => (r.mode === 'fail' && t >= r.jamUntil ? [i as Btn] : []));
      return todo.length ? todo : null;
    },
  };
};
