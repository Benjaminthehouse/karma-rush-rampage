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
const FLOOR = 20; // a hosed thread never quite goes out
const KNOCK = 12; // what one spray takes off
const LEAP = 60; // a hot take lifts embers three sprays over the line
const COOL = 16; // under the line a fire dies down by itself, % per second

const FLAME =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<path class="out" d="M50 0C55 18 82 30 88 58 93 82 74 100 50 100 26 100 7 82 12 58 15 44 24 40 28 28 34 38 40 36 50 0Z"/>' +
  '<path class="in" d="M50 40C56 54 70 60 70 76 70 90 62 100 50 100 38 100 30 90 30 76 30 62 44 54 50 40Z"/></svg>';

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const spread = 5 + level * 0.5; // over the line a fire keeps growing, % per second
  const par = duration * (0.7 - level * 0.01);
  const heat = [0, 1, 2].map(() => 52 + rng() * 6);
  // Hot takes land in one thread at a time, never the same thread twice running.
  const flares: { at: number; lane: Btn; take: string }[] = [];
  let prev = -1;
  for (let at = 1500 - level * 80; at < duration; at += randInt(rng, 1350, 1650) - level * 110) {
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
    pit.append(h('span', 'zone', 'FLAME WAR'), flame);
    const take = h('div', 'take', pick(rng, TAKES));
    el.append(pit, take);
    row.append(el);
    return { el, pit, flame, take, ablaze: false };
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'clock', 'CIVIL FOR ');
  const clock = h('b');
  note.append(clock);
  wrap.append(sign, row, meter, note);
  root.append(wrap);

  let next = 0;
  let last = 0;
  let aim: Btn = 1;
  let calm = false;
  let civilMs = 0;
  let streak = 0;

  const over = (i: number) => heat[i] >= LINE;

  function draw() {
    lanes.forEach((l, i) => {
      l.flame.style.height = `${heat[i]}%`;
      l.el.classList.toggle('over', over(i));
    });
    fill.style.width = `${Math.min(100, (civilMs / par) * 100)}%`;
    clock.textContent = `${(civilMs / 1000).toFixed(1)}s`;
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
      const wasOver = over(b);
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
        heat[f.lane] = Math.max(heat[f.lane], Math.min(heat[f.lane] + LEAP, FLOOR + LEAP + KNOCK));
        l.take.textContent = f.take;
        pulse(l.take, 'pop-in');
        fx.pop(l.pit, 'HOT TAKE!', COLOR[f.lane]);
        fx.sound('zap');
        fx.shake();
      }
      lanes.forEach((l, i) => {
        heat[i] = over(i) ? Math.min(100, heat[i] + (spread * dt) / 1000) : Math.max(FLOOR, heat[i] - (COOL * dt) / 1000);
        const ablaze = heat[i] >= 100;
        if (ablaze && !l.ablaze) bad(l.flame, 'Y’ALL CAN’T BEHAVE');
        l.ablaze = ablaze;
      });
      const now = !over(0) && !over(1) && !over(2);
      if (now !== calm) {
        calm = now;
        streak = 0;
        sign.textContent = calm ? 'ALL CIVIL :)' : 'DUMPSTER FIRE!';
        sign.classList.toggle('calm', calm);
        if (calm) {
          fx.pop(row, 'UNDER CONTROL!', 'green');
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
          good(clock);
        }
      }
      draw();
    },
    score: () => ratio(civilMs, par),
    hint() {
      // Put out whatever is over the line, finishing the one you are on; then soak the rest down to embers.
      const worth = (i: number) => heat[i] > FLOOR + 3;
      const top = ([0, 1, 2] as Btn[]).reduce((a, i) => (heat[i] > heat[a] ? i : a));
      if (over(aim)) return aim;
      if (over(top)) return top;
      if (worth(aim)) return aim;
      return worth(top) ? top : null;
    },
  };
};
