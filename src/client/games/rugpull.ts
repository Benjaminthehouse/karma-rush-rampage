import './rugpull.css';
import { COLOR, clamp1000, h, shuffled, type Btn, type GameFactory } from './common';

const COINS = ['$MOON', '$DOGGO', '$RUGGY', '$HODL', '$PUMP', '$YOLO', '$KARMA', '$BEANS', '$CATNIP'];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const tell = 520 - level * 55; // ms of warning shake before the rug goes
  type Coin = { from: number; crashAt: number; state: 'up' | 'sold' | 'paper' | 'rugged'; name: string };
  // Each column's coins are dealt up front: everyone meets the same coins in the same
  // order however they trade, and two columns never show the same name.
  const names = shuffled(rng, COINS);
  const lives = [0, 1, 2].map(() => Array.from({ length: 20 }, () => 1300 + rng() * (1700 - level * 150)));
  const dealt = [0, 0, 0];
  const fresh = (i: number, from: number): Coin => {
    const n = dealt[i]++;
    return { from, crashAt: from + lives[i][n % 20], state: 'up', name: names[i * 3 + (n % 3)] };
  };
  const coins: Coin[] = [fresh(0, 0), fresh(1, 250), fresh(2, 500)];
  const relistAt = [0, 0, 0];
  // How far a coin has climbed its chart: 0 at listing, 1 the instant before it crashes.
  const price = (c: Coin, t: number) => Math.max(0, Math.min(1, (t - c.from) / (c.crashAt - c.from)));
  // What a sale banks. It grows with the square of the climb, so the last stretch before
  // the crash is where the money is; bailing out halfway and re-buying must not pay as well.
  const worth = (p: number) => p * p;
  let banked = 0;
  let sales = 0;
  const par = 7.3 + level * 0.4; // about nine sales, each deep into the shake

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
        c.state = 'paper';
        bad(cols[b].col, 'PAPER HANDS');
        cols[b].value.textContent = 'too soon';
        return;
      }
      const w = worth(p);
      banked += w;
      sales++;
      good(cols[b].col, `+${Math.round(w * 100)}`);
      if (p > 0.85) {
        fx.burst(cols[b].col, 'gold', 16);
        fx.sound('coin');
      }
      cols[b].value.textContent = `sold at ${Math.round(w * 100)}`;
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
        if (c.state !== 'up' && t >= relistAt[i]) coins[i] = fresh(i, t);
        const now = coins[i];
        el.col.className = `col c-${COLOR[i]} ${now.state}${now.state === 'up' && now.crashAt - t <= tell ? ' shaky' : ''}`;
        el.name.textContent = now.name;
        if (now.state === 'up') {
          const p = t < now.from ? 0 : price(now, t);
          el.bar.style.height = `${8 + p * 92}%`;
          el.value.textContent = String(Math.round(worth(p) * 100));
        } else if (now.state === 'rugged') el.bar.style.height = '4%';
      });
      note.textContent = `${sales} sold`;
    },
    score: () => clamp1000((1000 * banked) / par),
    hint(t) {
      // A perfect seller rides the shake almost to the end, then gets out with a little
      // margin, and dumps whatever is worth something just before the bell.
      const bell = duration - t <= 240;
      for (const i of [0, 1, 2] as Btn[]) {
        const c = coins[i];
        if (c.state !== 'up' || t < c.from) continue;
        if (c.crashAt - t <= Math.min(tell, 160) || (bell && price(c, t) >= 0.34)) return i;
      }
      return null;
    },
  };
};
