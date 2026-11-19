import './dumpsterfire.css';
import { COLOR, h, pick, pulse, randBtn, randInt, ratio, type Btn, type GameFactory } from './common';

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

const LINE = 50; // a thread is under control below this
const FLOOR = 6; // a hosed thread never quite goes out
const KNOCK = 11; // what one spray takes off

const FLAME =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<path class="out" d="M50 0C55 18 82 30 88 58 93 82 74 100 50 100 26 100 7 82 12 58 15 44 24 40 28 28 34 38 40 36 50 0Z"/>' +
  '<path class="in" d="M50 40C56 54 70 60 70 76 70 90 62 100 50 100 38 100 30 90 30 76 30 62 44 54 50 40Z"/></svg>';

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const jump = 62 + level * 2; // how far a hot take makes a flame leap: always over the line
  const par = (duration - 1000) * (0.84 - level * 0.03);
  const heat = [0, 1, 2].map(() => 58 + rng() * 12);
  const creep = [0, 1, 2].map(() => 4 + level + rng() * 4); // slow growth, % per second
  // A hot take lands in one thread at a time, never the same thread twice running.
  const flares: { at: number; lane: Btn; take: string }[] = [];
  let prev = -1;
  for (let at = 1500 - level * 100; at < duration; at += randInt(rng, 1300, 1700) - level * 90) {
    let lane = randBtn(rng);
    while (lane === prev) lane = randBtn(rng);
    prev = lane;
    flares.push({ at, lane, take: pick(rng, TAKES) });
  }

  const wrap = h('div', 'g-dumpsterfire');
  const sign = h('div', 'sign', 'DUMPSTER FIRE!');
  const row = h('div', 'lanes');
  const lanes = [0, 1, 2].map((i) => {
    const el = h('div', `lane c-${COLOR[i]}`);
    const pit = h('div', 'pit');
    const flame = h('div', 'flame');
    flame.innerHTML = FLAME;
    pit.append(flame);
    const take = h('div', 'take', pick(rng, TAKES));
    el.append(pit, take);
    row.append(el);
    return { el, pit, flame, take };
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(sign, row, meter, note);
  root.append(wrap);

  const over = [true, true, true];
  let next = 0;
  let last = 0;
  let aim: Btn = 1;
  let calm = false;
  let civilMs = 0;
  let streak = 0;

  function draw() {
    lanes.forEach((l, i) => {
      l.flame.style.height = `${heat[i]}%`;
      l.flame.style.width = `${50 + heat[i] * 0.45}%`;
      l.el.classList.toggle('over', heat[i] >= LINE);
    });
    fill.style.width = `${Math.min(100, (civilMs / par) * 100)}%`;
    note.textContent = `Civil for ${(civilMs / 1000).toFixed(1)}s`;
  }
  draw();

  return {
    press(b) {
      const l = lanes[b];
      aim = b;
      pulse(l.flame, 'hit');
      if (heat[b] <= FLOOR) {
        fx.sound('tick');
        return;
      }
      const wasOver = heat[b] >= LINE;
      heat[b] = Math.max(FLOOR, heat[b] - KNOCK);
      fx.burst(l.flame, 'white', 3);
      if (wasOver) good(l.flame);
      else fx.sound('pop');
      draw();
    },
    tick(t) {
      const dt = Math.min(60, Math.max(0, t - last));
      last = t;
      while (flares[next] && t >= flares[next].at) {
        const f = flares[next++];
        const l = lanes[f.lane];
        heat[f.lane] = Math.min(100, heat[f.lane] + jump);
        over[f.lane] = true;
        l.take.textContent = f.take;
        pulse(l.take, 'pop-in');
        fx.pop(l.pit, 'HOT TAKE!', COLOR[f.lane]);
        fx.sound('zap');
        fx.shake();
      }
      heat.forEach((v, i) => {
        heat[i] = Math.min(100, v + (creep[i] * dt) / 1000);
        const now = heat[i] >= LINE;
        if (now && !over[i]) bad(lanes[i].flame, 'IT SPREAD!');
        over[i] = now;
      });
      const now = !over.includes(true);
      if (now !== calm) {
        calm = now;
        streak = 0;
        sign.textContent = calm ? 'ALL CIVIL :)' : 'DUMPSTER FIRE!';
        sign.classList.toggle('calm', calm);
        if (calm) {
          pulse(sign, 'bump');
          fx.pop(sign, 'ALL CIVIL!', 'green');
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
          good(note);
          fx.sound('coin');
        }
      }
      draw();
    },
    score: () => ratio(civilMs, par),
    hint() {
      // Finish the fire you are on, then go for the tallest; never waste a spray on embers.
      const worth = (i: number) => heat[i] >= FLOOR + KNOCK;
      const top = ([0, 1, 2] as Btn[]).reduce((a, i) => (heat[i] > heat[a] ? i : a));
      if (over[aim]) return aim;
      if (over[top]) return top;
      if (worth(aim)) return aim;
      return worth(top) ? top : null;
    },
  };
};
