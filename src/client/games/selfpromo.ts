import './selfpromo.css';
import { dealer, h, person, postCard, pulse, randInt, ratio, setSprite, sprite, type GameFactory } from './common';

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
const MOOD = { nap: 'sleep', warn: 'wink', watch: 'angry' } as const;
const SIGN = { nap: 'zed', warn: 'quest', watch: 'bang' } as const;

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
  const par = Math.round((awayMs / 1000) * (6.2 + level * 0.3));
  const pitch = dealer(rng, PITCHES);
  const subName = dealer(rng, SUBS);
  const pitches = Array.from({ length: 30 }, () => ({ text: pitch(), sub: subName() }));

  let posts = 0;
  let lockedUntil = 0;
  let state: keyof typeof MOOD | '' = '';

  // The scene: the mod dozing at the mod desk up top, you and your megaphone below,
  // and your spam piling up in the feed between you.
  const wrap = h('div', 'g-selfpromo scene-office');
  const desk = h('div', 'desk');
  const mod = person({ tone: 'brown', kind: 'bear', hat: 'mod', mood: 'sleep', px: 0.5 });
  const sign = sprite('zed', { px: 0.3 }, 'sign');
  desk.append(mod.el, sign, h('span', 'plate', 'MOD DESK'));
  const pile = h('div', 'pile');
  const you = h('div', 'you');
  const horn = sprite('megaphone', { px: 0.32 }, 'horn');
  const card = postCard({ sub: '', user: 'totally_not_an_ad', title: '', tone: 'blue' });
  you.append(horn, card.el);
  const note = h('div', 'count');
  wrap.append(desk, pile, you, note);
  root.append(wrap);

  const spanAt = (t: number) => spans.find((s) => t >= s.from && t < s.to) ?? spans[spans.length - 1];
  const stateAt = (t: number) => {
    const s = spanAt(t);
    return s.watch ? 'watch' : s.to - t <= warn ? 'warn' : 'nap';
  };

  function show() {
    const p = pitches[Math.floor(posts / 3) % pitches.length];
    card.set({ sub: p.sub, title: p.text, comments: 0 });
    card.votes(Math.max(1, posts));
    // One little window in the feed for every plug that is still up.
    while (pile.childElementCount < Math.min(posts, 48)) pile.append(sprite('window', { px: 0.09 }, 'plug'));
    while (pile.childElementCount > posts) pile.lastElementChild!.remove();
    note.textContent = `${posts} plug${posts === 1 ? '' : 's'} still up`;
  }
  show();

  return {
    press(_b, t) {
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
      posts++;
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
      mod.mood(MOOD[now]);
      setSprite(sign, SIGN[now], { px: 0.3 });
      wrap.classList.toggle('alarm', now === 'watch');
      wrap.classList.toggle('stir', now === 'warn');
      if (now === 'watch') {
        pulse(mod.el, 'bump');
        fx.sound('zap');
      }
      if (now === 'nap') fx.sound('whoosh');
    },
    score: () => ratio(posts, par),
    hint: (t) => (t >= lockedUntil && !spanAt(t).watch ? 1 : null),
  };
};
