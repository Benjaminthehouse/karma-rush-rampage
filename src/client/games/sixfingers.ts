import './sixfingers.css';
import { clamp1000, h, pick, pulse, randBtn, type GameFactory } from './common';

const SKINS = ['gold', 'pink', 'teal', 'ink'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + Math.floor(level * 0.75);
  const rounds = Array.from({ length: 24 }, () => {
    const fake = randBtn(rng);
    // Early on the AI always adds a finger; later it sometimes loses one.
    const wrongCount = level >= 2 && rng() < 0.4 ? 4 : 6;
    return {
      fake,
      hands: [0, 1, 2].map((i) => ({
        n: i === fake ? wrongCount : 5,
        skin: pick(rng, SKINS),
        lens: Array.from({ length: 6 }, () => 0.62 + rng() * 0.38),
        tilt: (rng() - 0.5) * (8 + level * 5),
      })),
    };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-sixfingers');
  // The one rule, kept on screen: colour, tilt and finger length are all decoys.
  // It sits under the hands because pop text rises from the top edge of a slot.
  const rule = h('div', 'rule');
  rule.innerHTML = 'Real hands have <b>5</b> fingers';
  const row = h('div', 'row');
  const slots = [0, 1, 2].map(() => {
    const slot = h('div', 'slot');
    row.append(slot);
    return slot;
  });
  const note = h('div', 'g-note');
  wrap.append(row, rule, note);
  root.append(wrap);

  function show() {
    const r = rounds[idx % rounds.length];
    slots.forEach((slot, i) => {
      const hand = r.hands[i];
      const el = h('div', `hand ${hand.skin}`);
      el.style.transform = `rotate(${hand.tilt}deg)`;
      const fingers = h('div', 'fingers');
      for (let f = 0; f < hand.n; f++) {
        const finger = h('i');
        finger.style.height = `${hand.lens[f] * 100}%`;
        fingers.append(finger);
      }
      el.append(fingers, h('b'));
      slot.replaceChildren(el);
    });
    pulse(row, 'pop-in');
    note.textContent = `${right} fakes caught`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const r = rounds[idx % rounds.length];
      if (b === r.fake) {
        right++;
        good(slots[b], r.hands[b].n === 6 ? 'SIX!' : 'FOUR!');
        fx.burst(slots[b], 'purple', 10);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(slots[b], 'THAT ONE IS REAL');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].fake : null),
  };
};
