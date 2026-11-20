import './rugpull.css';
import { actor, COLOR, clamp1000, defineSprite, h, pulse, shuffled, sprite, type Btn, type GameFactory } from './common';

const COINS = ['$MOON', '$DOGGO', '$RUGGY', '$HODL', '$PUMP', '$YOLO', '$KARMA', '$BEANS', '$CATNIP'];

// A meme coin in its column's colour, and the Troll's hand on the rug.
defineSprite('rugpull-coin', `
...kkkk...
..kLLAAk..
.kLAkkkak.
kLAkAAAAak
kAAAkkAAak
kAAAAAkAak
kAAkkkAAak
.kAAAAAak.
..kaaaak..
...kkkk...`);
defineSprite('rugpull-hand', `
.kk.kk.kk.
kgGkgGkgGk
kgGkgGkgGk
kggggggggk
kggggggGGk
.kgggggGk.
..kkkkkk..`);

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

  // The scene: a casino floor. Three coins climb their charts on a rug; the Troll stands at
  // the end of it, hand on the corner, ready to yank.
  const wrap = h('div', 'g-rugpull scene-casino');
  const note = h('div', 'note', '0 sold');
  const lot = h('div', 'lot');
  const cols = [0, 1, 2].map((i) => {
    const col = h('div', `col c-${COLOR[i]}`);
    const name = h('span', 'name');
    const track = h('div', 'track');
    const stem = h('i', 'stem');
    const token = h('div', 'token');
    token.append(sprite('rugpull-coin', { tone: COLOR[i], px: 0.26 }));
    track.append(stem, token);
    const value = h('b', 'value');
    col.append(name, track, value);
    lot.append(col);
    return { col, name, track, stem, token, value, shown: { cls: '', p: '', v: '', name: '' } };
  });
  const troll = actor('troll', { mood: 'wink', px: 0.32 });
  troll.el.classList.add('troll');
  const hand = sprite('rugpull-hand', { px: 0.26 }, 'hand');
  const rug = h('div', 'rug');
  rug.append(hand);
  const floor = h('div', 'floor');
  floor.append(lot, troll.el);
  wrap.append(note, floor, rug);
  root.append(wrap);
  cols.forEach((el, i) => {
    el.shown.name = coins[i].name;
    el.name.textContent = coins[i].name;
  });

  let shownSales = 0;
  let trollMood = '';
  const setTroll = (m: 'wink' | 'happy' | 'angry') => {
    if (m === trollMood) return;
    trollMood = m;
    troll.mood(m);
  };
  let moodUntil = 0;

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
        cols[b].shown.v = 'too soon';
        return;
      }
      const w = worth(p);
      banked += w;
      sales++;
      good(cols[b].token, `+${Math.round(w * 100)}`);
      if (p > 0.85) {
        // Got out right under the Troll's nose.
        setTroll('angry');
        moodUntil = t + 400;
        fx.burst(cols[b].token, 'gold', 16);
        fx.sound('coin');
      }
      cols[b].value.textContent = `sold ${Math.round(w * 100)}`;
      cols[b].shown.v = cols[b].value.textContent;
    },
    tick(t) {
      let shaky = false;
      coins.forEach((c, i) => {
        const el = cols[i];
        if (c.state === 'up' && t >= c.crashAt) {
          c.state = 'rugged';
          relistAt[i] = t + 500;
          bad(el.col, 'RUGGED');
          // The Troll yanks the rug out from under it.
          pulse(rug, 'yank');
          fx.poof(el.token);
          setTroll('happy');
          moodUntil = t + 450;
          el.value.textContent = 'rugged';
          el.shown.v = 'rugged';
        }
        if (c.state !== 'up' && t >= relistAt[i]) coins[i] = fresh(i, t);
        const now = coins[i];
        const shake = now.state === 'up' && now.crashAt - t <= tell;
        if (shake) shaky = true;
        const cls = `col c-${COLOR[i]} ${now.state}${shake ? ' shaky' : ''}`;
        if (cls !== el.shown.cls) {
          el.shown.cls = cls;
          el.col.className = cls;
        }
        if (now.name !== el.shown.name) {
          el.shown.name = now.name;
          el.name.textContent = now.name;
        }
        if (now.state === 'up') {
          const p = t < now.from ? 0 : price(now, t);
          const ps = p.toFixed(3);
          if (ps !== el.shown.p) {
            el.shown.p = ps;
            el.col.style.setProperty('--p', ps);
          }
          const v = String(Math.round(worth(p) * 100));
          if (v !== el.shown.v) {
            el.shown.v = v;
            el.value.textContent = v;
          }
        }
      });
      // The Troll grins while a coin wobbles, and grips the rug.
      if (t >= moodUntil) setTroll(shaky ? 'happy' : 'wink');
      hand.classList.toggle('grip', shaky);
      if (sales !== shownSales) {
        shownSales = sales;
        note.textContent = `${sales} sold`;
      }
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
