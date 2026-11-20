import './selfpromo.css';
import { actor, COLOR, dealer, h, padDots, postCard, pulse, randBtn, randInt, ratio, setSprite, sprite, type Btn, type GameFactory } from './common';

const PITCHES = [
  'I vibecoded this in a weekend!',
  'Not an ad, just sharing my app',
  'Roast my landing page?',
  'My app has 3 users (2 are me)',
  'Built with zero coding skills!',
  'It’s like chat, but for dogs',
  'Day 1 of posting until I go viral',
  'Honest feedback? (say it’s good)',
];
const SUBS = ['r/ShipIt', 'r/VibeCoders', 'r/RoastMyApp', 'r/WeekendApps', 'r/IndieBuilds', 'r/JustLaunched'];
/** Which drawing of the mod bear each moment shows (art/selfpromo). */
const MOOD = { nap: 'sleep', warn: 'peep', watch: 'angry' } as const;
const SIGN = { nap: 'zed', warn: 'quest', watch: 'bang' } as const;
const PER_CARD = 3; // plugs of one pitch before the next card, in a new colour
const GRACE = 300; // ms after a card changes in which presses on its old colour are forgiven

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The mod alternates between napping and watching. `warn` is the tell before they look.
  const warn = 420 - level * 40;
  const spans: { from: number; to: number; watch: boolean }[] = [];
  let at = 0;
  let awayMs = 0;
  while (at < duration) {
    const nap = (at === 0 ? 1300 : randInt(rng, 950, 1650)) - level * 70;
    spans.push({ from: at, to: at + nap, watch: false });
    awayMs += Math.min(duration, at + nap) - at;
    at += nap;
    const look = randInt(rng, 650, 1000) + level * 40;
    spans.push({ from: at, to: at + look, watch: true });
    at += look;
  }
  // A beat is lost at every colour change, so the par rate sits a little under pure mashing.
  const par = Math.round((awayMs / 1000) * (5.4 + level * 0.3));
  const pitch = dealer(rng, PITCHES);
  const subName = dealer(rng, SUBS);
  let prev = -1;
  const pitches = Array.from({ length: 40 }, () => {
    let btn = randBtn(rng);
    while (btn === prev) btn = randBtn(rng);
    prev = btn;
    return { text: pitch(), sub: subName(), btn };
  });
  let card_ = 0; // which pitch is on screen
  let onCard = 0; // plugs of it so far
  let lastBtn: Btn | -1 = -1;
  let graceEnd = 0;

  let posts = 0;
  let lockedUntil = 0;
  let state: keyof typeof MOOD | '' = '';

  // The scene: the mod dozing at the mod desk up top, you and your megaphone below,
  // and your spam piling up in the feed between you.
  const wrap = h('div', 'g-selfpromo scene-office');
  const desk = h('div', 'desk');
  // All three moods are stacked and only one shows, so a swap never waits on an image.
  const bear = actor('modbear', { mood: 'sleep', px: 0.47 });
  const mod = bear.el;
  const sign = sprite('zed', { px: 0.3 }, 'sign');
  desk.append(mod, sign, h('span', 'plate', 'MOD DESK'));
  const pile = h('div', 'pile');
  const you = h('div', 'you');
  const horn = sprite('megaphone', { px: 0.32 }, 'horn');
  const card = postCard({ sub: '', user: 'totally_not_an_ad', title: '', tone: 'blue' });
  const dots = h('span', 'which');
  you.append(horn, card.el, dots);
  const note = h('div', 'count');
  wrap.append(desk, pile, you, note);
  root.append(wrap);

  const spanAt = (t: number) => spans.find((s) => t >= s.from && t < s.to) ?? spans[spans.length - 1];
  const stateAt = (t: number) => {
    const s = spanAt(t);
    return s.watch ? 'watch' : s.to - t <= warn ? 'warn' : 'nap';
  };

  const cur = () => pitches[card_ % pitches.length];
  let shownCard = -1;
  function show() {
    const p = cur();
    if (shownCard !== card_) {
      shownCard = card_;
      card.set({ sub: p.sub, title: p.text, comments: 0 });
      card.tone(COLOR[p.btn]);
      dots.replaceChildren(padDots(p.btn));
      you.className = `you c-${COLOR[p.btn]}`;
      if (card_) pulse(card.el, 'pop-in');
    }
    card.votes(Math.max(1, posts));
    // One little window in the feed for every plug that is still up.
    while (pile.childElementCount < Math.min(posts, 48)) pile.append(sprite('window', { px: 0.09 }, 'plug'));
    while (pile.childElementCount > posts) pile.lastElementChild!.remove();
    note.textContent = `${posts} plug${posts === 1 ? '' : 's'} still up`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      if (stateAt(t) === 'watch') {
        posts = Math.max(0, posts - 4);
        lockedUntil = t + 500;
        pulse(card.el, 'shake');
        fx.poof(pile);
        bad(you, 'REMOVED: RULE 4');
        fx.flash('red');
        show();
        return;
      }
      // Posting anything at all while the mod looks is caught above; the colour only matters while they nap.
      if (b !== cur().btn) {
        // Nobody stops mashing the instant the card changes.
        if (b === lastBtn && t < graceEnd) return;
        posts = Math.max(0, posts - 1);
        pulse(card.el, 'shake');
        bad(card.el, 'WRONG SUB');
        show();
        return;
      }
      posts++;
      if (++onCard >= PER_CARD) {
        onCard = 0;
        card_++;
        lastBtn = b;
        graceEnd = t + GRACE;
      }
      pulse(horn, 'bump');
      show();
      fx.poof(pile.lastElementChild);
      good(horn);
      if (posts % 10 === 0) {
        fx.pop(you, `${posts} PLUGS!`, 'gold');
        fx.sound('coin');
      }
    },
    tick(t) {
      const now = stateAt(t);
      if (now === state) return;
      state = now;
      bear.mood(MOOD[now]);
      setSprite(sign, SIGN[now], { px: 0.3 });
      wrap.classList.toggle('alarm', now === 'watch');
      wrap.classList.toggle('stir', now === 'warn');
      if (now === 'watch') {
        pulse(mod, 'bump');
        fx.sound('zap');
      }
      if (now === 'nap') fx.sound('whoosh');
    },
    score: () => ratio(posts, par),
    hint: (t) => (t >= lockedUntil && !spanAt(t).watch ? cur().btn : null),
  };
};
