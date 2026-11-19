import './selfpromo.css';
import { h, pick, pulse, randInt, ratio, type GameFactory } from './common';

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
  const pitches = Array.from({ length: 30 }, () => ({ text: pick(rng, PITCHES), sub: pick(rng, SUBS) }));

  let posts = 0;
  let lockedUntil = 0;
  let state = '';

  const wrap = h('div', 'g-selfpromo');
  const mod = h('div', 'mod');
  const eyes = h('div', 'eyes');
  eyes.append(h('i'), h('i'));
  const badge = h('span', 'badge', 'MOD');
  const mark = h('b', 'mark');
  mod.append(eyes, badge, mark);
  const post = h('div', 'post');
  const sub = h('span', 'sub');
  const title = h('div', 'title');
  const link = h('span', 'link', '↗ my-app.example');
  post.append(sub, title, link);
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(mod, post, meter, note);
  root.append(wrap);

  const spanAt = (t: number) => spans.find((s) => t >= s.from && t < s.to) ?? spans[spans.length - 1];
  const stateAt = (t: number) => {
    const s = spanAt(t);
    return s.watch ? 'watch' : s.to - t <= warn ? 'warn' : 'nap';
  };

  function show() {
    const p = pitches[Math.floor(posts / 3) % pitches.length];
    sub.textContent = p.sub;
    title.textContent = p.text;
    fill.style.width = `${Math.min(100, (posts / par) * 100)}%`;
    note.textContent = `${posts} plug${posts === 1 ? '' : 's'} landed`;
  }
  show();

  return {
    press(_b, t) {
      if (t < lockedUntil) return;
      if (stateAt(t) === 'watch') {
        posts = Math.max(0, posts - 4);
        lockedUntil = t + 500;
        pulse(post, 'shake');
        bad(post, 'REMOVED: RULE 4');
        fx.flash('red');
        show();
        return;
      }
      posts++;
      pulse(link, 'bump');
      good(link);
      if (posts % 10 === 0) {
        fx.pop(post, `${posts} PLUGS!`, 'gold');
        fx.sound('coin');
      }
      show();
    },
    tick(t) {
      const now = stateAt(t);
      if (now === state) return;
      state = now;
      mod.className = `mod ${now}`;
      mark.textContent = now === 'watch' ? '!' : now === 'warn' ? '?' : 'z z z';
      if (now === 'watch') fx.sound('zap');
      if (now === 'nap') fx.sound('whoosh');
    },
    score: () => ratio(posts, par),
    hint: (t) => (t >= lockedUntil && !spanAt(t).watch ? 1 : null),
  };
};
