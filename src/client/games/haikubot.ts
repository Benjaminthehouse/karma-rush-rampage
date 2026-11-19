import './haikubot.css';
import { COLOR, arrow, h, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

// Spaces split words, hyphens split the syllables inside a word: 5, 7, 5.
const HAIKUS = [
  ['mods are a-sleep now', 'post the for-bid-den cat pics', 'front page here we come'],
  ['ed-it: thanks for gold', 'kind stran-ger you made my day', 'wow this blew right up'],
  ['I am not a bot', 'this ac-tion was per-formed by', 'a hu-man, I swear'],
  ['source? I made it up', 'ten thou-sand up-votes say yes', "trust me bro, it's true"],
  ['re-post from last week', 'same cat but few-er pix-els', 'up-vot-ed a-gain'],
  ['sort-ed by new-est', 'ze-ro up-votes, no com-ments', 'I have found my peace'],
  ['pro tip: drink wa-ter', 'al-so go out-side some-times', 'touch a lit-tle grass'],
  ['read just the head-line', 'wrote six an-gry par-a-graphs', 'did not click the link'],
  ['cake day once a-gain', 'ten years of lurk-ing in here', 'have not post-ed once'],
  ['the serv-ers are down', 'we have tried turn-ing it off', 'and then on a-gain'],
  ['un-pop-u-lar take', 'piz-za is bet-ter when cold', 'down-vote me, I dare'],
  ['am I the bad guy', 'for eat-ing the last cook-ie', 'the votes say I am'],
];
const SIZES = [5, 7, 5];
const ALL = 17;

const syllables = (line: string) =>
  line.split(' ').flatMap((word) => word.split('-').map((part, i, parts) => (i < parts.length - 1 ? `${part}-` : part)));

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Nobody can type every haiku; 1000 points means reaching the par syllable count.
  const par = 48 + level * 3;
  const deck = shuffled(rng, HAIKUS);
  const filled = [0, 0, 0];
  let posted = 0;

  const wrap = h('div', 'g-haikubot');
  const card = h('div', 'card');
  const head = h('div', 'head');
  const face = h('div', 'face');
  face.append(h('i'), h('i'));
  head.append(face, h('b', 'name', 'u/haiku_bot'), h('span', 'flair', 'BOT'));
  const poem = h('div', 'poem');
  const lines = SIZES.map((size, i) => {
    const line = h('div', `line c-${COLOR[i]}`);
    const cells = Array.from({ length: size }, () => h('span', 'syl'));
    line.append(...cells);
    poem.append(line);
    return { line, cells };
  });
  // The comment's vote count is the syllable count: it climbs with every tap.
  const foot = h('div', 'foot');
  const votes = h('b', 'votes');
  const tally = h('div', 'tally');
  foot.append(arrow('up'), votes, tally);
  card.append(head, poem, foot);
  wrap.append(card);
  root.append(wrap);
  const typed = () => posted * ALL + filled[0] + filled[1] + filled[2];

  function wipe(b: number) {
    filled[b] = 0;
    lines[b].line.classList.remove('full', 'spill');
    lines[b].cells.forEach((cell) => cell.classList.remove('on'));
    votes.textContent = String(typed());
  }

  function deal() {
    const haiku = deck[posted % deck.length];
    lines.forEach((l, b) => {
      wipe(b);
      syllables(haiku[b]).forEach((s, i) => (l.cells[i].textContent = s));
    });
    tally.textContent = `GOOD BOT ×${posted}`;
    pulse(poem, 'pop-in');
  }
  deal();

  return {
    press(b) {
      const { line, cells } = lines[b];
      if (filled[b] === SIZES[b]) {
        // One syllable too many: the whole line falls off.
        wipe(b);
        pulse(line, 'spill');
        bad(line, 'BAD BOT');
        return;
      }
      const cell = cells[filled[b]++];
      cell.classList.add('on');
      votes.textContent = String(typed());
      good(cell);
      if (filled[b] < SIZES[b]) return;
      if (filled.every((n, i) => n === SIZES[i])) {
        posted++;
        fx.pop(poem, 'GOOD BOT!', 'gold');
        fx.burst(poem, 'gold', 20);
        fx.flash('gold');
        fx.sound('coin');
        deal();
        pulse(tally, 'bump');
        return;
      }
      line.classList.add('full');
      fx.pop(line, `${SIZES[b]}!`, COLOR[b]);
      fx.burst(line, COLOR[b], 10);
      fx.sound('ding');
    },
    tick() {},
    score: () => ratio(typed(), par),
    hint: () => ([0, 1, 2] as Btn[]).find((b) => filled[b] < SIZES[b]) ?? null,
  };
};
