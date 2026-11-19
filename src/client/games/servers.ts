import { h, pulse, ratio, type Btn, type GameFactory } from './common';

export const servers: GameFactory = ({ root, level, good, bad }) => {
  const target = 34 + level * 3;
  let n = 0;
  let last = -1;
  let complained = 0;

  const wrap = h('div', 'g-servers');
  const rack = h('div', 'rack');
  const units = Array.from({ length: 5 }, () => {
    const u = h('div', 'unit');
    u.append(h('i'), h('i'), h('i'), h('b'));
    rack.append(u);
    return u;
  });
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(rack, meter, note);
  root.append(wrap);

  function show() {
    const p = Math.min(1, n / target);
    fill.style.width = `${p * 100}%`;
    units.forEach((u, i) => u.classList.toggle('up', p >= (i + 1) / units.length));
    note.textContent = p >= 1 ? 'We’re back online!' : `Uptime ${Math.floor(p * 100)}%`;
  }
  show();

  return {
    press(b: Btn, t: number) {
      if (n >= target) return;
      if (b === last) {
        if (t - complained > 400) {
          complained = t;
          note.textContent = 'Alternate buttons!';
          pulse(rack, 'shake');
          bad();
        }
        return;
      }
      last = b;
      n++;
      show();
      if (n === target) good();
    },
    tick() {},
    score: () => ratio(n, target),
  };
};
