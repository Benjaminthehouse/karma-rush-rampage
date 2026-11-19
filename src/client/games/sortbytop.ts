import './sortbytop.css';
import { COLOR, arrow, h, pick, pulse, randBtn, ratio, shuffled, type Btn, type GameFactory } from './common';

const TITLES = [
  'My cat pays rent',
  'TIL soup is a drink',
  'AITA for napping?',
  'Rate my rock',
  'I ate the homework',
  'Dog files a patent',
  'Bird stole my fries',
  'ELI5: what is Monday',
  'LPT: drink water',
  'First post, be nice',
  'Update: it got worse',
  'Is this a good bean?',
];
/** The instruction for the first, second and third pick: [before, underlined, after]. */
const ASKS = [
  ['Tap the ', 'highest', ' score'],
  ['Now the ', 'next highest', ''],
  ['Then the ', 'last one', ''],
];

/** A score the way a feed shows it: 847, 1.2k, 12.4k. */
function label(n: number): string {
  const size = Math.abs(n);
  return (n < 0 ? '−' : '') + (size < 1000 ? size : `${(size / 1000).toFixed(1)}k`);
}
/** Rounds to what the label can show, so two posts never look tied. */
const snap = (v: number) => (v < 1000 ? Math.round(v) : Math.round(v / 100) * 100);

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = Math.round(27 + level * 1.5); // a flawless set is worth 5
  const spread = 1.1 - level * 0.22; // how many powers of ten the three scores may sit apart
  const sets = Array.from({ length: 24 }, () => {
    // From level 3 some sets are downvoted: small numbers, two of them below zero.
    const sunk = level >= 3 && rng() < 0.3;
    let vals: number[];
    do {
      // Later rounds huddle around 1k and 10k, where 999 meets 1.0k.
      const mid = sunk ? 1.3 : rng() < level * 0.15 ? pick(rng, [3, 4]) : 2 + rng() * 2.2;
      vals = [0, 1, 2].map(() => snap(10 ** Math.min(4.95, mid + spread * (rng() * 2 - 1))));
    } while (new Set(vals).size < 3);
    if (sunk) {
      const keep = randBtn(rng);
      vals = vals.map((v, i) => (i === keep ? v : -v));
    }
    const order = ([0, 1, 2] as Btn[]).sort((a, b) => vals[b] - vals[a]);
    return { vals, order, titles: shuffled(rng, TITLES).slice(0, 3) };
  });
  let idx = 0;
  let picked: Btn[] = [];
  let clean = true; // no wrong press in this set yet
  let points = 0;
  let done = 0;
  let flawless = 0;
  let lockedUntil = 0;
  let dealAt = 0; // when the next set arrives; 0 while a set is in play

  const wrap = h('div', 'g-sortbytop pix');
  const rule = h('div', 'rule');
  const row = h('div', 'row');
  const cards = [0, 1, 2].map((i) => {
    const el = h('div', `card c-${COLOR[i]}`);
    const vote = arrow('up');
    const num = h('b', 'num');
    const title = h('span', 'title');
    const stamp = h('em', 'stamp');
    el.append(vote, stamp, num, title);
    row.append(el);
    return { el, vote, num, title, stamp };
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(rule, row, meter, note);
  root.append(wrap);

  const score = () => ratio(points, par);
  const current = () => sets[idx % sets.length];

  function tally() {
    const [before, key, after] = ASKS[picked.length % 3];
    rule.replaceChildren(before, h('b', '', key), after);
    fill.style.width = `${score() / 10}%`;
    note.textContent = done ? `${done} sorted, ${flawless} perfect` : 'Front page needs sorting!';
  }

  function show() {
    const s = current();
    cards.forEach((c, i) => {
      c.el.classList.remove('ranked');
      c.vote.classList.toggle('down', s.vals[i] < 0);
      c.num.textContent = label(s.vals[i]);
      c.title.textContent = s.titles[i];
    });
    pulse(row, 'pop-in');
  }
  show();
  tally();

  return {
    press(b, t) {
      if (t < lockedUntil || dealAt) return;
      const s = current();
      const want = s.order[picked.length];
      const card = cards[b];
      if (picked.includes(b)) return pulse(card.el, 'shake');
      if (b !== want) {
        points = Math.max(0, points - 1);
        clean = false;
        lockedUntil = t + 400;
        pulse(card.el, 'shake');
        bad(row, `${label(s.vals[want])} > ${label(s.vals[b])}`);
        tally();
        return;
      }
      picked.push(b);
      points++;
      card.stamp.textContent = `#${picked.length}`;
      card.el.classList.add('ranked');
      good(card.el);
      if (picked.length === 3) {
        done++;
        dealAt = t + 200;
        fx.pop(row, clean ? 'PERFECT SORT! +2' : 'SORTED', clean ? 'gold' : 'white');
        fx.sound(clean ? 'coin' : 'ding');
        if (clean) {
          points += 2;
          flawless++;
          fx.burst(row, 'gold', 20);
        }
      }
      tally();
    },
    tick(t) {
      row.classList.toggle('locked', t < lockedUntil);
      if (!dealAt || t < dealAt) return;
      dealAt = 0;
      idx++;
      picked = [];
      clean = true;
      show();
      tally();
      fx.sound('whoosh');
    },
    score,
    hint: (t) => (t < lockedUntil || dealAt ? null : current().order[picked.length]),
  };
};
