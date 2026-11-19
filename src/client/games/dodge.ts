import { COLOR, arrow, h, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

const FALL = 1300; // ms from the top of the lane to the player

export const dodge: GameFactory = ({ root, rng, level, duration, good, bad }) => {
  const gap = 760 - level * 55;
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

  for (let at = FALL + 300; at < duration - 150; at += gap) {
    const up = randBtn(rng);
    const others = shuffled(rng, ([0, 1, 2] as Btn[]).filter((b) => b !== up));
    const downs = level >= 2 && rng() < 0.3 + level * 0.12 ? others : others.slice(0, 1);
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
    press(b: Btn) {
      lane = b;
      place();
    },
    tick(t: number) {
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
            good();
          } else if (row.downs.includes(lane)) {
            hits++;
            pulse(me, 'shake');
            bad();
          }
          continue;
        }
        row.els.forEach((el) => {
          el.style.display = '';
          el.style.top = `${p * 82}%`;
        });
      }
    },
    score: () => Math.max(0, Math.round((1000 * got) / rows.length) - 150 * hits),
  };
};
