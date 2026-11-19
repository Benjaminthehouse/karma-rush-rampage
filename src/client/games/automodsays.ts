import './automodsays.css';
import { COLOR, COLOR_NAME, clamp1000, h, pick, pulse, randBtn, type GameFactory } from './common';

const FAKES = ['AutoMaud', 'OttoMod', 'AutoMob', 'Aut0Mod', 'AutoModd', 'NotAMod', 'AutoToad', 'AutoMood'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + level;
  const ignoreMs = 600 - level * 50; // how long an impostor lingers before leaving
  let lastFake = true;
  const prompts = Array.from({ length: 60 }, () => {
    // Never two impostors in a row, so the round keeps moving.
    const fake = !lastFake && rng() < 0.38;
    lastFake = fake;
    return { fake, btn: randBtn(rng), name: fake ? pick(rng, FAKES) : 'AutoModerator' };
  });
  let idx = 0;
  let shownAt = 0;
  let obeyed = 0;
  let wrong = 0;
  // An impostor that has just left still counts for a moment: nobody reads a new order
  // that fast, so a wrong press in this window was aimed at the impostor.
  let armedUntil = 0;

  const wrap = h('div', 'g-automodsays');
  const bubble = h('div', 'bubble');
  const who = h('div', 'who');
  const shield = h('i', 'shield');
  const name = h('span', 'name');
  who.append(shield, name);
  const order = h('div', 'order');
  // Verdicts float up from just above the bubble, so they never cover the next name and shield.
  const stamp = h('i', 'stamp');
  bubble.append(who, order, stamp);
  const note = h('div', 'g-note');
  wrap.append(bubble, note);
  root.append(wrap);

  function show(t: number) {
    const p = prompts[idx % prompts.length];
    shownAt = t;
    bubble.className = `bubble ${p.fake ? 'fake' : 'real'}`;
    name.textContent = p.name;
    order.innerHTML = `Press <b class="t-${COLOR[p.btn]}">${COLOR_NAME[p.btn]}</b>`;
    pulse(bubble, 'pop-in');
    note.textContent = `${obeyed} obeyed`;
  }
  show(0);

  return {
    press(b, t) {
      const p = prompts[idx % prompts.length];
      const late = t < armedUntil;
      if (late) armedUntil = 0;
      if (late && b !== p.btn) {
        // Fell for the impostor a beat too late: say so, and keep the real order on screen.
        wrong++;
        bad(stamp, 'IMPOSTOR!');
        return;
      }
      if (p.fake) {
        wrong++;
        bad(stamp, 'IMPOSTOR!');
      } else if (b === p.btn) {
        obeyed++;
        good(stamp);
      } else {
        wrong++;
        bad(stamp, 'WRONG COLOUR');
      }
      idx++;
      show(t);
    },
    tick(t) {
      if (armedUntil && t >= armedUntil) {
        armedUntil = 0;
        fx.pop(stamp, 'IGNORED', 'green');
      }
      if (prompts[idx % prompts.length].fake && t - shownAt >= ignoreMs) {
        fx.sound('whoosh');
        armedUntil = t + 200;
        idx++;
        show(t);
      }
    },
    score: () => clamp1000((1000 * (obeyed - wrong)) / par),
    hint() {
      const p = prompts[idx % prompts.length];
      return p.fake ? null : p.btn;
    },
  };
};
