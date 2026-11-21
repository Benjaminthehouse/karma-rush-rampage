import './controversial.css';
import { actor, defineSprite, h, pick, pulse, randInt, ratio, sprite, type Actor, type GameFactory } from './common';

const TAKES = [
  'Pineapple belongs on pizza',
  'Cereal is a soup',
  'A hot dog is a sandwich',
  'Socks with sandals are fine',
  'The book was worse',
  'Mornings are the best part of the day',
  'Water is not wet',
  'GIF has a hard G',
];

// The flag tied to the middle of the rope.
defineSprite('controversial-flag', `
.kkkkkkkkk..
.kyyyyyyyyk.
.kyYyyyyyyyk
.kyyyyyyyyyk
.kyyyyyyyyk.
.kkkkkkkkk..
.kn.........
.kn.........
.kn.........
.kn.........
.kn.........
.kk.........`);

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const half = 0.1 - level * 0.006; // half-width of the gold zone
  const nudge = 0.07;
  const speed = 0.00015 + level * 0.000028; // how hard the crowd shoves, per ms
  // ORDER!: the judge's gavel stuns the crowd. Long enough to be worth a button, and it
  // has to recharge, so it is a breather rather than a way to play the round.
  const ORDER_MS = 800;
  const RECHARGE_MS = 2800;
  // The crowd builds up to full speed, so the first shove can be read before it lands.
  // (At full speed the last round would be out of the zone 0.23 s after the bell.)
  const warm = 300 + level * 150;
  // The crowd shoves in bursts, and mostly piles on: away from the middle.
  const shoves: { until: number; roll: number }[] = [];
  for (let at = 0; at < duration + 1000; ) {
    at += randInt(rng, 450, 850);
    shoves.push({ until: at, roll: rng() });
  }
  let shove = 0;
  let dir = rng() < 0.5 ? -1 : 1;
  let touched = false; // any press during the current shove

  let pos = 0.5;
  let last = 0;
  let inZone = 0;
  let orderUntil = 0;
  let orderReadyAt = 0;
  let wasIn = true;
  let streak = 0;
  let lastBad = -1000;

  // The scene: a tug of war in court. Mod Bear presides with a gavel; the downvote crowd
  // hauls the rope left, the upvote crowd hauls it right, and the flag must stay over the
  // gold zone. A big readout says where the vote stands and which way to tap.
  const wrap = h('div', 'g-controversial scene-court');
  const top = h('div', 'top');
  const bench = h('div', 'bench');
  const judge = actor('modbear', { mood: 'peep', px: 0.26 });
  const gavel = sprite('hammer', { px: 0.2 }, 'gavel');
  bench.append(judge.el, gavel);
  const take = h('div', 'take', `“${pick(rng, TAKES)}”`);
  const pct = h('b', 'pct');
  const tip = h('span', 'tip');
  const meter = h('div', 'readout');
  meter.append(pct, tip);
  top.append(bench, take, meter);

  const field = h('div', 'field');
  const zone = h('i', 'zone');
  zone.style.left = `${(0.5 - half) * 100}%`;
  zone.style.width = `${half * 200}%`;
  zone.append(h('span', '', '50/50'));
  const rail = h('div', 'rail');
  rail.append(zone, h('i', 'rope'));
  const flag = h('div', 'flag');
  flag.append(sprite('controversial-flag', { px: 0.26 }));
  // Pop-ups float up from above the rope, so they never hide the flag or the zone.
  const stamp = h('i', 'stamp');
  rail.append(flag, stamp);
  const team = (side: 'down' | 'up') => {
    const el = h('div', `team ${side}`);
    const back = actor('npc', { mood: 'angry', px: 0.26 });
    back.el.classList.add('back');
    const front = actor('npc', { mood: 'angry', px: 0.34 });
    front.el.classList.add('front');
    const sign = sprite('up', { tone: side === 'up' ? 'blue' : 'red', flipY: side === 'down', px: 0.2 }, 'sign');
    el.append(back.el, front.el, sign);
    return { el, crew: [back, front] as Actor[] };
  };
  const downs = team('down');
  const ups = team('up');
  field.append(rail, downs.el, ups.el);

  const ends = h('div', 'ends');
  // Over the middle button: lit while ORDER! is ready, dim while the gavel recharges.
  const chip = h('span', 'chip');
  ends.append(h('span', 'side t-red', '◀ downvotes'), chip, h('span', 'side t-blue', 'upvotes ▶'));
  wrap.append(top, field, ends);
  root.append(wrap);

  // What is on screen, so tick only touches the DOM when something changes.
  let shownPos = '';
  let shownPct = -1;
  let shownState = '';

  return {
    press(b, t) {
      touched = true;
      if (b === 1) {
        if (t < orderReadyAt) {
          fx.sound('tick');
          pulse(chip, 'shake');
          return;
        }
        // The gavel comes down: the crowd is stunned and stops shoving for a moment.
        orderUntil = t + ORDER_MS;
        orderReadyAt = t + RECHARGE_MS;
        fx.sound('thud');
        pulse(gavel, 'slam');
        fx.shake();
        fx.pop(bench, 'ORDER!', 'green');
        return;
      }
      pos = Math.max(0, Math.min(1, pos + (b === 2 ? nudge : -nudge)));
      // Your tug: that crowd heaves and the flag jumps their way.
      pulse((b === 2 ? ups : downs).el, 'heave');
      fx.sound('pop');
    },
    tick(t) {
      const dt = Math.min(60, Math.max(0, t - last));
      last = t;
      while (shoves[shove + 1] && t >= shoves[shove].until) {
        shove++;
        const away = pos >= 0.5 ? 1 : -1;
        // Left alone the crowd only piles on, so a vote nobody is tending never wanders
        // back into the zone (an idle round used to score up to 850 on a lucky day).
        dir = touched && shoves[shove].roll >= 0.72 ? -away : away;
        touched = false;
      }
      if (t >= orderUntil) pos = Math.max(0, Math.min(1, pos + dir * speed * Math.min(1, t / warm) * dt));
      const inside = Math.abs(pos - 0.5) <= half;
      if (inside) {
        inZone += dt;
        // A cheer for every 0.9 s banked, like the score: a wobble does not wipe it.
        streak += dt;
        if (streak >= 900) {
          streak = 0;
          good(stamp, '50/50');
        }
      } else if (wasIn && t - lastBad >= 650) {
        // One buzz per fall, not one per wobble across the edge.
        lastBad = t;
        bad(stamp, pos > 0.5 ? 'TOO POPULAR' : 'BURIED');
      }
      wasIn = inside;
      const p = pos.toFixed(3);
      if (p !== shownPos) {
        shownPos = p;
        flag.style.setProperty('--p', p);
      }
      const frozen = t < orderUntil;
      const spent = t < orderReadyAt;
      const state = `${inside} ${pos > 0.5} ${frozen} ${spent} ${dir}`;
      if (state !== shownState) {
        shownState = state;
        wrap.classList.toggle('in', inside);
        wrap.classList.toggle('order', frozen);
        wrap.classList.toggle('high', !inside && pos > 0.5);
        wrap.classList.toggle('low', !inside && pos < 0.5);
        wrap.classList.toggle('spent', spent);
        wrap.classList.toggle('pull-up', !frozen && dir > 0);
        wrap.classList.toggle('pull-down', !frozen && dir < 0);
        // The readout says it in words: where the vote is, and which button fixes it.
        tip.textContent = inside ? 'CONTROVERSIAL! KEEP IT HERE' : pos > 0.5 ? 'TOO POPULAR! TAP DOWNVOTE' : 'BURIED! TAP UPVOTE';
        chip.textContent = frozen ? 'ORDER!' : spent ? 'gavel recharging' : 'ORDER! ready';
        // Whoever is winning cheers; the losing crowd strains; ice shocks everyone.
        const face = (mine: boolean) => (frozen ? 'shock' : inside ? 'angry' : mine ? 'happy' : 'sad');
        for (const a of downs.crew) a.mood(face(!inside && pos < 0.5));
        for (const a of ups.crew) a.mood(face(!inside && pos > 0.5));
        judge.mood(frozen ? 'angry' : 'peep');
      }
      const now = Math.round(pos * 100);
      if (now !== shownPct) {
        shownPct = now;
        pct.textContent = `${now}%`;
      }
    },
    score: () => ratio(inZone, duration * 0.88),
    hint() {
      const off = pos - 0.5;
      return Math.abs(off) < nudge * 0.55 ? null : off > 0 ? 0 : 2;
    },
  };
};
