import './servers.css';
import { h, pick, pulse, ratio, type Btn, type GameFactory } from './common';

const HOSTS = ['us-east-karma', 'eu-meme-1', 'cat-pics-cdn', 'ap-south-lurk', 'upvote-db', 'mod-queue-7', 'flair-cache', 'award-shard', 'reply-guy-2', 'front-page'];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const target = Math.round((duration / 1000) * (7.2 + level * 0.45));
  let n = 0;
  let last = -1;
  let complained = -1000;
  let lit = 0;

  const wrap = h('div', 'g-servers');
  const rack = h('div', 'rack');
  const units = Array.from({ length: 5 }, () => {
    const u = h('div', 'unit');
    u.append(h('i'), h('i'), h('span', 'host', pick(rng, HOSTS)), h('b'));
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
    const up = Math.floor(p * units.length);
    units.forEach((u, i) => u.classList.toggle('up', i < up));
    if (up > lit) {
      lit = up;
      fx.burst(units[up - 1], 'green', 12);
      fx.sound('ding');
    }
    note.textContent = n >= target ? `OVERCLOCKED ${Math.floor((n / target) * 100)}%` : `Uptime ${Math.floor(p * 100)}%`;
  }
  show();

  return {
    press(b, t) {
      if (b === last) {
        if (t - complained > 400) {
          complained = t;
          pulse(rack, 'shake');
          bad(rack, 'ALTERNATE!');
        }
        return;
      }
      last = b;
      n++;
      good(meter);
      show();
    },
    tick() {},
    score: () => ratio(n, target),
    hint: () => ((last + 1) % 3) as Btn,
  };
};
