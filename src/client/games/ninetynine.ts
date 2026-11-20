import './ninetynine.css';
import { actor, COLOR, clamp1000, defineSprite, h, pick, pulse, shuffled, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A bead of sweat that rolls down the Dev's face while a bar closes in on 100.
defineSprite('ninetynine-sweat', `
...kk...
..kcck..
.kcwcck.
kcwcccck
kccccbck
kcccccbk
.kcbbbk.
..kkkk..`);

const STEPS = ['INSTALL', 'BUILD', 'DEPLOY'];
const THINGS = ['left-pad', 'node_modules', 'the vibes', 'prod', 'a fix', 'v2-final', 'dark mode', 'the hotfix', 'everything'];
const OVER = 1.05; // a bar this far past 100 crashes on its own; any stop before that still counts

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + Math.floor(level * 0.75);
  // The gold zone drawn on every track (7% wide in the CSS): stop inside it, or on 100, for full marks.
  // It stays the same size at every level so the picture never lies; faster bars make later rounds harder.
  const near = 0.93;
  const sets = Array.from({ length: 14 }, () => {
    // Finish times are spread out so two bars never need stopping in the same instant.
    const gap = () => 330 - level * 18 + rng() * 240;
    const first = 820 - level * 60 + rng() * 300;
    const second = first + gap();
    return shuffled(rng, [first, second, second + gap()]);
  });
  let set = 0;
  let startAt = 250;
  const stopped: (number | null)[] = [null, null, null];
  let points = 0;
  let fails = 0;

  // The scene: the Dev's cave. Three monitors on the wall run an install, a build and a
  // deploy; the Dev sits at the desk below and sweats as each bar closes in on 100.
  const wrap = h('div', 'g-ninetynine scene-devcave');
  const wall = h('div', 'wall');
  const bars = [0, 1, 2].map((i) => {
    const rowEl = h('div', `mon c-${COLOR[i]}`);
    const screen = h('div', 'screen');
    const label = h('span', 'step', STEPS[i]);
    const thing = h('span', 'thing', `${pick(rng, THINGS)}…`);
    const track = h('div', 'track');
    const fill = h('i');
    const goal = h('b');
    track.append(fill, goal);
    const pct = h('span', 'pct', '0%');
    screen.append(label, thing, track, pct);
    rowEl.append(screen, h('div', 'stand'));
    wall.append(rowEl);
    return { rowEl, fill, pct, shown: '' };
  });
  const room = h('div', 'room');
  const seat = h('div', 'seat');
  const dev = actor('dev', { px: 0.5 });
  const drop = sprite('ninetynine-sweat', { px: 0.2 }, 'sweat');
  const drop2 = sprite('ninetynine-sweat', { px: 0.16 }, 'sweat two');
  seat.append(dev.el, drop, drop2, h('div', 'hoodie'));
  const desk = h('div', 'desk');
  const note = h('div', 'note');
  desk.append(sprite('laptop', { px: 0.2 }, 'lap'), note);
  room.append(seat, desk);
  wrap.append(wall, room);
  root.append(wrap);

  // The Dev's face: a reaction to a stop holds for a moment, otherwise it tracks the nearest bar.
  let mood: ActorMood = 'idle';
  let reactUntil = 0;
  let reaction: ActorMood = 'idle';
  let noteShown = '';
  const look = (m: ActorMood) => {
    if (m === mood) return;
    mood = m;
    dev.mood(m);
    seat.classList.toggle('nervous', m === 'shock');
  };
  const react = (m: ActorMood, t: number) => {
    reaction = m;
    reactUntil = t + 380;
    look(m);
    pulse(seat, m === 'happy' ? 'bump' : 'shake');
  };
  let now = 0;
  const setFill = (b: (typeof bars)[number], v: number) => (b.fill.style.transform = `scaleX(${Math.min(1, v)})`);
  const setPct = (b: (typeof bars)[number], text: string) => {
    if (text === b.shown) return;
    b.shown = text;
    b.pct.textContent = text;
  };

  const value = (i: number, t: number) => Math.max(0, (t - startAt) / sets[set % sets.length][i]);

  function settle(i: Btn, v: number) {
    stopped[i] = v;
    const b = bars[i];
    b.rowEl.classList.add('stopped');
    setFill(b, v); // freeze the bar exactly where it was stopped
    if (v >= OVER) {
      fails++;
      b.rowEl.classList.add('crashed');
      setPct(b, 'CRASH');
      react('dead', now);
      bad(b.rowEl, 'WENT OVER');
    } else if (v >= near) {
      points++;
      setPct(b, `${Math.min(100, Math.round(v * 100))}%`);
      react('happy', now);
      good(b.rowEl, v >= 0.995 ? 'EXACTLY 100' : 'SHIPPED');
    } else {
      fails += 0.5;
      setPct(b, `${Math.round(v * 100)}%`);
      react('sad', now);
      bad(b.rowEl, 'TOO EARLY');
    }
  }

  let resting = false;
  function finishSet(t: number) {
    if (stopped.includes(null)) return;
    if (stopped.every((v) => v !== null && v >= near && v < OVER)) {
      points++;
      fx.pop(null, 'CLEAN RELEASE!', 'gold');
      fx.burst(null, 'gold', 20);
      fx.sound('coin');
    }
    set++;
    startAt = t + 380;
    resting = true;
  }

  return {
    press(b, t) {
      if (resting || t < startAt || stopped[b] !== null) return;
      now = t;
      settle(b, value(b, t));
      finishSet(t);
    },
    tick(t) {
      now = t;
      const shipped = `${Math.floor(points)} shipped`;
      if (shipped !== noteShown) note.textContent = noteShown = shipped;
      if (resting) {
        if (t < startAt) return;
        // The next set starts: wipe the board.
        resting = false;
        stopped.forEach((_, i) => (stopped[i] = null));
        bars.forEach((b) => (b.rowEl.className = b.rowEl.className.replace(/ stopped| crashed/g, '')));
      }
      let top = 0;
      bars.forEach((b, i) => {
        if (stopped[i] !== null) return;
        const v = t < startAt ? 0 : value(i, t);
        if (v >= OVER) return settle(i as Btn, v);
        top = Math.max(top, v);
        setFill(b, v);
        setPct(b, `${Math.min(99, Math.floor(v * 100))}%`);
      });
      finishSet(t);
      look(t < reactUntil ? reaction : top >= 0.78 ? 'shock' : 'idle');
    },
    score: () => clamp1000((1000 * (points - fails)) / par),
    hint(t) {
      if (resting || t < startAt) return null;
      for (const i of [0, 1, 2] as Btn[]) if (stopped[i] === null && value(i, t) >= 0.965) return i;
      return null;
    },
  };
};
