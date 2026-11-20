import './sixfingers.css';
import { actor, clamp1000, defineSprite, h, pick, pulse, randBtn, sprite, type ActorMood, type GameFactory } from './common';

// The AI painter's beret and palette: AutoMod has taken up art.
defineSprite('sixfingers-beret', `
.......kk.......
......kppk......
...kkkkkkkkkk...
.kkppppppppppkk.
kppPppppppppppPk
kPPPPPPPPPPPPPPk
.kkkkkkkkkkkkkk.`);
defineSprite('sixfingers-palette', `
...kkkkkkk..
.kknnnnnnnkk
knnrrnnggnnk
knrrnnnggnnk
knnnnnn..nnk
knbbnnn..nnk
knbbnnyynnnk
.knnnnyynnk.
..kkkkkkkk..`);

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

  // The scene: a street art fair. Three framed hands stand on easels; the AI painter
  // (AutoMod in a beret) waits at the front to see if you can tell which one it painted.
  const wrap = h('div', 'g-sixfingers scene-street');
  // The one rule, kept on screen as the fair's banner: colour, tilt and finger length are all decoys.
  const rule = h('div', 'rule');
  rule.innerHTML = 'Real hands have <b>5</b> fingers';
  const row = h('div', 'row');
  const slots = [0, 1, 2].map(() => {
    const easel = h('div', 'easel');
    const slot = h('div', 'slot');
    easel.append(slot, h('i', 'legs'));
    row.append(easel);
    return slot;
  });
  const front = h('div', 'front');
  const painter = h('div', 'painter');
  const bot = actor('automod', { px: 0.4 });
  painter.append(sprite('sixfingers-beret', { px: 0.4 }, 'beret'), bot.el);
  const palette = sprite('sixfingers-palette', { px: 0.26 }, 'palette');
  const note = h('div', 'tally');
  front.append(palette, painter, note);
  wrap.append(rule, row, front);
  root.append(wrap);
  let moodUntil = 0;
  function face(m: ActorMood, t: number) {
    bot.mood(m);
    moodUntil = t + 450;
  }

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
        face('shock', t); // caught out
        pulse(bot.el, 'shake');
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(slots[b], 'THAT ONE IS REAL');
        face('happy', t); // fooled you
        pulse(bot.el, 'bump');
      }
      idx++;
      show();
    },
    tick(t) {
      if (moodUntil && t >= moodUntil) {
        moodUntil = 0;
        bot.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].fake : null),
  };
};
