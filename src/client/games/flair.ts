import { COLOR, COLOR_NAME, h, pulse, randBtn, type Btn, type GameFactory } from './common';

export const flair: GameFactory = ({ root, rng, level, good, bad }) => {
  const byWord = rng() < 0.5;
  const n = 9 + level;
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
  rule.innerHTML = byWord
    ? 'Press what the flair <b>SAYS</b>'
    : 'Press the flair’s <b>COLOUR</b>';
  const pill = h('div', 'flair-pill');
  const note = h('div', 'g-note');
  wrap.append(rule, pill, note);
  root.append(wrap);

  function show() {
    const c = cards[idx];
    if (!c) {
      pill.className = 'flair-pill empty';
      pill.textContent = 'All flaired!';
      note.textContent = '';
      return;
    }
    pill.className = `flair-pill ink-${COLOR[c.ink]}`;
    pill.textContent = COLOR_NAME[c.word];
    pulse(pill, 'pop-in');
    note.textContent = `${n - idx} left`;
  }
  show();

  return {
    press(b: Btn) {
      const c = cards[idx];
      if (!c) return;
      if (b === (byWord ? c.word : c.ink)) {
        right++;
        good();
      } else {
        wrong++;
        pulse(wrap, 'shake');
        bad();
      }
      idx++;
      show();
    },
    tick() {},
    score: () => Math.max(0, Math.round((1000 * (right - wrong / 2)) / n)),
  };
};
