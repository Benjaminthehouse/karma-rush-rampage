import './npccheck.css';
import { actor, COLOR, h, pick, pulse, ratio, shuffled, type Actor, type Btn, type GameFactory } from './common';

// What both NPCs say, in unison, every single time.
const LINES = [
  'This.',
  'Nice.',
  'Same.',
  'First!',
  'Source?',
  'So true.',
  'Upvoted.',
  'Greetings.',
  'Lovely day.',
  'Wholesome.',
  'Checks out.',
  'Underrated.',
  'Big if true.',
];
// What a real player blurts out when the spotlight lands on them.
const CAUGHT = ['who, me?', 'LAG!!', 'hi mom', 'brb snack', 'gg', 'i was afk', 'nice spot', 'ok fine', 'one sec', 'wait what'];
// Two-pose loops the NPCs step through on the beat. The calm ones never lift an arm.
const CALM = ['sway', 'bob', 'squat'];
const IDLES = [...CALM, 'jack', 'disco'];
// Loops big enough to read even when the player is only half a pose late.
const BOLD = ['sway', 'squat', 'jack'];
// Things only a human with a keyboard does: some throw both arms up, some never lift one.
const WAVERS = ['hop', 'spin', 'flail'];
const SQUIRMERS = ['crouch', 'zoom'];

// One dancer on the pavement: an NPC head from the shared cast on a little body. The body
// pivots about the feet; each arm hangs from a shoulder that sets its resting slant, so the
// pose classes only ever rotate the arm itself.
function dancer(): { el: HTMLElement; face: Actor } {
  const body = h('div', 'body');
  const face = actor('npc', { px: 0.25 });
  const torso = h('div', 'torso');
  for (const side of ['l', 'r']) {
    const shoulder = h('div', `shoulder ${side}`);
    shoulder.append(h('i', `arm ${side}`));
    torso.append(shoulder);
  }
  const legs = h('div', 'legs');
  legs.append(h('i', 'leg'), h('i', 'leg'));
  body.append(face.el, torso, legs);
  return { el: body, face };
}

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 11 + level * 0.75;
  const beat = 400 - level * 25; // ms an NPC holds each pose
  // Dealt in shuffled sixes, two per colour, so no single button is ever a lucky guess.
  const order = Array.from({ length: 7 }, () => shuffled<Btn>(rng, [0, 0, 1, 1, 2, 2])).flat();
  const trios = order.map((real, i) => {
    const roll = rng();
    // The first trio always has the loud tell; later levels lean on timing alone.
    const wild = i === 0 || roll >= 0.2 + level * 0.18;
    // How many poses the player trails the NPCs by: a whole one, or (hardest) half of one.
    const lag = roll < (level - 2) * 0.12 ? 0.5 : 1;
    // A loud tell has to read in one frame: arms up beside calm NPCs, or arms down beside dancing ones.
    const waver = rng() < 0.7;
    return {
      real,
      idle: !wild ? pick(rng, lag < 1 ? BOLD : IDLES) : waver ? pick(rng, CALM) : 'disco',
      wild: !wild ? '' : pick(rng, waver ? WAVERS : SQUIRMERS),
      lag,
      flip: rng() < 0.5 ? 1 : 0,
      line: pick(rng, LINES),
      caught: pick(rng, CAUGHT),
    };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let shownAt = 0;
  let nextAt = -1; // while a reveal is on screen: when the next trio walks in
  let cleared = false;

  // The scene: feed street. Three people dance on coloured mats on the pavement. Two are NPCs
  // stepping in perfect sync; the real player is doing their own thing.
  const wrap = h('div', 'g-npccheck scene-street');
  const rule = h('div', 'rule');
  rule.innerHTML = 'Hit the one <b>out of sync</b>!';
  const row = h('div', 'row');
  const pods = COLOR.map((c) => {
    const pod = h('div', `pod c-${c}`);
    const top = h('div', 'top');
    const say = h('span', 'say');
    const fig = h('div', 'fig');
    const d = dancer();
    fig.append(d.el);
    top.append(say);
    pod.append(top, fig, h('i', 'floor'));
    row.append(pod);
    return { pod, say, fig, face: d.face };
  });
  const meter = h('div', 'gauge');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'tally');
  wrap.append(rule, row, meter, note);
  root.append(wrap);

  const score = () => ratio(right - wrong / 2, par);

  function progress() {
    fill.style.transform = `scaleX(${score() / 1000})`;
    note.textContent = right ? `${right} real player${right === 1 ? '' : 's'} found` : 'Two are NPCs. One is real.';
  }

  function show(t: number) {
    const trio = trios[idx % trios.length];
    shownAt = t;
    pods.forEach((p, i) => {
      p.pod.className = `pod c-${COLOR[i]}`;
      p.fig.className = i === trio.real && trio.wild ? `fig w-${trio.wild}` : `fig m-${trio.idle}`;
      p.say.textContent = '';
      p.face.mood('idle');
    });
    pulse(row, 'pop-in');
    progress();
  }
  show(0);

  function advance(t: number) {
    if (nextAt < 0 || t < nextAt) return;
    nextAt = -1;
    idx++;
    show(t);
  }

  return {
    press(b, t) {
      advance(t);
      if (nextAt >= 0) return;
      const trio = trios[idx % trios.length];
      const real = pods[trio.real];
      if (b === trio.real) {
        right++;
        nextAt = t + 300;
        real.pod.classList.add('found');
        real.say.textContent = trio.caught;
        real.face.mood('happy');
        pods.forEach((p) => {
          if (p === real) return;
          p.pod.classList.add('npc');
          p.face.mood('sleep');
          p.say.textContent = trio.line;
        });
        good(real.fig);
        fx.burst(real.fig, COLOR[b], 10);
        fx.sound('boing');
        if (right % 5 === 0) {
          fx.burst(row, 'gold', 18);
          fx.sound('coin');
        }
      } else {
        wrong++;
        nextAt = t + 450;
        // The NPC just says its one line again. Twice.
        pods[b].pod.classList.add('npc');
        pods[b].face.mood('sleep');
        real.face.mood('wink');
        pods[b].say.textContent = `${trio.line}\n${trio.line}`;
        real.pod.classList.add('missed');
        real.say.textContent = 'over here!';
        pulse(pods[b].pod, 'shake');
        // Floated from the row, not the pod: words this long get cut off by the stage edge over an outer pod.
        bad(row, 'JUST AN NPC');
      }
      progress();
      if (!cleared && score() === 1000) {
        cleared = true;
        fx.flash('gold');
        fx.pop(row, 'ALL PLAYERS FOUND', 'gold');
        fx.sound('power');
      }
    },
    tick(t) {
      advance(t);
      const trio = trios[idx % trios.length];
      const beats = (t - shownAt) / beat;
      pods.forEach((p, i) => {
        const pose = Math.floor(beats - (i === trio.real ? trio.lag : 0)) + trio.flip;
        p.fig.classList.toggle('p1', (pose & 1) === 1);
      });
    },
    score,
    hint: () => (nextAt < 0 ? trios[idx % trios.length].real : null),
  };
};
