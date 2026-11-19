import './sortbynew.css';
import { clamp1000, h, pick, pulse, shuffled, type Btn, type GameFactory } from './common';

const TITLES = ['Is this normal?', 'Look what I found', 'Help me identify this', 'Update: it got worse', 'Finally finished it', 'Rate my setup', 'Quick question', 'This aged well'];

/** Minutes → the label a post would show. */
function age(mins: number): string {
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + Math.floor(level * 0.75);
  const rounds = Array.from({ length: 24 }, () => {
    // Early rounds mix units widely; later rounds put the three ages close together.
    const pools = [
      [3, 240, 4320],
      [12, 45, 300],
      [50, 60, 180],
      [55, 120, 1440],
      [120, 180, 2880],
    ];
    const base = pools[Math.min(pools.length - 1, Math.floor(rng() * (2 + level)))];
    const mins = shuffled(rng, base.map((m) => Math.max(0, Math.round(m * (0.8 + rng() * 0.4)))));
    // Labels must differ, or the round would be a coin flip.
    while (new Set(mins.map(age)).size < 3) mins[Math.floor(rng() * 3)] += 61;
    return { mins, win: mins.indexOf(Math.min(...mins)) as Btn, titles: mins.map(() => pick(rng, TITLES)) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-sortbynew');
  const row = h('div', 'row');
  const posts = [0, 1, 2].map(() => {
    const post = h('div', 'post');
    const when = h('b');
    const title = h('span');
    post.append(when, title);
    row.append(post);
    return { post, when, title };
  });
  const note = h('div', 'g-note');
  wrap.append(row, note);
  root.append(wrap);

  function show() {
    const r = rounds[idx % rounds.length];
    posts.forEach((p, i) => {
      p.when.textContent = age(r.mins[i]);
      p.title.textContent = r.titles[i];
    });
    pulse(row, 'pop-in');
    note.textContent = `${right} fresh posts found`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const r = rounds[idx % rounds.length];
      if (b === r.win) {
        right++;
        good(posts[b].post, 'NEWEST');
        fx.burst(posts[b].post, 'gold', 10);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(posts[b].post, 'OLD NEWS');
      }
      idx++;
      show();
    },
    tick() {},
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].win : null),
  };
};
