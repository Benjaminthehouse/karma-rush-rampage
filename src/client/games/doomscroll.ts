import './doomscroll.css';
import { actor, COLOR, defineSprite, h, pulse, ratio, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// Bloodshot rims and bags, laid over the scroller's open eyes on the same 16x16 grid.
defineSprite('doomscroll-redeyes', `
................
................
................
................
................
................
................
...rk.rr.rk.rr..
...r..r..r..r...
...rrrr..rrrr...
...RRRR..RRRR...
................
................
................
................
................`);
// A pillow, a little wider than the head that sinks into it.
defineSprite('doomscroll-pillow', `
.kkkkkkkkkkkkkkkkkkkk.
kwwwwwwwwwwwwwwwwwwwwk
kwwwwwwwwwwwwwwwwwwwdk
kwwwwwwwwwwwwwwwwwwddk
kdwwwwwwwwwwwwwwwwdddk
.kkkkkkkkkkkkkkkkkkkk.`);

const POSTS = [
  'You won’t believe this',
  'Day 412 of posting this',
  'Thread (1/87)',
  'BREAKING: nothing happened',
  'Hot take incoming',
  'This you?',
  'Update: still scrolling',
  'It’s 3am, one more',
  'Ratio + you fell off',
  'Wait, read this',
];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The par climbs gently: later rounds flip far more often, and every flip costs a person a beat.
  const par = Math.round((duration / 1000) * (6.8 + level * 0.25));
  // The roll direction flips after each run of posts; later rounds flip more often.
  const runs: number[] = [];
  for (let i = 0; i < 40; i++) runs.push(Math.max(4, 12 - level * 2 + Math.floor(rng() * 5)));
  const posts = shuffled(rng, POSTS); // dealt in order, so the feed never shows a post twice at once
  const texts = posts.slice(0, 6);
  let dealt = texts.length;
  let run = 0;
  let leftInRun = runs[0];
  let dir = 1; // 1 = red → green → blue, -1 = blue → green → red
  let expect: Btn = 0;
  let rolled = 0;
  let lockedUntil = 0;
  // Nobody reverses a drum roll on the very next beat: right after a flip, the pad
  // the old direction wanted is ignored instead of buzzed.
  let slipBtn = -1;
  let slipUntil = 0;

  // The scene: a bedroom at 3am. Someone lies in bed, face lit by the phone held over them;
  // the clock ticks on, the feed scrolls, and their eyes get redder with every post.
  const wrap = h('div', 'g-doomscroll scene-night');
  const top = h('div', 'top');
  const clock = h('div', 'clock', '3:00');
  const order = h('div', 'order');
  const chips = [0, 1, 2].map((i) => h('i', `c-${COLOR[i]}`));
  const way = h('b', 'way');
  order.append(chips[0], chips[1], chips[2], way);
  top.append(order);
  const room = h('div', 'room');
  const phone = h('div', 'phone');
  const status = h('div', 'status');
  const feed = h('div', 'feed');
  const list = h('div', 'list');
  feed.append(list);
  const cards = texts.map(() => {
    const c = h('div', 'card');
    list.append(c);
    return c;
  });
  phone.append(status, feed);
  const bed = h('div', 'bed');
  const sleeper = h('div', 'sleeper');
  const who = actor('npc', { px: 0.42 });
  const red = sprite('doomscroll-redeyes', { px: 0.42 }, 'red');
  sleeper.append(sprite('doomscroll-pillow', { px: 0.42 }, 'pillow'), who.el, red);
  const stand = h('div', 'stand');
  stand.append(clock);
  bed.append(h('div', 'glow'), sleeper, h('div', 'blanket'), stand);
  room.append(phone, bed);
  wrap.append(top, room);
  root.append(wrap);

  let mood: ActorMood = 'idle';
  let moodUntil = 0;
  let clockShown = '';
  let redShown = -1;
  const look = (m: ActorMood, t: number, hold: number) => {
    moodUntil = t + hold;
    if (m === mood) return;
    mood = m;
    who.mood(m);
    red.classList.toggle('off', m !== 'idle');
  };

  function show() {
    order.classList.toggle('back', dir < 0);
    way.textContent = dir > 0 ? '→' : '←';
    chips.forEach((c, i) => c.classList.toggle('next', i === expect));
    // The post whose scroll flips the direction is gold, so the flip is seen climbing the feed.
    cards.forEach((c, i) => {
      const flip = i === leftInRun - 1;
      c.className = flip ? 'card flip' : 'card';
      c.textContent = flip ? 'FLIP HERE' : texts[i];
    });
    status.textContent = `${rolled} posts scrolled`;
    // The eyes go red in four steps on the way to the par.
    const r = Math.min(3, Math.floor((4 * rolled) / par));
    if (r !== redShown) {
      redShown = r;
      red.dataset.r = String(r);
    }
  }
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      if (b !== expect) {
        if (b === slipBtn && t < slipUntil) return;
        lockedUntil = t + 300;
        pulse(phone, 'shake');
        look('shock', t, 350);
        bad(chips[expect], 'THUMB SLIPPED');
        return;
      }
      rolled++;
      good(chips[b]);
      // Recycle the top card to the bottom, with the next post, so the feed never ends.
      const top = cards.shift()!;
      list.append(top);
      cards.push(top);
      texts.shift();
      texts.push(posts[dealt++ % posts.length]);
      pulse(list, 'g-doomscroll-roll');
      if (--leftInRun <= 0) {
        run++;
        leftInRun = runs[run % runs.length];
        slipBtn = (b + dir + 3) % 3;
        slipUntil = t + 300;
        dir = -dir;
        fx.pop(order, dir > 0 ? 'ROLL RIGHT!' : 'ROLL LEFT!', 'gold');
        fx.sound('whoosh');
        look('shock', t, 250);
        expect = b; // the flip restarts from the pad you are already on
      }
      expect = (((expect + dir) % 3) + 3) % 3 as Btn;
      show();
    },
    tick(t) {
      // The clock runs fast: a minute every 150 ms.
      const m = Math.floor(t / 150);
      const text = `${3 + Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
      if (text !== clockShown) clock.textContent = clockShown = text;
      if (mood !== 'idle' && t >= moodUntil) look('idle', t, 0);
    },
    score: () => ratio(rolled, par),
    hint: (t) => (t >= lockedUntil ? expect : null),
  };
};
