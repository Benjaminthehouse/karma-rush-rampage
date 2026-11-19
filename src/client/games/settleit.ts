import './settleit.css';
import { clamp1000, h, pick, pulse, type Btn, type GameFactory } from './common';

const HANDS = ['rock', 'paper', 'scissors'];
const BEATS: Btn[] = [1, 2, 0]; // what beats rock, paper, scissors
const TROLLS = ['u/ackshually', 'u/source_pls', 'u/no_u', 'u/well_actually', 'u/reply_guy', 'u/debate_me', 'u/ratio_king', 'u/big_if_true'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 13 + level;
  let prev = -1;
  const foes = Array.from({ length: 40 }, () => {
    let hand = Math.floor(rng() * 3);
    // Mostly a fresh hand each time, so it is never a one-button mash.
    if (hand === prev && rng() < 0.8) hand = (hand + 1 + Math.floor(rng() * 2)) % 3;
    prev = hand;
    return { hand, who: pick(rng, TROLLS) };
  });
  let idx = 0;
  let wins = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-settleit');
  const who = h('div', 'who');
  const hand = h('div', 'hand');
  const shape = h('i');
  const name = h('span');
  hand.append(shape, name);
  const note = h('div', 'g-note');
  wrap.append(who, hand, note);
  root.append(wrap);

  function show() {
    const f = foes[idx % foes.length];
    who.textContent = `${f.who} throws`;
    shape.className = HANDS[f.hand];
    name.textContent = HANDS[f.hand].toUpperCase();
    pulse(hand, 'pop-in');
    note.textContent = `${wins} arguments won`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const f = foes[idx % foes.length];
      if (b === BEATS[f.hand]) {
        wins++;
        good(hand, 'OWNED');
        if (wins % 5 === 0) fx.burst(hand, 'gold', 16);
      } else {
        wrong++;
        lockedUntil = t + 350;
        bad(hand, b === f.hand ? 'DRAW' : 'RATIOED');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (wins - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? BEATS[foes[idx % foes.length].hand] : null),
  };
};
