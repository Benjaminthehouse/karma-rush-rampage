import './peak.css';
import { COLOR, COLOR_NAME, clamp1000, h, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const par = 6 + Math.floor(level / 2);
  // Every press locks input for 250 ms, so this is more targets than anyone can use up: the round never goes dead.
  const n = Math.ceil(duration / 250) + 2;
  const sweep = 1150 - level * 90; // ms for the marker to cross once
  const targets = Array.from({ length: n }, () => {
    const order = shuffled(rng, [0, 1, 2] as Btn[]);
    const a = 0.24 + rng() * 0.2;
    const b = 0.24 + rng() * 0.2;
    return { want: randBtn(rng), order, widths: [a, b, 1 - a - b] };
  });
  let idx = 0;
  let hits = 0;
  let misses = 0;
  let pos = 0;
  let pausedUntil = 0;

  const wrap = h('div', 'g-peak');
  // Words pop from above this line, never from the marker: there they drifted across the next colour to read.
  const ask = h('div', 'rule');
  const track = h('div', 'track');
  const zones = [h('i'), h('i'), h('i')];
  const marker = h('b', 'marker');
  track.append(...zones, marker);
  const note = h('div', 'g-note');
  wrap.append(ask, track, note);
  root.append(wrap);

  function show() {
    const tg = targets[idx];
    if (!tg) {
      ask.textContent = 'Schedule full!';
      note.textContent = `${hits} of ${n} posts landed`;
      return;
    }
    ask.innerHTML = `Post during <b class="t-${COLOR[tg.want]}">${COLOR_NAME[tg.want]}</b>`;
    zones.forEach((z, i) => {
      z.className = `zone c-${COLOR[tg.order[i]]}`;
      z.style.flexBasis = `${tg.widths[i] * 100}%`;
    });
    note.textContent = `${hits} posts landed`;
  }
  show();

  function zoneAt(p: number): Btn {
    const tg = targets[idx];
    let edge = 0;
    for (let i = 0; i < 3; i++) {
      edge += tg.widths[i];
      if (p <= edge) return tg.order[i];
    }
    return tg.order[2];
  }

  return {
    press(b, t) {
      const tg = targets[idx];
      if (!tg || t < pausedUntil) return;
      if (b === tg.want && zoneAt(pos) === tg.want) {
        hits++;
        good(marker);
        fx.pop(ask, 'POSTED', 'gold');
      } else {
        misses++;
        pulse(track, 'shake');
        bad(marker);
        fx.pop(ask, b === tg.want ? 'BAD TIMING' : 'WRONG COLOUR', 'red');
      }
      idx++;
      pausedUntil = t + 250;
      show();
    },
    tick(t) {
      const phase = (t / sweep) % 2;
      pos = phase < 1 ? phase : 2 - phase;
      marker.style.left = `${pos * 100}%`;
    },
    score: () => clamp1000((1000 * (hits - misses / 2)) / par),
    hint(t) {
      const tg = targets[idx];
      return tg && t >= pausedUntil && zoneAt(pos) === tg.want ? tg.want : null;
    },
  };
};
