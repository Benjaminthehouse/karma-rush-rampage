import './flair.css';
import { actor, COLOR, COLOR_NAME, clamp1000, h, pulse, randBtn, setSprite, sprite, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const byWord = rng() < 0.5;
  const par = 14 + level;
  const n = 44;
  const cards: { word: Btn; ink: Btn }[] = [];
  while (cards.length < n) {
    const word = randBtn(rng);
    let ink = randBtn(rng);
    if (ink === word && rng() < 0.75) ink = ((word + 1 + Math.floor(rng() * 2)) % 3) as Btn;
    // Never the same flair twice running: that reads as "my press did nothing".
    const last = cards[cards.length - 1];
    if (!last || last.word !== word || last.ink !== ink) cards.push({ word, ink });
  }
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lastOk = true;
  let angryUntil = 0;

  // The scene: a flair tagging stand on feed street. Mod Bear holds up the rule sign;
  // flair tags ride a conveyor past the stand, one at a time under the stamp.
  const wrap = h('div', 'g-flair scene-street');
  const top = h('div', 'top');
  const bear = actor('modbear', { px: 0.54 });
  const sign = h('div', 'sign');
  const rule = h('div', 'rule');
  rule.innerHTML = byWord ? 'Tag what the flair <b>SAYS</b>' : 'Tag the flair’s <b>COLOUR</b>';
  sign.append(rule, h('i', 'stick'));
  top.append(bear.el, sign);
  const note = h('div', 'tally');
  const stand = h('div', 'stand');
  const row = h('div', 'row');
  // Left: the tag just stamped. Middle: the tag to tag now. Right: the next one, face down.
  const prev = h('div', 'tag prev');
  const prevWord = h('span', 'word');
  const prevStamp = sprite('check', { px: 0.22 }, 'stamp');
  prev.append(prevWord, prevStamp);
  const pill = h('div', 'tag pill');
  const next = h('div', 'tag next', '?');
  row.append(prev, pill, next);
  const belt = h('div', 'belt');
  const tread = h('i', 'tread');
  belt.append(tread);
  // The booth: a striped awning with the tally on it, the back wall, the belt on two legs.
  const awning = h('div', 'awning');
  awning.append(note);
  const legs = h('div', 'legs');
  legs.append(h('i'), h('i'));
  stand.append(awning, row, belt, legs);
  wrap.append(top, stand);
  root.append(wrap);

  const answer = () => (cards[idx] ? (byWord ? cards[idx].word : cards[idx].ink) : null);

  function show() {
    const c = cards[idx];
    const p = cards[idx - 1];
    prev.classList.toggle('gone', !p);
    if (p) {
      prev.className = `tag prev ink-${COLOR[p.ink]} ${lastOk ? 'ok' : 'no'}`;
      prevWord.textContent = COLOR_NAME[p.word];
      setSprite(prevStamp, lastOk ? 'check' : 'cross', { px: 0.22 });
    }
    next.classList.toggle('gone', !cards[idx + 1]);
    if (!c) {
      pill.className = 'tag pill empty';
      pill.textContent = 'All flaired!';
      note.textContent = `${right} tagged`;
      return;
    }
    pill.className = `tag pill ink-${COLOR[c.ink]}`;
    pill.textContent = COLOR_NAME[c.word];
    if (idx) {
      pulse(pill, 'slide');
      pulse(prev, 'slide');
      pulse(tread, 'roll');
    }
    note.textContent = `${right} tagged`;
  }
  show();

  return {
    press(b, t) {
      const want = answer();
      if (want === null) return;
      if (b === want) {
        right++;
        lastOk = true;
        good(pill);
      } else {
        wrong++;
        lastOk = false;
        bear.mood('angry');
        angryUntil = t + 400;
        // From the rule sign, so the verdict never covers the next flair.
        bad(sign, 'NOPE');
      }
      idx++;
      show();
    },
    tick(t) {
      if (angryUntil && t >= angryUntil) {
        angryUntil = 0;
        bear.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: () => answer(),
  };
};
