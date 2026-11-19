import './sideeye.css';
import { COLOR, dealer, h, pulse, randBtn, randInt, ratio, setSprite, shuffled, sprite, type Btn, type GameFactory } from './common';

// What a watched phone suddenly has on screen.
const DOCS = ['Q3 REPORT', 'BUDGET v7', 'TIMESHEET', 'INBOX (0)', 'KPI DECK', 'SYNERGY', 'ROADMAP', 'FINAL_v2', 'AGENDA', 'ORG CHART'];
const LOLS = ['LOL', 'SAME', 'MOOD', 'SO TRUE', 'SAVED', 'I’M DEAD', 'TOO REAL', 'NICE', 'OOF', 'HA'];
// What an unwatched one has: sheet sprites on loud backgrounds.
const MEMES = ['banana', 'cake', 'rocket', 'trophy', 'cookie', 'bug', 'moon', 'gift', 'heart', 'star', 'crown', 'thumb'];
const TINTS = 5; // tile colours in the css
const FINE = 3; // memes lost when caught
const LOCK = 500; // ms frozen when caught
const EARLY = 350; // ms at the very start in which the first stare does not bite yet

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const tell = 600 - level * 40; // eyes shut while they swing to the next phone, which flashes: nothing is watched
  const par = Math.round((duration / 1000) * (6.3 + level * 0.2));
  const doc = dealer(rng, DOCS);
  // The round opens mid-stare. Two stares in three land where the scrolling was (`follow`); the third on one of the other phones.
  const stares: { shut: number; from: number; to: number; follow: boolean; alt: number; doc: string }[] = [];
  let bag: boolean[] = [];
  for (let at = 0; at < duration; ) {
    if (!bag.length) bag = shuffled(rng, [true, true, false]);
    const from = at ? at + tell : 0;
    const to = from + (at ? randInt(rng, 650, 1050) : 1350) - level * 50;
    stares.push({ shut: at, from, to, follow: bag.pop()!, alt: randInt(rng, 0, 1), doc: doc() });
    at = to;
  }

  // The scene: the boss peeking over the desk up top, three phones in the dark under it.
  const wrap = h('div', 'g-sideeye scene-office');
  const boss = h('div', 'boss');
  const head = h('div', 'head');
  head.append(h('i', 'hair'));
  for (let i = 0; i < 2; i++) {
    const socket = h('div', 'socket');
    const eye = h('div', 'eye');
    eye.append(h('i', 'pupil'), h('i', 'lid'));
    socket.append(h('i', 'brow'), eye);
    head.append(socket);
  }
  head.append(h('i', 'nose'));
  const desk = h('div', 'desk');
  desk.append(h('span', 'plate', 'THE BOSS'));
  boss.append(head, desk);
  const under = h('div', 'under');
  const row = h('div', 'phones');
  const phones = [0, 1, 2].map((i) => {
    const el = h('div', `phone c-${COLOR[i]}`);
    const feed = h('div', 'feed');
    const tiles = [0, 1, 2].map(() => {
      const tile = h('div', 'meme');
      const pic = sprite(MEMES[0], { px: 0.17 });
      tile.append(pic);
      feed.append(tile);
      return { tile, pic };
    });
    const sheet = h('div', 'doc');
    const title = h('span');
    sheet.append(sprite('eye', { px: 0.2 }), title);
    const warn = h('div', 'warn');
    warn.append(sprite('eye', { px: 0.2 }), sprite('bang', { px: 0.3 }));
    el.append(feed, sheet, warn);
    row.append(el);
    return { el, feed, tiles, title, warn, skip: randInt(rng, 0, MEMES.length - 1), lastAt: -1000 };
  });
  const hud = h('div', 'hud');
  const bar = h('div', 'bar');
  const fill = h('i');
  bar.append(fill);
  const tally = h('div', 'tally');
  const count = h('b');
  tally.append(count, ' MEMES');
  hud.append(bar, tally);
  under.append(row, hud);
  wrap.append(boss, under);
  root.append(wrap);

  let memes = 0;
  let lockedUntil = 0;
  let lastGood = -1000;
  let on = randBtn(rng); // the phone last scrolled
  let cur = -1; // index of the stare (and the eyes-shut spell before it) in progress
  let watched: Btn = on;
  let shown = '';
  let caught = false;
  let dodging = false; // the eyes are shut and heading for a phone in use

  /** Moves on to the stare for time `t`; each one picks its phone the moment the eyes shut. */
  function sync(t: number) {
    while (stares[cur + 1] && t >= stares[cur + 1].shut) {
      const s = stares[++cur];
      watched = s.follow ? on : ([0, 1, 2] as Btn[]).filter((b) => b !== on)[s.alt];
    }
    return stares[cur];
  }
  sync(0);

  function paint(p: (typeof phones)[number]) {
    p.tiles.forEach(({ tile, pic }, j) => {
      const k = p.skip + j;
      tile.className = `meme m${k % TINTS}`;
      setSprite(pic, MEMES[k % MEMES.length], { px: 0.17 });
    });
  }

  function show() {
    count.textContent = String(memes);
    fill.style.width = `${Math.min(100, (memes / par) * 100)}%`;
    // The more you get away with, the narrower the eyes.
    head.style.setProperty('--sus', String(Math.min(1, memes / par)));
  }
  phones.forEach(paint);
  show();

  return {
    press(b, t) {
      const p = phones[b];
      if (t < lockedUntil) {
        pulse(p.el, 'shake');
        return;
      }
      const s = sync(t);
      if (b === watched) {
        // Flagged while the eyes are shut: the screen is covered, there is nothing to scroll.
        if (t < s.from) {
          pulse(p.warn, 'bump');
          fx.sound('tick');
          return;
        }
        pulse(p.el, 'shake');
        // Nobody is fined for mashing before they have had time to look.
        if (!cur && t < EARLY) return;
        memes = Math.max(0, memes - FINE);
        lockedUntil = t + LOCK;
        bad(row, 'CAUGHT IN 4K');
        fx.pop(count, `-${FINE}`, 'red');
        fx.flash('red');
        fx.sound('thud');
        show();
        return;
      }
      memes++;
      on = b;
      p.lastAt = t;
      p.skip++;
      paint(p);
      pulse(p.feed, 'scroll');
      // Two thumbs can scroll faster than the combo should climb.
      if (t - lastGood >= 100) {
        lastGood = t;
        good(p.el, memes % 10 === 5 ? LOLS[Math.floor(memes / 10) % LOLS.length] : undefined);
      } else fx.sound('pop');
      if (memes % 10 === 0) {
        fx.pop(count, `${memes} MEMES!`, 'gold');
        fx.burst(count, 'gold', 14);
        fx.sound('coin');
      }
      show();
    },
    tick(t) {
      const s = sync(t);
      const open = t >= s.from;
      const key = `${cur}${open}`;
      if (key !== shown) {
        shown = key;
        head.className = `head look-${watched} ${open ? 'watch' : 'blink'}`;
        const p = phones[watched];
        phones.forEach((q) => {
          q.el.classList.toggle('next', q === p && !open);
          q.el.classList.toggle('watched', q === p && open);
        });
        if (open) {
          p.title.textContent = s.doc;
          fx.sound('zap');
          // Got off the phone the eyes were coming for.
          if (dodging && on !== watched) fx.pop(p.el, 'PHEW', 'white');
        } else {
          fx.sound('tick');
          // The eyes are coming for a phone that was being scrolled a moment ago.
          dodging = t - p.lastAt < 500;
          if (dodging) fx.pop(p.el, 'MOVE!', 'red');
        }
      }
      const now = t < lockedUntil;
      if (now !== caught) {
        caught = now;
        wrap.classList.toggle('caught', caught);
        wrap.classList.toggle('scene-danger', caught);
        wrap.classList.toggle('scene-office', !caught);
      }
    },
    score: () => ratio(memes, par),
    hint(t) {
      if (t < lockedUntil) return null;
      // Stay on your phone until the eyes head for it; they open on the phone that flashes while they are shut.
      sync(t);
      return on !== watched ? on : (((watched + 1) % 3) as Btn);
    },
  };
};
