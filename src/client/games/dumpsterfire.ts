import './dumpsterfire.css';
import { COLOR, dealer, defineSprite, h, person, pulse, randBtn, randInt, ratio, setSprite, sprite, type Btn, type GameFactory } from './common';

const TAKES = [
  'well, ACTUALLY',
  'source??',
  'who asked',
  'this aged badly',
  'EDIT: wow',
  'not reading that',
  'touch grass',
  'as a mod...',
  'unpopular opinion',
  'wrong sub',
  'big yikes',
  'per my last reply',
  'L take',
  'do better',
];

// One comment thread is one dumpster, in its button's colour.
defineSprite('dumpsterfire-bin', `
.kkkkkkkkkkkk.
kLLLLLLLLLLLLk
kAAAAAAAAAAAAk
kkkkkkkkkkkkkk
.kAAaAAaAAaAk.
.kAAaAAaAAaAk.
.kAAaAAaAAaAk.
.kAAaAAaAAaAk.
.kaaaaaaaaaak.
.kkkkkkkkkkkk.
..kk......kk..`);
// The fire in it. Its second frame is the same flame mirrored.
defineSprite('dumpsterfire-flame', `
....k........
...kok.......
...kook......
..koook...k..
..kooyok.kok.
.kooyyookook.
.koyyyyooook.
kooyyYyyooook
koyyYYYyyoook
koyyYYYYyyook
koyYYWWYYyook
koyYYWWYYyook
kooyYWWYyyook
.koyyYYyyook.
.kooyyyyook..
..kkooookk...`);

const LINE = 50; // a thread at or over this is on fire
const KNOCK = 12; // what one spray takes off
const FLARE = 78; // a hot take lights a calm thread this high: three sprays
const GROW = 4; // a fire nobody hoses keeps growing, % per second: a fourth spray after two seconds
const GRACE = 600; // ms after a fire goes out in which more sprays are only steam
const ABUSE = 300; // ms of civil time a spray on a calm thread costs

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const par = duration * (0.6 - level * 0.0125); // ms of all-three-calm that earn 1000
  const take = dealer(rng, TAKES);
  // The round opens with all three smouldering: one spray each.
  const heat = [0, 1, 2].map(() => 51 + rng() * 4);
  // Then hot takes land in one thread at a time, never the same thread twice running.
  const flares: { at: number; lane: Btn; take: string }[] = [];
  let prev = -1;
  for (let at = 1300 - level * 50; at < duration; at += randInt(rng, 1200, 1450) - level * 70) {
    let lane = randBtn(rng);
    while (lane === prev) lane = randBtn(rng);
    prev = lane;
    flares.push({ at, lane, take: take() });
  }

  // The scene: three dumpsters in an alley, the mod on the fire escape above
  // whichever one was hosed last, and the sign that says how it is going.
  const wrap = h('div', 'g-dumpsterfire scene-night');
  const sign = h('div', 'sign');
  const signText = h('b', '', 'DUMPSTER FIRE!');
  const signL = sprite('flame1', { px: 0.13 });
  const signR = sprite('flame2', { px: 0.13 });
  sign.append(signL, signText, signR);
  // Spare height on a tall phone is sky: the moon over a flame war, a cloud once it is civil.
  const sky = h('div', 'sky');
  const orb = sprite('moon', { px: 0.3 });
  sky.append(orb);
  const row = h('div', 'lanes');
  const mod = person({ tone: 'gold', hat: 'mod', mood: 'shock', px: 0.17 });
  const lanes = ([0, 1, 2] as Btn[]).map((i) => {
    const el = h('div', `lane c-${COLOR[i]}`);
    const perch = h('div', 'perch');
    const pit = h('div', 'pit');
    const flame = h('div', 'flame');
    const fire = sprite('dumpsterfire-flame');
    const tip = h('i', 'tip');
    flame.append(fire, tip);
    const jet = h('i', 'jet');
    const bin = sprite('dumpsterfire-bin', { tone: COLOR[i], px: 0.3 }, 'bin');
    pit.append(flame, jet, bin);
    const note = h('div', 'take');
    const text = h('span', '', take());
    note.append(text);
    el.append(perch, pit, note);
    row.append(el);
    return { el, perch, pit, flame, fire, tip, jet, bin, note, text, outAt: -9999, ablaze: false };
  });
  lanes[1].perch.append(mod.el);
  const hud = h('div', 'hud');
  const bar = h('div', 'bar');
  const fill = h('i');
  bar.append(fill);
  const clock = h('div', 'clock', 'CIVIL FOR ');
  const secs = h('b');
  clock.append(secs);
  hud.append(bar, clock);
  wrap.append(sign, sky, row, hud);
  root.append(wrap);

  let next = 0;
  let last = 0;
  let aim: Btn = 1;
  let calm = false;
  let civilMs = 0;
  let streak = 0;
  let smugUntil = 0;
  let frame = -1;

  const over = (i: number) => heat[i] >= LINE;

  // Drawn with transforms and only when something changed: resizing three
  // flames and a meter every frame made phones stutter.
  const shown = { size: ['', '', ''], over: [false, false, false], fill: '', secs: '' };
  function draw() {
    lanes.forEach((l, i) => {
      // 0 when out; a fire one spray from out is still a third of the way up.
      const size = over(i) ? ((heat[i] - 30) / 70).toFixed(2) : '0';
      if (size !== shown.size[i]) {
        shown.size[i] = size;
        l.flame.style.transform = `scale(${size})`;
      }
      if (over(i) !== shown.over[i]) {
        shown.over[i] = over(i);
        l.el.classList.toggle('over', over(i));
      }
    });
    const fillNow = Math.min(1, civilMs / par).toFixed(3);
    if (fillNow !== shown.fill) {
      shown.fill = fillNow;
      fill.style.transform = `scaleX(${fillNow})`;
    }
    const secsNow = `${(civilMs / 1000).toFixed(1)}s`;
    if (secsNow !== shown.secs) {
      shown.secs = secsNow;
      secs.textContent = secsNow;
    }
  }
  draw();

  return {
    press(b, t) {
      const l = lanes[b];
      aim = b;
      if (mod.el.parentElement !== l.perch) l.perch.append(mod.el);
      pulse(mod.el, 'bump');
      // The water reaches down to the top of the flame as it stands right now.
      l.pit.style.setProperty('--size', over(b) ? ((heat[b] - 30) / 70).toFixed(2) : '0');
      pulse(l.jet, 'on');
      if (over(b)) {
        heat[b] -= KNOCK;
        fx.poof(l.tip);
        pulse(l.flame, 'hit');
        if (over(b)) good(l.tip);
        else {
          heat[b] = 0;
          l.outAt = t;
          l.text.textContent = '[removed]';
          good(l.bin, 'REMOVED');
          fx.sound('whoosh');
        }
      } else if (t - l.outAt < GRACE) {
        // Still hosing the one that just went out: steam, nothing else.
        fx.poof(l.bin);
        fx.sound('tick');
      } else {
        civilMs = Math.max(0, civilMs - ABUSE);
        streak = 0;
        smugUntil = t + 500;
        pulse(l.bin, 'shake');
        bad(l.bin, 'MOD ABUSE!');
        fx.pop(secs, '-0.3s', 'red');
      }
      draw();
    },
    tick(t) {
      const dt = Math.min(60, Math.max(0, t - last));
      last = t;
      while (flares[next] && t >= flares[next].at) {
        const f = flares[next++];
        const l = lanes[f.lane];
        heat[f.lane] = over(f.lane) ? Math.min(100, heat[f.lane] + KNOCK * 2) : FLARE;
        l.text.textContent = f.take;
        pulse(l.note, 'pop-in');
        pulse(l.flame, 'leap');
        fx.pop(l.pit, 'HOT TAKE!', COLOR[f.lane]);
        fx.sound('zap');
        fx.shake();
      }
      lanes.forEach((l, i) => {
        if (over(i)) heat[i] = Math.min(100, heat[i] + (GROW * dt) / 1000);
        const ablaze = heat[i] >= 100;
        if (ablaze && !l.ablaze) bad(l.pit, 'Y’ALL CAN’T BEHAVE');
        l.ablaze = ablaze;
      });
      const now = !over(0) && !over(1) && !over(2);
      if (now !== calm) {
        calm = now;
        streak = 0;
        signText.textContent = calm ? 'ALL CIVIL :)' : 'DUMPSTER FIRE!';
        setSprite(signL, calm ? 'check' : 'flame1', { px: 0.13 });
        setSprite(signR, calm ? 'check' : 'flame2', { px: 0.13 });
        setSprite(orb, calm ? 'cloud' : 'moon', { px: 0.3 });
        wrap.classList.toggle('calm', calm);
        wrap.classList.toggle('scene-sky', calm);
        wrap.classList.toggle('scene-night', !calm);
        if (calm) {
          fx.pop(null, 'UNDER CONTROL!', 'green');
          fx.burst(sign, 'green', 16);
          fx.flash('green');
          fx.sound('ding');
        }
      }
      if (calm) {
        civilMs += dt;
        streak += dt;
        if (streak >= 500) {
          streak -= 500;
          good(secs);
        }
      }
      mod.mood(t < smugUntil ? 'cool' : calm ? 'happy' : 'shock');
      const f = Math.floor(t / 110) % 2;
      if (f !== frame) {
        frame = f;
        lanes.forEach((l) => setSprite(l.fire, 'dumpsterfire-flame', { flip: f === 1 }));
      }
      draw();
    },
    score: () => ratio(civilMs, par),
    hint() {
      // Hose whatever is on fire, finishing the one you are on. Never a calm thread.
      if (over(0) && over(1) && over(2)) return [0, 1, 2];
      if (over(aim)) return aim;
      const top = ([0, 1, 2] as Btn[]).reduce((a, i) => (heat[i] > heat[a] ? i : a));
      return over(top) ? top : null;
    },
  };
};
