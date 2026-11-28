import './anypercent.css';
import { actor, dealer, defineSprite, h, pulse, randInt, ratio, setSprite, sprite, type GameFactory } from './common';

const HYPE = ['clip that!', 'gold split', 'PB pace??', 'new strat', 'so clean', 'first try', 'is this TAS?', 'frame 1 hop', 'no reset!', 'cracked'];
const SALT = ['run dead?', 'reset', 'F', 'choke', 'RIP splits', 'unlucky', 'back to menu', 'timer says no'];
const GG = ['GG', 'GG WR', 'GGs', 'GG!!'];

const VIEW = 9; // tiles across the scene
const ME = 2; // the tile the runner stands on, counted from the left edge: far enough in for the hop's flip to stay on stage
const REACH = 3; // a hop clears a spike up to this many strides ahead
const TRACK = 260; // tiles: more than anyone can cover
const HEAD = 0.24; // the runner's head is 16 of these wide, in em
const FINE = (16 * HEAD) / 42; // one pixel of the head's art, in em: everything else in the scene is drawn to match
// Clouds as [left %, top %] across a sky two scenes wide: the same three twice, so it loops without a seam.
const CLOUDS = [[4, 30], [24, 44], [39, 33], [54, 30], [74, 44], [89, 33]];

type Grid = string[][];
const blank = (w: number, hgt: number): Grid => Array.from({ length: hgt }, () => Array<string>(w).fill('.'));
const rect = (g: Grid, x: number, y: number, w: number, hgt: number, ch: string) => {
  for (let j = y; j < y + hgt; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = ch;
};
/** Rings every shape in the grid with a black line, and hands back the rows. */
function inked(g: Grid): string[] {
  const out = g.map((r) => [...r]);
  g.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== '.') return;
      const near = [g[y - 1]?.[x], g[y + 1]?.[x], row[x - 1], row[x + 1]];
      if (near.some((n) => n && n !== '.')) out[y][x] = 'k';
    }),
  );
  return out.map((r) => r.join(''));
}

// The runner's body under the cat's head: a tee, two legs and two big shoes. The red shoe is the red
// button and the blue shoe the blue one; each is placed by its heel, toes pointing the way it runs.
type At = [x: number, y: number];
function body(name: string, red: At, blue: At, front: 'red' | 'blue', arm: number) {
  const g = blank(40, 22);
  const limb = (to: At, c: string, C: string) => {
    // The leg, from the hip down to the shoe's heel, then a big sneaker: collar, upper, toe, sole.
    const n = Math.max(Math.abs(to[0] + 1 - 18), to[1] - 7, 1);
    for (let i = 0; i <= n; i++) rect(g, Math.round(18 + ((to[0] + 1 - 18) * i) / n), Math.round(7 + ((to[1] - 7) * i) / n), 3, 1, 'x');
    rect(g, to[0], to[1], 6, 1, c);
    rect(g, to[0], to[1] + 1, 9, 1, c);
    rect(g, to[0], to[1] + 2, 12, 2, c);
    rect(g, to[0], to[1] + 4, 12, 1, C);
    rect(g, to[0], to[1] + 5, 12, 1, 'w');
    rect(g, to[0] + 10, to[1] + 3, 2, 1, 'W'); // the toe cap
    g[to[1] + 1][to[0] + 6] = 'W';
    g[to[1] + 2][to[0] + 8] = 'W';
  };
  const legs = { red: () => limb(red, 'r', 'R'), blue: () => limb(blue, 'b', 'B') };
  legs[front === 'red' ? 'blue' : 'red']();
  rect(g, 14, 1, 12, 7, 'w');
  rect(g, 14, 6, 12, 2, 'd');
  rect(g, 18, 2, 4, 3, 'y'); // the number on the shirt
  rect(g, 18 + arm * 7, 3, 3, 4, 'y'); // one paw pumping
  legs[front]();
  defineSprite(name, inked(g));
}
body('anypercent-stand', [6, 15], [21, 15], 'blue', 0);
body('anypercent-red', [26, 12], [1, 15], 'red', -1); // the red shoe has just stepped out in front
body('anypercent-blue', [1, 15], [26, 12], 'blue', 1);
body('anypercent-tuck', [7, 10], [21, 10], 'blue', 0); // knees up, mid-hop

// "Press green now": an up arrow, drawn at the same pixel size as everything else.
{
  const g = blank(23, 23);
  for (let y = 1; y <= 11; y++) rect(g, 11 - (y - 1), y, 2 * (y - 1) + 1, 1, 'A');
  rect(g, 7, 12, 9, 10, 'A');
  for (let y = 2; y <= 11; y++) g[y][11 - (y - 1)] = 'L';
  rect(g, 7, 12, 2, 10, 'L');
  rect(g, 14, 12, 2, 10, 'a');
  for (let y = 3; y <= 11; y++) g[y][11 + (y - 1)] = 'a';
  defineSprite('anypercent-cue', inked(g));
}
defineSprite('anypercent-spike', `
.....k.....
....kLk....
....kLk....
...kLAak...
...kLAak...
..kLAAAak..
..kLAAAak..
.kLAAAAAak.
.kLAAAAAak.
kLAAAAAAAak
kLAAAAAAAak
kkkkkkkkkkk`);

const stamp = (ms: number) => `0:${(ms / 1000).toFixed(2).padStart(5, '0')}`;
/** A speedrun split: seconds behind (+) or ahead of (-) the record. */
const signed = (s: number) => `${s < 0 ? '-' : '+'}${Math.abs(s).toFixed(2)}`;

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // The scene: a sprint under an open sky, a speedrun timer on top, stream chat at the bottom.
  const wrap = h('div', 'g-anypercent scene-sky');
  const hud = h('div', 'hud');
  const clock = h('b', 'clock');
  const split = h('b', 'split');
  const map = h('div', 'map');
  const mapMe = h('i');
  const mapWr = h('b');
  map.append(mapMe, mapWr);
  hud.append(h('span', 'cat', 'Front Page Any%'), clock, split, map);
  const scene = h('div', 'scene');
  scene.style.cssText = `--tile: ${100 / VIEW}cqw; --me: ${ME}`;
  const clouds = h('div', 'clouds');
  for (const [x, y] of CLOUDS) {
    const cloud = sprite('cloud', { px: FINE * 2 });
    cloud.style.left = `${x}%`;
    cloud.style.top = `${y}%`;
    clouds.append(cloud);
  }
  const lines = h('div', 'lines');
  lines.append(h('i'), h('i'), h('i'));
  const strip = h('div', 'strip');
  const floor = h('i', 'floor');
  const goal = h('div', 'goal');
  goal.append(sprite('trophy', { px: 0.16 }));
  strip.append(floor, goal);
  const ghost = h('div', 'ghost');
  ghost.append(h('b', '', 'WR PACE'));
  const shadow = h('i', 'shadow');
  const who = actor('op', { mood: 'idle', px: HEAD });
  const legs = sprite('anypercent-stand', { px: FINE }, 'legs');
  const runner = h('div', 'runner');
  const bob = h('div', 'bob'); // the head and body bounce on every stride, inside whatever the runner is doing
  bob.append(who.el, legs);
  runner.append(bob);
  const cue = sprite('anypercent-cue', { tone: 'green', px: FINE }, 'cue');
  const callout = h('i', 'callout'); // where the runner's mistakes are spelled out, clear of the edge
  scene.append(clouds, lines, h('div', 'banner', 'NEW WORLD RECORD'), strip, ghost, shadow, runner, cue, callout);
  const chat = h('div', 'chat');
  wrap.append(scene, hud, chat);
  root.append(wrap);

  // Spikes crowd closer with level. Each one sits at the end of a green launch pad.
  const minGap = 9 - Math.ceil(level * 0.75);
  const traps: { at: number; el: HTMLElement; spike: HTMLElement }[] = [];
  for (let at = randInt(rng, 6, 8); at < TRACK; at += randInt(rng, minGap, minGap + 3)) {
    const el = h('div', 'trap');
    el.style.left = `calc(var(--tile) * ${at - REACH})`;
    const pad = h('div', 'pad');
    for (let i = 0; i < REACH; i++) pad.append(sprite('up', { tone: 'green', px: 0.08 }));
    const spike = sprite('anypercent-spike', { tone: 'purple', px: 0.16 }, 'spike');
    el.append(pad, spike);
    strip.append(el);
    traps.push({ at, el, spike });
  }
  /** The spike a hop from tile `p` would clear, if one is in reach. */
  const ahead = (p: number) => traps.find((s) => s.at > p && s.at - p <= REACH);

  // The finish line is where a flawless runner (every hop from as far back as it works) gets with the par
  // number of presses. The pace barely rises with level: later rounds are harder because the spikes crowd in,
  // and every hop taken a stride late already costs a press, so a real record run needs about 8 a second.
  const parPresses = Math.round((duration / 1000) * (7.2 + level * 0.05));
  let finish = 0;
  for (let i = 0; i < parPresses; i++) finish = ahead(finish) ? ahead(finish)!.at + 1 : finish + 1;
  goal.style.left = `calc(var(--tile) * ${finish})`;
  // Past the line it is open road: the victory lap is for showing off, not for face-planting on a record run.
  while (traps.length && traps[traps.length - 1].at > finish) traps.pop()!.el.remove();

  const hype = dealer(rng, HYPE);
  const salt = dealer(rng, SALT);
  let pos = 0;
  let foot = -1; // the foot that took the last stride; -1 lets either foot go next
  let lockedUntil = 0;
  let downUntil = 0;
  let wonAt = -1;
  let heat = 0; // recent pace, 0..1: drives the speed lines
  let last = 0;

  function say(text: string) {
    if (wonAt >= 0) return; // the wall of GGs stays up
    if (chat.childElementCount >= 2) chat.firstElementChild!.remove();
    chat.append(h('span', 'line pop-in', text));
  }
  say('go go go');

  /** Seconds behind world-record pace at time `t`; negative means ahead of it. */
  const behind = (t: number) => (t - (Math.min(pos, finish) / finish) * duration) / 1000;

  /** Plays one of the runner's one-shot animations in place of whichever ran last. */
  function act(cls?: string) {
    runner.classList.remove('shake', 'g-anypercent-hop', 'g-anypercent-whiff');
    if (cls) pulse(runner, cls);
  }

  let shownTick = -1;
  let shownWr = '';
  let shownPace = '';
  let cam = 0; // where the camera is: it glides after the runner, so the world scrolls instead of jumping a tile a tap
  let airUntil = 0;
  let shownLegs = 'anypercent-stand';
  /** The world, as the camera sees it. */
  function drawWorld() {
    strip.style.transform = `translateX(calc(var(--tile) * ${(ME - cam).toFixed(3)}))`;
    clouds.style.transform = `translateX(${(-((cam * 2.5) % 100) / 2).toFixed(2)}%)`;
    // The floor is a short piece of track that leapfrogs along two tiles (one stripe pair) at a time.
    floor.style.left = `calc(var(--tile) * ${2 * Math.floor((cam - ME - 6) / 2)})`;
  }
  /** The legs: knees up during a hop, otherwise whichever shoe stepped last out in front. */
  function pose(t: number) {
    const want = t < airUntil ? 'anypercent-tuck' : foot < 0 ? 'anypercent-stand' : foot === 0 ? 'anypercent-red' : 'anypercent-blue';
    if (want !== shownLegs) setSprite(legs, (shownLegs = want), { px: FINE });
  }
  function draw() {
    // Only what is near the screen is shown; a hop slides up to four tiles at once.
    const lo = Math.min(pos, cam) - ME - 5;
    const hi = pos - ME + VIEW + 4;
    for (const s of traps) s.el.style.display = s.at > lo && s.at - REACH < hi ? '' : 'none';
    goal.style.display = finish > lo && finish < hi ? '' : 'none';
    mapMe.style.transform = `scaleX(${Math.min(1, pos / finish).toFixed(3)})`;
    scene.classList.toggle('go', !!ahead(pos));
  }
  drawWorld();
  draw();

  return {
    press(b, t) {
      if (t < lockedUntil || pos >= TRACK - VIEW) return;
      const s = ahead(pos);
      if (b === 1) {
        foot = -1; // either leg may lead off after a hop, even a wasted one
        if (!s && wonAt < 0) {
          // Nothing to clear: a hop on the spot costs a beat.
          lockedUntil = t + 300;
          who.mood('shock');
          act('g-anypercent-whiff');
          bad(callout, 'TOO EARLY');
          return;
        }
        who.mood('happy');
        airUntil = t + 300;
        act('g-anypercent-hop');
        fx.poof(shadow);
        good(runner, s ? undefined : 'GG'); // on the victory lap a hop is a flip for the fans, not a mistake
        fx.sound('boing');
        if (s) {
          pos = s.at + 1;
          heat = Math.min(1, heat + 0.4);
          s.el.classList.add('done');
          fx.pop(s.spike, signed(behind(t)), behind(t) < 0 ? 'gold' : 'white');
          fx.burst(s.spike, 'gold', 10);
          say(hype());
        }
      } else {
        if (b === foot) {
          who.mood('shock');
          act('shake');
          bad(callout, 'OTHER FOOT');
          return;
        }
        foot = b;
        pos++;
        pulse(bob, 'g-anypercent-stride');
        heat = Math.min(1, heat + 0.2);
        if (s && s.at === pos) {
          // Ran straight into it: face-plant on the spike, then carry on from there.
          lockedUntil = downUntil = t + 500;
          foot = -1;
          s.el.classList.add('hit');
          who.mood('dead');
          act();
          fx.poof(s.spike);
          bad(callout, 'RUN DEAD?');
          fx.sound('thud');
          say(salt());
        } else {
          who.mood(wonAt < 0 ? 'idle' : 'happy');
          good(runner, wonAt < 0 ? undefined : 'GG');
        }
      }
      pose(t);
      draw();
      if (wonAt < 0 && pos >= finish) {
        wonAt = t;
        scene.classList.add('won');
        clock.classList.add('wr');
        who.mood('happy');
        chat.replaceChildren(...GG.map((text) => h('span', 'line pop-in', text)));
        fx.flash('gold');
        fx.burst(runner, 'gold', 40);
        fx.pop(runner, 'WR!!', 'gold');
        fx.sound('coin');
      }
    },
    tick(t) {
      const now = wonAt < 0 ? Math.min(t, duration) : wonAt;
      // The clock reads in hundredths but only needs redrawing twenty times a second.
      const tickNo = wonAt < 0 ? Math.floor(now / 50) : -2;
      if (tickNo !== shownTick) {
        shownTick = tickNo;
        clock.textContent = stamp(now);
        split.textContent = signed(behind(now));
        split.classList.toggle('ahead', behind(now) < 0);
      }
      // The flag holds world-record pace: it reaches the finish line on the bell.
      const wr = Math.min(1, t / duration);
      const wrAt = (wr * 100).toFixed(1);
      if (wrAt !== shownWr) mapWr.style.left = `${(shownWr = wrAt)}%`;
      // The camera closes most of the gap to the runner every twentieth of a second, a little slower through a hop.
      if (cam !== pos) {
        cam += (pos - cam) * (1 - Math.exp(-Math.max(0, t - last) / (t < airUntil ? 100 : 50)));
        if (Math.abs(pos - cam) < 0.01) cam = pos;
        drawWorld();
        draw();
      }
      pose(t);
      const gap = wr * finish - cam + ME; // its tile, counted from the left edge of the scene
      ghost.style.display = wonAt < 0 && gap > 0.5 && gap < VIEW - 3.5 ? '' : 'none';
      ghost.style.left = `calc(var(--tile) * ${(gap + 0.5).toFixed(2)})`;
      runner.classList.toggle('down', t < downUntil);
      heat *= Math.exp((last - t) / 400);
      last = t;
      const pace = heat.toFixed(1);
      if (pace !== shownPace) scene.style.setProperty('--pace', (shownPace = pace));
    },
    score: () => ratio(pos, finish),
    hint(t) {
      if (t < lockedUntil || pos >= TRACK - VIEW) return null;
      return ahead(pos) ? 1 : foot === 0 ? 2 : 0;
    },
  };
};
