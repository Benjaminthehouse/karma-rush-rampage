import './dodge.css';
import { actor, clamp1000, defineSprite, h, pulse, randBtn, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A purple downvote bomb: a lit fuse and a white down arrow on the casing.
defineSprite('dodge-bomb', `
........kk..
.......kyok.
......kk.k..
...kkkkkk...
..kppwwppk..
.kpmpwwpppk.
kpmppwwppppk
kpwwwwwwwwpk
kppwwwwwwppk
kPppwwwwpPPk
.kPPpwwpPPk.
..kkPPPPkk..
....kkkk....`);

export const create: GameFactory = ({ root, rng, level, duration, good, bad }) => {
  const FALL = 1250 - level * 90; // ms from the far end of the lane to the player
  const gap = 800 - level * 80;
  const rows: { at: number; up: Btn; downs: Btn[]; els: HTMLElement[]; lanesOf: Btn[]; shown: boolean; done: boolean }[] = [];

  // The scene: open sky. OP Cat skydives down three lanes of air; upvotes and downvote
  // bombs rush up from below, and OP slides between lanes to grab one and miss the other.
  const wrap = h('div', 'g-dodge scene-sky');
  const air = h('div', 'air');
  // Clouds whip upward past the diver, so the fall reads even when nothing is coming.
  for (let i = 0; i < 3; i++) air.append(sprite('cloud', { px: 0.3 }, `puff p${i}`));
  const lanes = [0, 1, 2].map(() => {
    const l = h('div', 'lane');
    wrap.append(l);
    return l;
  });
  const diver = h('div', 'diver');
  const op = actor('op', { px: 0.36 });
  diver.append(h('i', 'arm l'), op.el, h('i', 'arm r'));
  const karma = h('div', 'karma', '0');
  wrap.prepend(air);
  wrap.append(diver, karma);
  root.append(wrap);

  let prevUp = 1;
  for (let at = FALL + 300; at < duration - 150; at += gap) {
    // Never where the player already stands, so standing still catches nothing.
    let up = randBtn(rng);
    while (up === prevUp) up = randBtn(rng);
    prevUp = up;
    const others = shuffled(rng, ([0, 1, 2] as Btn[]).filter((b) => b !== up));
    // Early rounds leave one safe lane; later every lane has something in it.
    const downs = rng() < 0.45 + level * 0.14 ? others : others.slice(0, 1);
    const els: HTMLElement[] = [];
    const lanesOf: Btn[] = [];
    // Each thing rides a full-height carrier, so moving it is a transform in lane heights.
    const add = (lane: Btn, what: 'up' | 'down') => {
      const el = h('div', `carrier ${what}`);
      el.append(what === 'up' ? sprite('up', { tone: 'green', px: 0.27 }) : sprite('dodge-bomb', { px: 0.27 }));
      el.style.visibility = 'hidden';
      lanes[lane].append(el);
      els.push(el);
      lanesOf.push(lane);
    };
    add(up, 'up');
    downs.forEach((d) => add(d, 'down'));
    rows.push({ at, up, downs, els, lanesOf, shown: false, done: false });
  }

  let lane: Btn = 1;
  let got = 0;
  let hits = 0;
  let mood: ActorMood = 'idle';
  let moodUntil = 0;
  const look = (m: ActorMood, t: number, hold: number) => {
    moodUntil = t + hold;
    if (m === mood) return;
    mood = m;
    op.mood(m);
  };
  const place = () => (diver.className = `diver at-${lane}`);
  place();

  return {
    press(b) {
      lane = b;
      place();
    },
    tick(t) {
      for (const row of rows) {
        if (row.done) continue;
        const p = (t - (row.at - FALL)) / FALL;
        if (p < 0) continue;
        if (p >= 1) {
          row.done = true;
          row.els.forEach((el, i) => {
            if (row.lanesOf[i] === lane) el.classList.add('taken');
            else el.style.visibility = 'hidden';
          });
          if (lane === row.up) {
            got++;
            karma.textContent = String(got - hits);
            pulse(diver, 'bump');
            look('happy', t, 300);
            good(diver, '+1');
          } else if (row.downs.includes(lane)) {
            hits++;
            karma.textContent = String(got - hits);
            // A leftover .bump from an earlier catch outranks .shake and would mute it.
            diver.classList.remove('bump');
            pulse(diver, 'shake');
            look('dead', t, 450);
            bad(diver, 'OUCH');
          }
          continue;
        }
        if (!row.shown) {
          row.shown = true;
          row.els.forEach((el) => (el.style.visibility = ''));
        }
        const y = `translateY(${(-p * 82).toFixed(2)}%)`;
        row.els.forEach((el) => (el.style.transform = y));
      }
      if (mood !== 'idle' && t >= moodUntil) look('idle', t, 0);
    },
    // A downvote cancels one upvote. (A flat -150 was worth two arrows at level 4, where every
    // miss is also a hit, so catching 9 of 14 scored zero.)
    score: () => clamp1000((1000 * (got - hits)) / rows.length),
    hint() {
      const next = rows.find((r) => !r.done);
      return next && next.up !== lane ? next.up : null;
    },
  };
};
