import { COLOR, COLOR_NAME, h, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

export const peak: GameFactory = ({ root, rng, level, good, bad }) => {
  const n = 5;
  const sweep = 1150 - level * 90; // ms for the marker to cross once
  const targets = Array.from({ length: n }, () => {
    const order = shuffled(rng, [0, 1, 2] as Btn[]);
    const a = 0.24 + rng() * 0.2;
    const b = 0.24 + rng() * 0.2;
    return { want: randBtn(rng), order, widths: [a, b, 1 - a - b] };
  });
  let idx = 0;
  let hits = 0;
  let pos = 0;
  let pausedUntil = 0;

  const wrap = h('div', 'g-peak');
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
    note.textContent = `${hits} landed · ${n - idx} to go`;
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
    press(b: Btn, t: number) {
      const tg = targets[idx];
      if (!tg || t < pausedUntil) return;
      if (b === tg.want && zoneAt(pos) === tg.want) {
        hits++;
        good();
      } else {
        pulse(track, 'shake');
        bad();
      }
      idx++;
      pausedUntil = t + 250;
      show();
    },
    tick(t: number) {
      const phase = (t / sweep) % 2;
      pos = phase < 1 ? phase : 2 - phase;
      marker.style.left = `${pos * 100}%`;
    },
    score: () => Math.round((1000 * hits) / n),
  };
};
