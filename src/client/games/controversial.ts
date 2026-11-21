import './controversial.css';
import { actor, COLOR, h, pulse, ratio, sprite, type Btn, type GameFactory } from './common';

// One rule: every arrow sinks, a tap lifts its arrow one step, and the gold band in the
// middle is where it scores. Too few taps and it is buried; too many and it is too popular.
export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const half = 0.12 - level * 0.007; // half-height of the gold band
  const step = 0.085; // one upvote
  // Each lane sinks at its own steady pace, so each wants its own rhythm: about one tap a
  // second on the slowest lane, up to two on the fastest in the last round.
  const pace = 1 + level * 0.08;
  const sink = [0, 1, 2].map(() => (0.07 + rng() * 0.05) * pace); // per second
  const warm = 400; // the trolls take a moment to get going, so the start can be read

  // Each arrow starts in the lower half of the gold, already on its way down.
  const pos = [0, 1, 2].map(() => 0.5 - half * (0.2 + rng() * 0.6));
  const lastBad = [-1000, -1000, -1000];
  const wasIn = [true, true, true];
  let last = 0;
  let banked = 0; // lane-milliseconds spent in the gold
  let streak = 0;

  // The scene: three posts in court, each with its upvote arrow floating over a troll who
  // keeps dragging it down. The gold band across the middle is 50/50.
  const wrap = h('div', 'g-controversial scene-court');
  const lanes = ([0, 1, 2] as Btn[]).map((b) => {
    const lane = h('div', `lane c-${COLOR[b]}`);
    const track = h('div', 'track');
    const band = h('div', 'band');
    band.style.bottom = `${(0.5 - half) * 100}%`;
    band.style.height = `${half * 200}%`;
    const carrier = h('div', 'carrier');
    const ride = h('div', 'ride');
    const arrow = sprite('up', { tone: COLOR[b], px: 0.24 }, 'arrow');
    ride.append(arrow);
    carrier.append(ride);
    track.append(h('span', 'edge top', 'TOO POPULAR'), band, h('span', 'edge low', 'BURIED'), carrier);
    const troll = actor('troll', { mood: 'angry', px: 0.17 });
    const pct = h('div', 'pct');
    const foot = h('div', 'foot');
    foot.append(troll.el, sprite('up', { tone: 'red', flipY: true, px: 0.11 }, 'down'));
    lane.append(track, foot, pct);
    wrap.append(lane);
    return { lane, carrier, arrow, troll, pct, shownY: '', shownPct: -1, state: '' };
  });
  root.append(wrap);

  const where = (i: number) => (Math.abs(pos[i] - 0.5) <= half ? 'in' : pos[i] > 0.5 ? 'high' : 'low');

  return {
    press(b) {
      pos[b] = Math.min(1, pos[b] + step);
      pulse(lanes[b].arrow, 'bump');
      fx.sound('pop');
    },
    tick(t) {
      const dt = Math.min(60, Math.max(0, t - last));
      last = t;
      const pull = Math.min(1, t / warm);
      let inside = 0;
      lanes.forEach((l, i) => {
        pos[i] = Math.max(0, pos[i] - (sink[i] * pull * dt) / 1000);
        const state = where(i);
        if (state === 'in') {
          inside++;
          banked += dt;
        } else if (wasIn[i] && t - lastBad[i] >= 700) {
          // One buzz per fall, not one per wobble across the edge.
          lastBad[i] = t;
          bad(l.arrow, state === 'high' ? 'TOO POPULAR' : 'BURIED');
        }
        wasIn[i] = state === 'in';
        if (state !== l.state) {
          l.state = state;
          l.lane.classList.toggle('in', state === 'in');
          l.lane.classList.toggle('high', state === 'high');
          l.lane.classList.toggle('low', state === 'low');
          // The troll gloats over a buried post and sulks over a popular one.
          l.troll.mood(state === 'low' ? 'happy' : state === 'high' ? 'sad' : 'angry');
        }
        const y = (pos[i] * 100).toFixed(1);
        if (y !== l.shownY) {
          l.shownY = y;
          l.carrier.style.transform = `translateY(${-y}%)`;
        }
        const pct = Math.round(pos[i] * 100);
        if (pct !== l.shownPct) {
          l.shownPct = pct;
          l.pct.textContent = `${pct}%`;
        }
      });
      // A cheer for every 0.9 s with all three in the gold.
      if (inside === 3) {
        streak += dt;
        if (streak >= 900) {
          streak = 0;
          good(lanes[1].arrow, '50/50');
        }
      }
    },
    score: () => ratio(banked, 3 * duration * 0.88),
    hint() {
      // Upvote whichever arrow has sunk furthest below the middle.
      let pickB: Btn | null = null;
      let lowest = 0.5 - step * 0.45;
      pos.forEach((p, i) => {
        if (p < lowest) {
          lowest = p;
          pickB = i as Btn;
        }
      });
      return pickB;
    },
  };
};
