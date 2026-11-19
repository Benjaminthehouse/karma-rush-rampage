import './npccheck.css';
import { COLOR, h, pick, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

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

// Drawn around the feet at 0,0 so the body sways, squats and spins about the floor.
const FIGURE =
  '<svg viewBox="-34 -140 68 144" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><g class="body">' +
  '<line class="leg" x1="-6" y1="-44" x2="-8" y2="-4"/><line class="leg" x1="6" y1="-44" x2="8" y2="-4"/>' +
  '<g transform="translate(-12 -78)"><line class="arm l" x1="0" y1="0" x2="-10" y2="23"/></g>' +
  '<g transform="translate(12 -78)"><line class="arm r" x1="0" y1="0" x2="10" y2="23"/></g>' +
  '<rect class="shirt" x="-14" y="-85" width="28" height="45" rx="9"/>' +
  '<circle class="head" cx="0" cy="-102" r="15"/>' +
  '<circle class="face" cx="-5.5" cy="-103" r="2.4"/><circle class="face" cx="5.5" cy="-103" r="2.4"/>' +
  '<rect class="face" x="-4.5" y="-96" width="9" height="2.4" rx="1.2"/>' +
  '</g></svg>';

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

  const wrap = h('div', 'g-npccheck');
  const rule = h('div', 'rule');
  rule.innerHTML = 'Hit the one <b>out of sync</b>!';
  const row = h('div', 'row');
  const pods = COLOR.map((c) => {
    const pod = h('div', `pod c-${c}`);
    const top = h('div', 'top');
    const say = h('span', 'say');
    const fig = h('div', 'fig');
    fig.innerHTML = FIGURE;
    top.append(say);
    pod.append(top, fig, h('i', 'floor'));
    row.append(pod);
    return { pod, say, fig };
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(rule, row, meter, note);
  root.append(wrap);

  const score = () => ratio(right - wrong / 2, par);

  function progress() {
    fill.style.width = `${score() / 10}%`;
    note.textContent = right ? `${right} real player${right === 1 ? '' : 's'} found` : 'Two are NPCs. One is real.';
  }

  function show(t: number) {
    const trio = trios[idx % trios.length];
    shownAt = t;
    pods.forEach((p, i) => {
      p.pod.className = `pod c-${COLOR[i]}`;
      p.fig.className = i === trio.real && trio.wild ? `fig w-${trio.wild}` : `fig m-${trio.idle}`;
      p.say.textContent = '';
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
        pods.forEach((p) => {
          if (p === real) return;
          p.pod.classList.add('npc');
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
