import './stonks.css';
import { COLOR, arrow, h, pick, randInt, ratio, shuffled, type Btn, type GameFactory } from './common';

const TICKERS = ['$CATS', '$SOUP', '$MEME', '$YOLO', '$NAPS', '$BEANS', '$HYPE', '$COPE', '$APES', '$VIBE', '$TACO', '$OOPS'];
const NEWS = [
  'CEO posted a rocket',
  'up on pure vibes',
  'announced nothing, soars',
  'my cousin says buy',
  'added AI to its name',
  'chart looks like a dog',
  'apes found the ticker',
  'trust me bro, says post',
  'has a very cute mascot',
  'due diligence: 3 rockets',
];
const HYPE = ['STONKS!', 'HODL!', 'TENDIES!', 'BULLISH!', 'PUMP IT!', 'APE IN!', 'GAINS!', 'YOLO!'];
const BAGS = ['GUH!', 'REKT', 'OOF', 'PANIC!', 'SELL LOW', 'BAGGED!', 'DIPPED!', 'BIG OOF'];
const RANKS = ['PAPER HANDS', 'STONKS', 'DIAMOND HANDS', 'TO THE MOON'];
const RANK_AT = [0, 300, 650, 1000]; // the score that earns each rank
/** What a ticker says under its arrow: [button up, button held, held through a dump]. */
const TAGS = {
  up: ['HOLD ME!', 'STONKS', 'LET GO!'],
  top: ['TOPPED', 'LET GO!', 'LET GO!'],
  down: ['DUMPING', 'DUMPING', 'BAG HOLDER'],
};
const BTNS: Btn[] = [0, 1, 2];
const STEP = 25; // ms between portfolio updates
const BEAT = 5; // steps between candles, sparks and sounds
const CANDLES = 6;

export const create: GameFactory = ({ root, rng, level, duration, down, good, bad, fx }) => {
  const wobble = 380 - level * 40; // ms a topped-out ticker hangs in the air before holding it costs money
  const doubles = Math.max(0, level - 1) * 0.1; // later rounds sometimes pump two tickers at once
  const names = shuffled(rng, TICKERS).slice(0, 3);
  const noise = Array.from({ length: 16 }, () => 0.5 + rng());

  // Back-to-back pumps. Each one lights a ticker that was not climbing in the pump before.
  const pumps: { from: number; to: number; up: Btn[]; news: string; hype: string; bag: string }[] = [];
  let best = 0;
  let from = 0;
  let prev: Btn[] = [];
  while (from < duration + 1000) {
    const order = shuffled(rng, BTNS);
    const lead = order.filter((b) => !prev.includes(b))[0];
    const up = rng() < doubles ? [lead, order.filter((b) => b !== lead)[0]] : [lead];
    const to = from + randInt(rng, 850, 1450) - level * 70;
    pumps.push({ from, to, up, news: pick(rng, NEWS), hype: pick(rng, HYPE), bag: pick(rng, BAGS) });
    best += (Math.max(0, Math.min(to, duration) - from) / STEP) * up.length;
    prev = up;
    from = to;
  }
  const par = Math.round(best * 0.88);

  let clock = 0; // the portfolio is settled up to this time
  let steps = 0;
  let money = 0;
  let swing = 0; // net change since the last beat
  let hot: Btn = 1; // last held ticker that paid
  let riding = 0; // the pump it paid in
  let cold: Btn = 1; // last held ticker that cost
  const bagged = [false, false, false]; // held through a dump: pays nothing more until let go
  let losing = 0; // beats in a row spent losing money
  let cheered = -1; // last pump the player was cheered for catching
  let shown = -1;
  let rank = 0;

  const wrap = h('div', 'g-stonks pix');
  const board = h('div', 'board');
  const label = h('span', 'rank');
  const cash = h('b', 'cash');
  const track = h('div', 'track');
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  track.append(meter, h('span', 'moon'));
  board.append(label, cash, track);
  const row = h('div', 'row');
  const cols = BTNS.map((b) => {
    const el = h('div', `col c-${COLOR[b]}`);
    const chart = h('div', 'chart');
    const candles = Array.from({ length: CANDLES }, (_, k) => {
      const candle = h('i');
      candle.style.left = `${(k * 100) / CANDLES + 3}%`;
      chart.append(candle);
      return candle;
    });
    const tag = h('span', 'tag');
    el.append(h('span', 'name', names[b]), chart, arrow('up'), tag);
    row.append(el);
    // Every chart opens on a jagged slide, so the first pump stands out.
    return { el, candles, tag, key: '', prices: Array.from({ length: CANDLES + 1 }, (_, k) => -k * noise[b + k]) };
  });
  const note = h('div', 'g-note');
  wrap.append(board, row, note);
  root.append(wrap);

  const pumpIndex = (t: number) => {
    const i = pumps.findIndex((p) => t < p.to);
    return i < 0 ? pumps.length - 1 : i;
  };
  function stateOf(b: Btn, t: number): 'up' | 'top' | 'down' {
    const i = pumpIndex(t);
    if (pumps[i].up.includes(b)) return 'up';
    return i > 0 && pumps[i - 1].up.includes(b) && t - pumps[i].from < wobble ? 'top' : 'down';
  }
  const score = () => ratio(money, par);

  function draw(c: (typeof cols)[number]) {
    const lo = Math.min(...c.prices);
    const span = Math.max(...c.prices) - lo || 1;
    c.candles.forEach((el, k) => {
      const open = (c.prices[k] - lo) / span;
      const close = (c.prices[k + 1] - lo) / span;
      el.className = close > open ? 'gain' : '';
      el.style.bottom = `${8 + Math.min(open, close) * 80}%`;
      el.style.height = `${Math.max(3, Math.abs(close - open) * 80)}%`;
    });
  }

  /** Candles, sparks and stamps, eight times a second. */
  function beat(t: number) {
    cols.forEach((c, b) => {
      const s = stateOf(b as Btn, t);
      const move = (s === 'up' ? 1 : s === 'down' ? -1 : 0.1) * noise[(steps + b) % noise.length];
      c.prices.push(c.prices[CANDLES] + move);
      c.prices.shift();
      draw(c);
    });
    if (swing > 0) {
      good(cols[hot].el, riding === cheered ? undefined : pumps[riding].hype);
      cheered = riding;
      losing = 0;
    } else if (swing < 0) {
      if (losing++ % 3 === 0) bad(cols[cold].el, pumps[pumpIndex(t)].bag);
    } else losing = 0;

    const now = RANK_AT.filter((at) => score() >= at).length - 1;
    label.textContent = swing < 0 ? 'NOT STONKS' : RANKS[now];
    board.classList.toggle('loss', swing < 0);
    board.classList.toggle('landed', now === 3);
    swing = 0;
    if (now <= rank) return;
    rank = now;
    fx.pop(board, `${RANKS[now]}!`, 'gold');
    fx.burst(board, 'gold', 12 + now * 6);
    fx.sound(now === 3 ? 'power' : 'coin');
    if (now === 3) fx.flash('gold');
  }

  /** Pays or charges every held ticker for one slice of time. */
  function step(t: number) {
    let delta = 0;
    for (const b of BTNS) {
      if (!down[b]) continue;
      const s = stateOf(b, t);
      if (s === 'down') {
        delta--;
        cold = b;
        bagged[b] = true;
      } else if (s === 'up' && !bagged[b]) {
        delta++;
        hot = b;
        riding = pumpIndex(t);
      }
    }
    money = Math.max(0, money + delta);
    swing += delta;
    if (++steps % BEAT === 0) beat(t);
  }

  function render(t: number) {
    const i = pumpIndex(t);
    if (i !== shown) {
      if (shown >= 0) fx.sound('zap');
      shown = i;
      const p = pumps[i];
      note.textContent = p.up.length > 1 ? `DOUBLE PUMP! ${p.up.map((b) => names[b]).join(' + ')}` : `${names[p.up[0]]}: ${p.news}`;
    }
    cols.forEach((c, b) => {
      const s = stateOf(b as Btn, t);
      const grip = bagged[b] ? 2 : down[b] ? 1 : 0;
      const key = `${s} ${['', 'held', 'bag'][grip]}`;
      if (key === c.key) return;
      c.key = key;
      c.el.className = `col c-${COLOR[b]} ${key}`;
      c.tag.textContent = TAGS[s][grip];
    });
    cash.textContent = `$${(money * 40).toLocaleString('en-US')}`;
    fill.style.width = `${score() / 10}%`;
  }
  label.textContent = RANKS[0];
  cols.forEach(draw);
  render(0);

  return {
    press(b, t) {
      fx.sound(stateOf(b, t) === 'up' ? 'power' : 'thud');
    },
    release(b) {
      bagged[b] = false;
    },
    tick(t) {
      while (clock + STEP <= Math.min(t, duration)) {
        clock += STEP;
        step(clock);
      }
      render(t);
    },
    score,
    hint: (t) => ({ hold: pumps[pumpIndex(t)].up }),
  };
};
