import './anypercent.css';
import { dealer, defineSprite, h, person, pulse, randInt, ratio, setSprite, sprite, type GameFactory } from './common';

const HYPE = ['clip that!', 'gold split', 'PB pace??', 'new strat', 'so clean', 'first try', 'is this TAS?', 'frame 1 hop', 'no reset!', 'cracked'];
const SALT = ['run dead?', 'reset', 'F', 'choke', 'RIP splits', 'unlucky', 'back to menu', 'timer says no'];
const GG = ['GG', 'GG WR', 'GGs', 'GG!!'];

const VIEW = 9; // tiles across the scene
const ME = 1; // the tile the runner stands on, counted from the left edge
const REACH = 3; // a hop clears a spike up to this many strides ahead
const TRACK = 260; // tiles: more than anyone can cover
const PX = 0.2; // one runner pixel, in em
// Clouds as [left %, top %, pixel size] across a sky two scenes wide: the same three twice, so it loops without a seam.
const CLOUDS = [[4, 30, 0.3], [24, 44, 0.22], [39, 33, 0.26], [54, 30, 0.3], [74, 44, 0.22], [89, 33, 0.26]];

// The runner's body under its robot head. The left leg is the red button, the right leg the blue one.
const BODY = `
....kkkkkkkk....
...kwwwwwwwwk...
...kwwwwwwyyk...
...kddddddddk...
....kkkkkkkk....`;
defineSprite('anypercent-stand', `${BODY}
...krrk..kbbk...
...krrk..kbbk...
...kRRRk.kBBBk..
...kkkkk.kkkkk..`);
// Mid-stride: the leg that just stepped (red for step0, blue for step2) is out in front.
defineSprite('anypercent-step0', `${BODY}
..kbbk....krrk..
.kbbk......krrk.
kBBBk.....kRRRk.
kkkkk.....kkkkk.`);
defineSprite('anypercent-step2', `${BODY}
..krrk....kbbk..
.krrk......kbbk.
kRRRk.....kBBBk.
kkkkk.....kkkkk.`);
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
  for (const [x, y, px] of CLOUDS) {
    const cloud = sprite('cloud', { px });
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
  const who = person({ tone: 'gold', kind: 'bot', mood: 'cool', px: PX });
  const legs = sprite('anypercent-stand', { px: PX }, 'legs');
  const runner = h('div', 'runner');
  runner.append(who.el, legs);
  const cue = sprite('up', { tone: 'green', px: PX }, 'cue');
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
    for (let i = 0; i < REACH; i++) pad.append(sprite('up', { tone: 'green', px: 0.09 }));
    const spike = sprite('anypercent-spike', { tone: 'purple', px: 0.16 }, 'spike');
    el.append(pad, spike);
    strip.append(el);
    traps.push({ at, el, spike });
  }
  /** The spike a hop from tile `p` would clear, if one is in reach. */
  const ahead = (p: number) => traps.find((s) => s.at > p && s.at - p <= REACH);

  // The finish line is where a flawless runner gets with the par number of presses.
  const parPresses = Math.round((duration / 1000) * (7.2 + level * 0.35));
  let finish = 0;
  for (let i = 0; i < parPresses; i++) finish = ahead(finish) ? ahead(finish)!.at + 1 : finish + 1;
  goal.style.left = `calc(var(--tile) * ${finish})`;

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

  function draw() {
    strip.style.transform = `translateX(calc(var(--tile) * ${ME - pos}))`;
    clouds.style.transform = `translateX(${-((pos * 2.5) % 100) / 2}%)`;
    // The floor is a short piece of track that leapfrogs along two tiles (one stripe pair) at a time.
    floor.style.left = `calc(var(--tile) * ${2 * Math.floor((pos - ME - 6) / 2)})`;
    // Only what is near the screen is shown; a hop slides up to four tiles at once.
    const lo = pos - ME - 5;
    const hi = pos - ME + VIEW + 4;
    for (const s of traps) s.el.style.display = s.at > lo && s.at - REACH < hi ? '' : 'none';
    goal.style.display = finish > lo && finish < hi ? '' : 'none';
    mapMe.style.width = `${Math.min(100, (pos / finish) * 100)}%`;
    setSprite(legs, foot < 0 ? 'anypercent-stand' : `anypercent-step${foot}`, { px: PX });
    scene.classList.toggle('go', !!ahead(pos));
  }
  draw();

  return {
    press(b, t) {
      if (t < lockedUntil || pos >= TRACK - VIEW) return;
      const s = ahead(pos);
      if (b === 1) {
        if (!s) {
          // Nothing to clear: a hop on the spot costs a beat.
          lockedUntil = t + 300;
          who.mood('shock');
          act('g-anypercent-whiff');
          bad(callout, 'TOO EARLY');
          return;
        }
        pos = s.at + 1;
        foot = -1;
        heat = Math.min(1, heat + 0.4);
        s.el.classList.add('done');
        who.mood('happy');
        act('g-anypercent-hop');
        fx.poof(shadow);
        good(runner);
        fx.pop(s.spike, signed(behind(t)), behind(t) < 0 ? 'gold' : 'white');
        fx.burst(s.spike, 'gold', 10);
        fx.sound('boing');
        say(hype());
      } else {
        if (b === foot) {
          who.mood('shock');
          act('shake');
          bad(callout, 'OTHER FOOT');
          return;
        }
        foot = b;
        pos++;
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
          who.mood(wonAt < 0 ? 'cool' : 'happy');
          good(runner, wonAt < 0 ? undefined : 'GG');
        }
      }
      scene.classList.toggle('air', b === 1);
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
      clock.textContent = stamp(now);
      split.textContent = signed(behind(now));
      split.classList.toggle('ahead', behind(now) < 0);
      // The flag holds world-record pace: it reaches the finish line on the bell.
      const wr = Math.min(1, t / duration);
      mapWr.style.left = `${wr * 100}%`;
      const gap = wr * finish - pos + ME; // its tile, counted from the left edge of the scene
      ghost.style.display = wonAt < 0 && gap > 0.5 && gap < VIEW - 3.5 ? '' : 'none';
      ghost.style.left = `calc(var(--tile) * ${(gap + 0.5).toFixed(2)})`;
      runner.classList.toggle('down', t < downUntil);
      heat *= Math.exp((last - t) / 400);
      last = t;
      scene.style.setProperty('--pace', heat.toFixed(2));
    },
    score: () => ratio(pos, finish),
    hint(t) {
      if (t < lockedUntil || pos >= TRACK - VIEW) return null;
      return ahead(pos) ? 1 : foot === 0 ? 2 : 0;
    },
  };
};
