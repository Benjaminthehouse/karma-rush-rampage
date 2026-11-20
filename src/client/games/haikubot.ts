import './haikubot.css';
import { actor, COLOR, arrow, defineSprite, h, pulse, ratio, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// The bot's calligraphy brush.
defineSprite('haikubot-brush', `
.........kk.
........kyyk
.......kyyk.
......knnk..
.....knnk...
....knnk....
...kxxk.....
..kxxk......
.kkxk.......
kkkk........`);

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

  // The scene: a zen garden off feed street. The little haiku robot stands at the top with its
  // brush; below, three rows of stones in the raked sand, 5, 7 and 5, one syllable painted per tap.
  const wrap = h('div', 'g-haikubot scene-street');
  const top = h('div', 'top');
  const painter = h('div', 'painter');
  const bot = actor('automod', { px: 0.42 });
  const brush = sprite('haikubot-brush', { px: 0.28 }, 'brush');
  painter.append(bot.el, brush);
  const sign = h('div', 'sign');
  const head = h('div', 'head');
  head.append(h('b', 'name', 'u/haiku_bot'), h('span', 'flair', 'BOT'));
  // The comment's vote count is the syllable count: it climbs with every tap.
  const foot = h('div', 'foot');
  const votes = h('b', 'votes');
  foot.append(arrow('up', '', 'orange', 0.13), votes);
  const tally = h('div', 'tally');
  sign.append(head, foot, tally);
  top.append(painter, sign);
  const poem = h('div', 'poem');
  const lines = SIZES.map((size, i) => {
    const line = h('div', `line c-${COLOR[i]}`);
    const cells = Array.from({ length: size }, () => h('span', 'syl'));
    line.append(...cells);
    poem.append(line);
    return { line, cells };
  });
  wrap.append(top, poem);
  root.append(wrap);
  let moodUntil = 0;
  let calm = true;
  function face(m: ActorMood, t: number, ms = 300) {
    bot.mood(m);
    moodUntil = t + ms;
    calm = false;
  }
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
        face('shock', t);
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
        face('angry', t, 450);
        pulse(bot.el, 'shake');
        bad(line, 'BAD BOT');
        return;
      }
      const cell = cells[filled[b]++];
      cell.classList.add('on');
      if (calm || moodUntil - t < 300) face('talk', t, 160);
      pulse(brush, 'dab');
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
        face('happy', t, 500);
        deal();
        pulse(tally, 'bump');
        return;
      }
      line.classList.add('full');
      refresh();
      fx.pop(line, `${WORD[SIZES[b]]}!`, COLOR[b]);
      fx.burst(line, COLOR[b], 10);
      fx.sound('ding');
      face('happy', t, 350);
    },
    tick(t) {
      if (!calm && t >= moodUntil) {
        calm = true;
        bot.mood('idle');
      }
    },
    score: () => ratio(typed(), par),
    hint: () => turn(),
  };
};
