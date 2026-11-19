import './sideeye.css';
import { COLOR, h, pick, pulse, randBtn, randInt, ratio, shuffled, type Btn, type GameFactory } from './common';

// What a watched phone suddenly has on screen.
const DOCS = ['Q3 REPORT', 'BUDGET v7', 'TIMESHEET', 'INBOX (0)', 'KPI DECK', 'SYNERGY', 'ROADMAP', 'FINAL_v2', 'AGENDA', 'ORG CHART'];
const LOLS = ['LOL', 'SAME', 'MOOD', 'SO TRUE', 'SAVED', 'I’M DEAD', 'TOO REAL', 'NICE', 'SENDING THIS', 'HA'];
const KINDS = 6; // meme tile designs in the css

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const blink = 320 - level * 25; // eyes shut while they swing to the next phone: nothing is watched
  const par = Math.round((duration / 1000) * (6.8 + level * 0.4));
  // Two stares in three land where the scrolling was (`follow`); the third on one of the other phones.
  const stares: { shut: number; from: number; to: number; follow: boolean; alt: number; doc: string }[] = [];
  let bag: boolean[] = [];
  for (let at = 0; at < duration; ) {
    if (!bag.length) bag = shuffled(rng, [true, true, false]);
    const from = at + (at ? blink : 500);
    const to = from + randInt(rng, 600, 1050) - level * 50;
    stares.push({ shut: at, from, to, follow: bag.pop()!, alt: randInt(rng, 0, 1), doc: pick(rng, DOCS) });
    at = to;
  }

  const wrap = h('div', 'g-sideeye');
  const boss = h('div', 'boss');
  const face = h('div', 'face');
  for (let i = 0; i < 2; i++) {
    const socket = h('div', 'socket');
    const eye = h('div', 'eye');
    eye.append(h('i', 'pupil'), h('i', 'lid'));
    socket.append(h('i', 'brow'), eye);
    face.append(socket);
  }
  boss.append(face, h('div', 'desk'));
  const row = h('div', 'phones');
  const phones = [0, 1, 2].map((i) => {
    const el = h('div', `phone c-${COLOR[i]}`);
    const feed = h('div', 'feed');
    const tiles = [0, 1, 2].map(() => h('i'));
    feed.append(...tiles);
    const doc = h('div', 'doc');
    const title = h('span');
    doc.append(h('i', 'peek'), title);
    el.append(feed, doc);
    row.append(el);
    return { el, feed, tiles, title, skip: randInt(rng, 0, KINDS - 1), lastAt: -1000 };
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const tally = h('div', 'tally');
  const count = h('b');
  tally.append(count, ' MEMES SCROLLED');
  wrap.append(boss, row, meter, tally);
  root.append(wrap);

  let memes = 0;
  let lockedUntil = 0;
  let on = randBtn(rng); // the phone last scrolled
  let cur = -1; // index of the stare (and the blink before it) in progress
  let watched: Btn = on;
  let shown = '';

  /** Moves on to the stare for time `t`; each one picks its phone the moment the eyes shut. */
  function sync(t: number) {
    while (stares[cur + 1] && t >= stares[cur + 1].shut) {
      const s = stares[++cur];
      watched = s.follow ? on : ([0, 1, 2] as Btn[]).filter((b) => b !== on)[s.alt];
    }
    return stares[cur];
  }

  function feed(p: (typeof phones)[number]) {
    p.tiles.forEach((tile, j) => (tile.className = `meme m${(p.skip + j) % KINDS}`));
  }

  function show() {
    count.textContent = String(memes);
    fill.style.width = `${Math.min(100, (memes / par) * 100)}%`;
    // The more you get away with, the narrower the eyes.
    face.style.setProperty('--sus', String(Math.min(1, memes / par)));
  }
  phones.forEach(feed);
  show();

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const s = sync(t);
      const p = phones[b];
      if (t >= s.from && b === watched) {
        memes = Math.max(0, memes - 5);
        lockedUntil = t + 600;
        pulse(p.el, 'shake');
        bad(p.el, 'CAUGHT IN 4K');
        fx.flash('red');
        fx.sound('thud');
        show();
        return;
      }
      memes++;
      on = b;
      p.lastAt = t;
      p.skip++;
      feed(p);
      pulse(p.feed, 'scroll');
      good(p.el, memes % 10 === 5 ? LOLS[Math.floor(memes / 10) % LOLS.length] : undefined);
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
        face.className = `face look-${watched} ${open ? 'watch' : 'blink'}`;
        phones.forEach((p, i) => {
          p.el.classList.toggle('next', i === watched && !open);
          p.el.classList.toggle('watched', i === watched && open);
        });
        if (open) {
          const p = phones[watched];
          p.title.textContent = s.doc;
          fx.sound('zap');
          // Scrolled it right up to the moment the eyes opened.
          if (s.from - p.lastAt < 130) fx.pop(p.el, 'PHEW', 'white');
        } else fx.sound('tick');
      }
      wrap.classList.toggle('caught', t < lockedUntil);
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
