import './flair.css';
import { COLOR, COLOR_NAME, clamp1000, h, pulse, randBtn, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, good, bad }) => {
  const byWord = rng() < 0.5;
  const par = 14 + level;
  const n = 44;
  const cards = Array.from({ length: n }, () => {
    const word = randBtn(rng);
    let ink = randBtn(rng);
    if (ink === word && rng() < 0.75) ink = ((word + 1 + Math.floor(rng() * 2)) % 3) as Btn;
    return { word, ink };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;

  const wrap = h('div', 'g-flair');
  const rule = h('div', 'rule');
  rule.innerHTML = byWord ? 'Press what the flair <b>SAYS</b>' : 'Press the flair’s <b>COLOUR</b>';
  const pill = h('div', 'pill');
  const note = h('div', 'g-note');
  wrap.append(rule, pill, note);
  root.append(wrap);

  const answer = () => (cards[idx] ? (byWord ? cards[idx].word : cards[idx].ink) : null);

  function show() {
    const c = cards[idx];
    if (!c) {
      pill.className = 'pill empty';
      pill.textContent = 'All flaired!';
      note.textContent = '';
      return;
    }
    pill.className = `pill ink-${COLOR[c.ink]}`;
    pill.textContent = COLOR_NAME[c.word];
    pulse(pill, 'pop-in');
    note.textContent = `${right} tagged`;
  }
  show();

  return {
    press(b) {
      const want = answer();
      if (want === null) return;
      if (b === want) {
        right++;
        good(pill);
      } else {
        wrong++;
        bad(pill, 'NOPE');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: () => answer(),
  };
};
