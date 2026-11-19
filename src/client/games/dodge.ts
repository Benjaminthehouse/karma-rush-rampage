import './dodge.css';
import { COLOR, arrow, clamp1000, h, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, duration, good, bad }) => {
  const FALL = 1250 - level * 90; // ms from the top of the lane to the player
  const gap = 800 - level * 80;
  const rows: { at: number; up: Btn; downs: Btn[]; els: HTMLElement[]; done: boolean }[] = [];

  const wrap = h('div', 'g-dodge');
  const lanes = [0, 1, 2].map((i) => {
    const l = h('div', `lane c-${COLOR[i]}`);
    wrap.append(l);
    return l;
  });
  const me = h('div', 'blob');
  me.append(h('i'), h('i'));
  wrap.append(me);
  root.append(wrap);

  let prevUp = 1;
  for (let at = FALL + 300; at < duration - 150; at += gap) {
    // Never where the player already stands, so standing still catches nothing.
    let up = randBtn(rng);
    while (up === prevUp) up = randBtn(rng);
    prevUp = up;
    const others = shuffled(rng, ([0, 1, 2] as Btn[]).filter((b) => b !== up));
    // Early rounds leave one safe lane; later every lane has something in it.
    const downs = rng() < 0.45 + level * 0.14 ? others : others.slice(0, 1);
    const els: HTMLElement[] = [];
    const add = (lane: Btn, dir: 'up' | 'down') => {
      const el = arrow(dir, 'faller');
      el.dataset.lane = String(lane);
      el.style.display = 'none';
      lanes[lane].append(el);
      els.push(el);
    };
    add(up, 'up');
    downs.forEach((d) => add(d, 'down'));
    rows.push({ at, up, downs, els, done: false });
  }

  let lane: Btn = 1;
  let got = 0;
  let hits = 0;
  const place = () => (me.style.left = `${(lane * 2 + 1) * (100 / 6)}%`);
  place();

  return {
    press(b) {
      lane = b;
      place();
    },
    tick(t) {
      for (const row of rows) {
        if (row.done) continue;
        const p = (t - (row.at - FALL)) / FALL;
        if (p < 0) continue;
        if (p >= 1) {
          row.done = true;
          row.els.forEach((el) => {
            if (Number(el.dataset.lane) === lane) el.classList.add('taken');
            else el.style.display = 'none';
          });
          if (lane === row.up) {
            got++;
            pulse(me, 'bump');
            good(me, '+1');
          } else if (row.downs.includes(lane)) {
            hits++;
            pulse(me, 'shake');
            bad(me, 'OUCH');
          }
          continue;
        }
        row.els.forEach((el) => {
          el.style.display = '';
          el.style.top = `${p * 82}%`;
        });
      }
    },
    score: () => clamp1000((1000 * got) / rows.length - 150 * hits),
    hint() {
      const next = rows.find((r) => !r.done);
      return next && next.up !== lane ? next.up : null;
    },
  };
};
