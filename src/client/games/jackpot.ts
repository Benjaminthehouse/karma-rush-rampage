import './jackpot.css';
import { COLOR, clamp1000, h, type Btn, type GameFactory } from './common';

// 0 is the gold award; the rest are duds.
const SYMBOLS = ['gold', 'silver', 'down', 'spam'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 14 + level * 2;
  // Each reel shows a long strip; gold comes round every three to five symbols.
  const strips = [0, 1, 2].map(() => {
    const s: number[] = [];
    while (s.length < 220) {
      const gap = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < gap; i++) s.push(1 + Math.floor(rng() * 3));
      s.push(0);
    }
    return s;
  });
  const period = [0, 1, 2].map((i) => 340 - level * 30 + i * 35);
  const stopped: (number | null)[] = [null, null, null];
  let spinFrom = 0; // reels are frozen for a beat after each payout
  const offset = [0, 40, 80];
  let points = 0;
  let misses = 0;
  let spins = 0;

  const wrap = h('div', 'g-jackpot');
  const machine = h('div', 'machine');
  const reels = [0, 1, 2].map((i) => {
    const reel = h('div', `reel c-${COLOR[i]}`);
    const next = h('i', 'sym next');
    const now = h('i', 'sym now');
    reel.append(next, now);
    machine.append(reel);
    return { reel, next, now, shown: -1 };
  });
  const note = h('div', 'g-note');
  wrap.append(machine, note);
  root.append(wrap);

  const pos = (i: number, t: number) => Math.max(0, Math.floor((t - spinFrom + offset[i]) / period[i]));
  const symAt = (i: number, t: number) => strips[i][(spins * 17 + pos(i, t)) % strips[i].length];

  function paint(t: number) {
    reels.forEach((r, i) => {
      const p = stopped[i] === null ? pos(i, t) : -2 - spins;
      if (p === r.shown) return;
      r.shown = p;
      if (stopped[i] === null) {
        r.now.className = `sym now ${SYMBOLS[symAt(i, t)]}`;
        r.next.className = `sym next ${SYMBOLS[strips[i][(spins * 17 + pos(i, t) + 1) % strips[i].length]]}`;
      }
    });
    note.textContent = `${points} gold`;
  }
  paint(0);

  return {
    press(b: Btn, t) {
      if (t < spinFrom || stopped[b] !== null) return;
      const sym = symAt(b, t);
      stopped[b] = sym;
      reels[b].reel.classList.add('stopped');
      reels[b].now.className = `sym now ${SYMBOLS[sym]}`;
      reels[b].next.className = 'sym next';
      if (sym === 0) {
        points++;
        good(reels[b].now);
      } else {
        misses++;
        bad(reels[b].now, 'DUD');
      }
      if (stopped.includes(null)) return;
      if (stopped.every((s) => s === 0)) {
        points += 2;
        fx.pop(machine, 'JACKPOT!', 'gold');
        fx.burst(machine, 'gold', 26);
        fx.flash('gold');
        fx.sound('coin');
      }
      spins++;
      spinFrom = t + 380;
    },
    tick(t) {
      if (!stopped.includes(null) && t >= spinFrom) {
        stopped.forEach((_, i) => (stopped[i] = null));
        reels.forEach((r) => r.reel.classList.remove('stopped'));
      }
      paint(t);
    },
    score: () => clamp1000((1000 * (points - misses / 2)) / par),
    hint(t) {
      if (t < spinFrom) return null;
      for (const i of [0, 1, 2] as Btn[]) if (stopped[i] === null && symAt(i, t) === 0) return i;
      return null;
    },
  };
};
