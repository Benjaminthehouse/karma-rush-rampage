import './settleit.css';
import { actor, clamp1000, defineSprite, h, pick, pulse, setSprite, sprite, type Btn, type GameFactory } from './common';

const HANDS = ['rock', 'paper', 'scissors'];
const BEATS: Btn[] = [1, 2, 0]; // what beats rock, paper, scissors
const TROLLS = ['u/ackshually', 'u/source_pls', 'u/no_u', 'u/well_actually', 'u/reply_guy', 'u/debate_me', 'u/ratio_king', 'u/big_if_true'];

// The three throws, drawn as the things themselves.
defineSprite('settleit-rock', `
............
............
....kkkk....
..kkddddkk..
.kdwdddddDk.
.kdddddddDk.
kddddddddDDk
kdddddDdddDk
kddddddddDDk
.kDdddddDDk.
..kkDDDDkk..
....kkkk....`);
defineSprite('settleit-paper', `
.kkkkkkkk...
.kwwwwwwkk..
.kwddddwkwk.
.kwwwwwwkkkk
.kwddddddwwk
.kwwwwwwwwwk
.kwdddddddwk
.kwwwwwwwwwk
.kwddddddwwk
.kwwwwwwwwwk
.kDDDDDDDDDk
.kkkkkkkkkkk`);
defineSprite('settleit-scissors', `
kk........kk
kdk......kdk
.kdk....kdk.
..kdk..kdk..
...kdkkdk...
....kxxk....
...kpkkpk...
..kpk..kpk..
.kpk....kpk.
kpk......kpk
kppk....kppk
.kk......kk.`);
const HPX = 0.34; // a throw is about 4em

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
  let calmAt = 0;
  let clearAt = 0; // when OP's last throw is put away, so it is never read against the next hand

  // The scene: a courtroom duel. Mod Bear referees from the bench; the Troll throws from
  // the top right and OP Cat answers from the bottom left.
  const wrap = h('div', 'g-settleit scene-court');
  const ref = h('div', 'ref');
  const bear = actor('modbear', { mood: 'peep', px: 0.34 });
  ref.append(bear.el, h('div', 'plate', 'REFEREE'));

  const foeRow = h('div', 'row foe');
  const foeThrow = h('div', 'throw');
  const foeHand = sprite('settleit-rock', { px: HPX }, 'hand');
  const foeName = h('b', 'name');
  foeThrow.append(foeHand, foeName);
  const troll = actor('troll', { mood: 'wink', px: 0.36 });
  const foeSide = h('div', 'side');
  const who = h('div', 'tag');
  foeSide.append(troll.el, who);
  foeRow.append(foeThrow, foeSide);

  const youRow = h('div', 'row you');
  const op = actor('op', { mood: 'idle', px: 0.36 });
  const youSide = h('div', 'side');
  youSide.append(op.el, h('div', 'tag', 'OP (you)'));
  const youThrow = h('div', 'throw mine idle');
  const youHand = sprite('settleit-rock', { px: HPX }, 'hand');
  const youName = h('b', 'name', '?');
  youThrow.append(youHand, youName);
  youRow.append(youSide, youThrow);

  const note = h('div', 'note');
  wrap.append(ref, foeRow, youRow, note);
  root.append(wrap);

  function show() {
    const f = foes[idx % foes.length];
    who.textContent = `${f.who} throws`;
    setSprite(foeHand, `settleit-${HANDS[f.hand]}`, { px: HPX });
    foeName.textContent = HANDS[f.hand].toUpperCase();
    pulse(foeThrow, 'pop-in');
    note.textContent = `${wins} argument${wins === 1 ? '' : 's'} won`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const f = foes[idx % foes.length];
      // OP throws whatever you pressed.
      setSprite(youHand, `settleit-${HANDS[b]}`, { px: HPX });
      youName.textContent = HANDS[b].toUpperCase();
      youThrow.className = 'throw mine';
      pulse(youThrow, 'bump');
      clearAt = t + 320;
      if (b === BEATS[f.hand]) {
        wins++;
        op.mood('happy');
        troll.mood('dead');
        bear.mood('peep');
        pulse(troll.el, 'shake');
        // The verdict floats up from under the card, so it never covers the next hand.
        good(foeThrow);
        fx.pop(note, 'OWNED', 'gold');
        if (wins % 5 === 0) fx.burst(foeThrow, 'gold', 16);
      } else {
        wrong++;
        lockedUntil = t + 350;
        const draw = b === f.hand;
        op.mood(draw ? 'shock' : 'sad');
        troll.mood('happy');
        bear.mood('angry');
        calmAt = t + 350;
        pulse(op.el, 'shake');
        bad(note, draw ? 'DRAW' : 'RATIOED');
      }
      idx++;
      show();
      // The Troll gets its smugness back as soon as it throws again.
      if (b === BEATS[f.hand]) calmAt = t + 250;
    },
    tick(t) {
      if (clearAt && t >= clearAt) {
        clearAt = 0;
        youThrow.className = 'throw mine idle';
        youName.textContent = '?';
      }
      if (calmAt && t >= calmAt) {
        calmAt = 0;
        bear.mood('peep');
        troll.mood('wink');
      }
    },
    score: () => clamp1000((1000 * (wins - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? BEATS[foes[idx % foes.length].hand] : null),
  };
};
