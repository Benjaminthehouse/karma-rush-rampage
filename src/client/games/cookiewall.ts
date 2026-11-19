import './cookiewall.css';
import { clamp1000, h, pick, pulse, randBtn, shuffled, type GameFactory } from './common';

const REAL = ['Reject all', 'Decline all', 'No thanks', 'Refuse all', 'Reject everything'];
const TRAPS = [
  'Accept all',
  'Accept & continue',
  'Reject none',
  'Yes to cookies',
  'Allow everything',
  'Reject privacy',
  'Reject later',
  'OK, track me',
  'Manage 847 partners',
  'I love cookies',
  'Agree to all',
  'Sounds good',
];
const SITES = ['recipe-blog', 'news-but-loud', 'free-pdf-tool', 'weather-app', 'quiz-results', 'one-weird-trick'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.floor(level * 0.75);
  const walls = Array.from({ length: 24 }, () => {
    const slot = randBtn(rng);
    const traps = shuffled(rng, TRAPS);
    const text = [0, 1, 2].map((i) => (i === slot ? pick(rng, REAL) : traps[i]));
    // Dark pattern: the real option gets the dullest styling more often on later levels.
    const loud = [0, 1, 2].map((i) => (i === slot ? rng() > 0.45 + level * 0.12 : rng() < 0.8));
    return { slot, text, loud, site: pick(rng, SITES) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-cookiewall');
  const banner = h('div', 'banner');
  const site = h('div', 'site');
  const row = h('div', 'row');
  const opts = [0, 1, 2].map(() => {
    const o = h('div', 'opt');
    row.append(o);
    return o;
  });
  banner.append(site, row);
  const note = h('div', 'g-note');
  wrap.append(banner, note);
  root.append(wrap);

  function show() {
    const w = walls[idx % walls.length];
    site.textContent = `${w.site} values your privacy`;
    opts.forEach((o, i) => {
      o.textContent = w.text[i];
      o.className = `opt ${w.loud[i] ? 'loud' : 'quiet'}`;
    });
    pulse(banner, 'pop-in');
    note.textContent = `${right} wall${right === 1 ? '' : 's'} dodged`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const w = walls[idx % walls.length];
      if (b === w.slot) {
        right++;
        // The word floats from the header, never over the options of the next wall.
        good(opts[b]);
        fx.pop(site, 'REJECTED', 'gold');
        fx.burst(opts[b], 'green', 10);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(opts[b]);
        fx.pop(site, 'TRACKED', 'red');
        fx.burst(opts[b], 'red', 8);
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? walls[idx % walls.length].slot : null),
  };
};
