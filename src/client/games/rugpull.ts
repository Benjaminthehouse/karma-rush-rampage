import './rugpull.css';
import { COLOR, clamp1000, h, pick, type Btn, type GameFactory } from './common';

const COINS = ['$MOON', '$DOGGO', '$RUGGY', '$HODL', '$PUMP', '$YOLO', '$KARMA', '$BEANS', '$CATNIP'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const tell = 520 - level * 55; // ms of warning shake before the rug goes
  type Coin = { from: number; crashAt: number; state: 'up' | 'sold' | 'rugged'; name: string };
  const fresh = (from: number): Coin => ({
    from,
    crashAt: from + 1300 + rng() * (1700 - level * 150),
    state: 'up',
    name: pick(rng, COINS),
  });
  const coins: Coin[] = [fresh(0), fresh(250), fresh(500)];
  const relistAt = [0, 0, 0];
  // A coin's price as a share of the best possible sale (the instant before it crashes).
  const price = (c: Coin, t: number) => Math.max(0, Math.min(1, (t - c.from) / (c.crashAt - c.from)));
  let banked = 0;
  let sales = 0;
  const par = 6.5 + level * 0.4; // roughly two good sales per column

  const wrap = h('div', 'g-rugpull');
  const cols = [0, 1, 2].map((i) => {
    const col = h('div', `col c-${COLOR[i]}`);
    const name = h('span', 'name');
    const chart = h('div', 'chart');
    const bar = h('i');
    chart.append(bar);
    const value = h('b');
    col.append(name, chart, value);
    wrap.append(col);
    return { col, name, bar, value };
  });
  const note = h('div', 'g-note');
  wrap.append(note);
  root.append(wrap);
  cols.forEach((el, i) => (el.name.textContent = coins[i].name));

  return {
    press(b: Btn, t) {
      const c = coins[b];
      if (c.state !== 'up' || t < c.from) return;
      const p = price(c, t);
      c.state = 'sold';
      relistAt[b] = t + 450;
      // Selling in the first third is a panic sale: it earns nothing.
      if (p < 0.34) {
        bad(cols[b].col, 'PAPER HANDS');
        cols[b].value.textContent = 'sold too soon';
        return;
      }
      banked += p;
      sales++;
      good(cols[b].col, `+${Math.round(p * 100)}`);
      if (p > 0.85) {
        fx.burst(cols[b].col, 'gold', 16);
        fx.sound('coin');
      }
      cols[b].value.textContent = `sold at ${Math.round(p * 100)}`;
    },
    tick(t) {
      coins.forEach((c, i) => {
        const el = cols[i];
        if (c.state === 'up' && t >= c.crashAt) {
          c.state = 'rugged';
          relistAt[i] = t + 500;
          bad(el.col, 'RUGGED');
          el.value.textContent = 'rugged';
        }
        if (c.state !== 'up' && t >= relistAt[i]) coins[i] = fresh(t);
        const now = coins[i];
        el.col.className = `col c-${COLOR[i]} ${now.state}${now.state === 'up' && now.crashAt - t <= tell ? ' shaky' : ''}`;
        el.name.textContent = now.name;
        if (now.state === 'up') {
          const p = t < now.from ? 0 : price(now, t);
          el.bar.style.height = `${8 + p * 92}%`;
          el.value.textContent = String(Math.round(p * 100));
        } else if (now.state === 'rugged') el.bar.style.height = '4%';
      });
      note.textContent = `${sales} sold`;
    },
    score: () => clamp1000((1000 * banked) / par),
    hint(t) {
      // A perfect seller waits for the tell, then gets out with a little margin.
      for (const i of [0, 1, 2] as Btn[]) {
        const c = coins[i];
        if (c.state === 'up' && c.crashAt - t <= Math.min(tell, 260)) return i;
      }
      return null;
    },
  };
};
