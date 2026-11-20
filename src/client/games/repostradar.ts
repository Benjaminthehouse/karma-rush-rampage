import './repostradar.css';
import { actor, clamp1000, COLOR, defineSprite, h, pulse, randBtn, setSprite, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A red push pin for the evidence board.
defineSprite('repostradar-pin', `
.kkk.
krrRk
kRRRk
.kkk.
..k..`);

// What people post. Each is one unmistakable picture: a post is a repost when its picture
// is already on the wall. No colours or captions to compare, just the picture.
const PICS = [
  'heart', 'star', 'coin', 'rocket', 'banana', 'cake', 'bell', 'trophy', 'bug', 'cookie', 'skull',
  'bomb', 'gift', 'crown', 'hammer', 'lock', 'cloud', 'flame1', 'megaphone', 'thumb', 'laptop',
];
const WALL_PX = 0.2; // one art pixel on the wall, in em
const NEW_PX = 0.36; // and on the three new posts

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Later rounds have a bigger wall to search and want more catches.
  const wallSize = level >= 3 ? 9 : 6;
  const par = 12 + level;

  // The whole round is dealt up front, so everyone gets the same one however fast they play.
  const start = shuffled(rng, PICS).slice(0, wallSize);
  const wall = [...start];
  const age = shuffled(rng, wall.map((_, i) => i)); // higher is newer
  let clock = wallSize;
  const screens = Array.from({ length: 140 }, () => {
    const twin = Math.floor(rng() * wallSize); // the wall post that gets reposted
    const slot = randBtn(rng);
    const spare = shuffled(rng, PICS.filter((p) => !wall.includes(p)));
    const fresh = [spare[0], spare[1]];
    let f = 0;
    const tiles = [0, 1, 2].map((i) => (i === slot ? wall[twin] : fresh[f++]));
    // The two new posts join the wall in place of its two oldest (never the one just
    // matched, so the match can be shown), which keeps everything else where it was.
    const oldest = wall.map((_, i) => i).filter((i) => i !== twin).sort((a, b) => age[a] - age[b]).slice(0, 2);
    const swaps = oldest.map((pos, i) => ({ pos, pic: fresh[i] }));
    swaps.forEach((s) => {
      wall[s.pos] = s.pic;
      age[s.pos] = clock++;
    });
    return { tiles, slot, twin, swaps };
  });

  let idx = 0;
  let right = 0;
  let wrong = 0;
  let lockedUntil = 0;

  // The scene: the Lurker's evidence board. Up top, everything already posted, pinned to
  // cork. Below, three new posts arrive, one above each button. One of them is already
  // on the wall: that is the repost.
  const wrap = h('div', 'g-repostradar scene-office');
  const head = h('div', 'head');
  const lurker = actor('lurker', { mood: 'peep', px: 0.2 });
  head.append(h('span', 'label', 'ALREADY POSTED'), lurker.el);
  const board = h('div', `wall n${wallSize}`);
  const olds = start.map((pic) => {
    const cell = h('div', 'old');
    const art = sprite(pic, { px: WALL_PX });
    cell.append(sprite('repostradar-pin', { px: 0.14 }, 'pin'), art);
    board.append(cell);
    return { cell, art };
  });
  const ask = h('div', 'ask');
  ask.innerHTML = 'Which <b>new post</b> is on the wall?';
  const row = h('div', 'row');
  const news = ([0, 1, 2] as Btn[]).map((b) => {
    const tile = h('div', `tile c-${COLOR[b]}`);
    const art = sprite(start[0], { px: NEW_PX });
    const photo = h('div', 'photo');
    photo.append(art);
    tile.append(h('span', 'tag', 'NEW'), photo, h('i', 'base'));
    row.append(tile);
    return { tile, art };
  });
  // Verdicts float up from the heading, clear of the wall, the question and the new posts.
  const stamp = h('i', 'stamp');
  head.append(stamp);
  const note = h('div', 'count');
  wrap.append(head, board, ask, row, note);
  root.append(wrap);

  let mood: ActorMood = 'peep';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number) => {
    moodUntil = t + 420;
    if (m === mood) return;
    mood = m;
    lurker.mood(m);
  };

  function show() {
    const s = screens[idx % screens.length];
    news.forEach((n, i) => setSprite(n.art, s.tiles[i], { px: NEW_PX }));
    pulse(row, 'pop-in');
    note.textContent = right === 1 ? '1 repost caught' : `${right} reposts caught`;
  }
  show();

  return {
    press(b: Btn, t) {
      if (t < lockedUntil) {
        fx.sound('tick');
        return;
      }
      const s = screens[idx % screens.length];
      // Right or wrong, the wall post that was copied lights up: that was the repost.
      pulse(olds[s.twin].cell, b === s.slot ? 'caught' : 'missed');
      if (b === s.slot) {
        right++;
        good(stamp, 'REPOST!');
        fx.burst(olds[s.twin].cell, 'gold', 10);
        look('cool', t);
      } else {
        wrong++;
        lockedUntil = t + 450;
        bad(stamp, 'THAT ONE WAS NEW');
        look('shock', t);
      }
      // The two posts that really were new get pinned to the wall.
      for (const swap of s.swaps) {
        setSprite(olds[swap.pos].art, swap.pic, { px: WALL_PX });
        pulse(olds[swap.pos].art, 'pop-in');
      }
      idx++;
      show();
    },
    tick(t) {
      const locked = t < lockedUntil;
      if (locked !== row.classList.contains('locked')) row.classList.toggle('locked', locked);
      if (mood !== 'peep' && t >= moodUntil) {
        mood = 'peep';
        lurker.mood('peep');
      }
    },
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint: (t) => (t >= lockedUntil ? screens[idx % screens.length].slot : null),
  };
};
