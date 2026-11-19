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
// Counts are spelled out wherever they float over the stage: the pixel display font draws 5 like an S.
const WORD = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];

const syllables = (line: string) =>
  line.split(' ').flatMap((word) => word.split('-').map((part, i, parts) => (i < parts.length - 1 ? `${part}-` : part)));

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Nobody can type every haiku; 1000 points means reaching the par syllable count:
  // six clean taps a second on the first round, seven on the last.
  const par = 48 + level * 2;
  const deck = shuffled(rng, HAIKUS);
  const filled = [0, 0, 0];
  let posted = 0;
  // A burst that runs a tap past the end of a haiku is swallowed, not buzzed.
  const GRACE = 280;
  let graceUntil = 0;

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
  // The bot types top to bottom: the line being typed is the first one with room left.
  // (A full haiku is posted and dealt again at once, so there always is one.)
  const turn = () => filled.findIndex((n, i) => n < SIZES[i]) as Btn;

  function refresh() {
    const now = turn();
    lines.forEach((l, i) => l.line.classList.toggle('now', i === now));
    votes.textContent = String(typed());
  }

  // Restart one of the line's one-shot animations (they share the `animation` property).
  function jolt(line: HTMLElement, cls: 'spill' | 'nudge') {
    line.classList.remove('spill', 'nudge');
    pulse(line, cls);
  }

  function wipe(b: number) {
    filled[b] = 0;
    lines[b].line.classList.remove('full', 'spill', 'nudge');
    lines[b].cells.forEach((cell) => cell.classList.remove('on'));
  }

  function deal() {
    const haiku = deck[posted % deck.length];
    lines.forEach((l, b) => {
      wipe(b);
      syllables(haiku[b]).forEach((s, i) => (l.cells[i].textContent = s));
    });
    tally.textContent = `GOOD BOT ×${posted}`;
    refresh();
    pulse(poem, 'pop-in');
  }
  deal();

  return {
    press(b, t) {
      const now = turn();
      if (b > now) {
        // Not this line's turn yet. Mashing every button gets nowhere; a miscount gets told what is missing.
        if (b === 2 && t < graceUntil) return;
        jolt(lines[now].line, 'nudge');
        bad(lines[now].line);
        fx.pop(lines[now].line, `${WORD[SIZES[now] - filled[now]]} MORE`, COLOR[now]);
        return;
      }
      const { line, cells } = lines[b];
      if (b < now) {
        // One syllable too many on a finished line: the whole line falls off.
        wipe(b);
        refresh();
        jolt(line, 'spill');
        bad(line, 'BAD BOT');
        return;
      }
      const cell = cells[filled[b]++];
      cell.classList.add('on');
      good(cell);
      if (filled[b] < SIZES[b]) {
        refresh();
        return;
      }
      if (b === 2) {
        // The last line can only be typed once the first two are full: post it.
        posted++;
        graceUntil = t + GRACE;
        fx.pop(poem, 'GOOD BOT!', 'gold');
        fx.burst(poem, 'gold', 20);
        fx.flash('gold');
        fx.sound('coin');
        deal();
        pulse(tally, 'bump');
        return;
      }
      line.classList.add('full');
      refresh();
      fx.pop(line, `${WORD[SIZES[b]]}!`, COLOR[b]);
      fx.burst(line, COLOR[b], 10);
      fx.sound('ding');
    },
    tick() {},
    score: () => ratio(typed(), par),
    hint: () => turn(),
  };
};
