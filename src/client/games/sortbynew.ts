import './sortbynew.css';
import { actor, clamp1000, defineSprite, h, pulse, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A loaf fresh out of the oven, scored on top.
defineSprite('sortbynew-loaf', `
....kkkkkkkk....
..kkOOOOOOOOkk..
.kOOnOOOnOOOnOk.
kOOnOOOnOOOnOOOk
kOOOOOOOOOOOOOOk
kOOOOOOOOOOOOOnk
knOOOOOOOOOOOnnk
.knnnnnnnnnnnnk.
..kkkkkkkkkkkk..`);
// The baker's tall white hat.
defineSprite('sortbynew-hat', `
..kkk..kkk..
.kwwwkkwwwk.
kwwwwwwwwwdk
kwwwwwwwwwdk
.kwwwwwwwdk.
.kddddddddk.
.kkkkkkkkkk.`);

const TITLES = ['Is this normal?', 'Look what I found', 'Help me identify this', 'Update: it got worse', 'Finally finished it', 'Rate my setup', 'Quick question', 'This aged well'];

/** Minutes → the age a post would show. The card prints "ago" underneath (see the CSS). */
function age(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
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
    // Three different titles: the same post twice in a row looks like a glitch.
    return { mins, win: mins.indexOf(Math.min(...mins)) as Btn, titles: shuffled(rng, TITLES).slice(0, 3) };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  // The scene: a bakery. The baker (OP, in a tall hat) pulls posts out of the oven as
  // loaves, each tagged with how long ago it was baked; you grab the freshest one.
  const wrap = h('div', 'g-sortbynew scene-kitchen');
  const back = h('div', 'back');
  const baker = h('div', 'baker');
  const op = actor('op', { px: 0.42 });
  baker.append(sprite('sortbynew-hat', { px: 0.42 }, 'hat'), op.el);
  const oven = h('div', 'oven');
  const door = h('div', 'door');
  door.append(h('i', 'fire'));
  oven.append(door);
  back.append(baker, oven);
  const counter = h('div', 'counter');
  const row = h('div', 'row');
  const posts = [0, 1, 2].map(() => {
    const post = h('div', 'post');
    const tag = h('div', 'tag');
    const when = h('b');
    tag.append(when);
    const loaf = sprite('sortbynew-loaf', { px: 0.36 }, 'loaf');
    const title = h('span', 'slip');
    post.append(tag, loaf, title);
    row.append(post);
    return { post, when, title, loaf };
  });
  counter.append(row);
  const bag = h('div', 'bag');
  const pile = h('div', 'pile');
  const note = h('span', 'count');
  bag.append(pile, note);
  const sign = h('div', 'sign', 'FRESH POSTS DAILY');
  wrap.append(sign, back, counter, bag);
  root.append(wrap);

  let mood: ActorMood = 'idle';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number) => {
    moodUntil = t + 400;
    if (m === mood) return;
    mood = m;
    op.mood(m);
  };

  function show() {
    const r = rounds[idx % rounds.length];
    posts.forEach((p, i) => {
      p.when.textContent = age(r.mins[i]);
      p.title.textContent = r.titles[i];
    });
    pulse(row, 'g-sortbynew-bake');
    // One little loaf in the bag for every fresh post found.
    while (pile.childElementCount < Math.min(right, 16)) pile.append(sprite('sortbynew-loaf', { px: 0.11 }, 'mini'));
    note.textContent = `${right} fresh post${right === 1 ? '' : 's'} found`;
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const r = rounds[idx % rounds.length];
      if (b === r.win) {
        right++;
        good(posts[b].loaf);
        fx.burst(posts[b].loaf, 'gold', 10);
        look('happy', t);
        pulse(baker, 'bump');
        // The praise floats from the bag: over the loaves it would hide the next age to read.
        fx.pop(note, 'NEWEST', 'gold');
      } else {
        wrong++;
        lockedUntil = t + 450;
        row.classList.add('locked');
        bad(posts[b].loaf, 'OLD NEWS');
        look('shock', t);
      }
      idx++;
      show();
    },
    tick(t) {
      if (t >= lockedUntil) row.classList.remove('locked');
      if (mood !== 'idle' && t >= moodUntil) {
        mood = 'idle';
        op.mood('idle');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? rounds[idx % rounds.length].win : null),
  };
};
