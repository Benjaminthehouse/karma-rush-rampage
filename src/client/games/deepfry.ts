import './deepfry.css';
import { COLOR, h, pick, pulse, randBtn, randInt, ratio, shuffled, type Btn, type GameFactory } from './common';

// [top text, bottom text]
const CAPTIONS = [
  ['TOP TEXT', 'BOTTOM TEXT'],
  ['NEEDS MORE', 'JPEG'],
  ['NOBODY:', 'ME AT 3 AM:'],
  ['WHEN THE WIFI', 'COMES BACK'],
  ['POSTS MEME', 'GETS 2 UPVOTES'],
  ['EDIT: WOW', 'THANKS FOR GOLD'],
  ['SORT BY NEW', 'INSTANT REGRET'],
  ['SCREENSHOT OF', 'A SCREENSHOT'],
  ['MODS ASLEEP', 'POST BLOBS'],
  ['ONE BRAIN CELL', 'USED IT TO POST'],
  ['FRESH MEME', 'DO NOT STEAL'],
  ['240P', 'AND PROUD'],
];
const FACES = ['grin', 'gasp', 'smug', 'flat'];
const DIALS = ['COLOUR', 'CRUNCH', 'GLOW'];
const FRY = ['--sat', '--crunch', '--glow'];
const STAMPS = ['CRISPY!', 'WELL DONE!', 'NUKED!', 'TOASTY!', 'CHARRED!', 'GOLDEN!'];
const BTNS: Btn[] = [0, 1, 2];

export const create: GameFactory = ({ root, rng, level, duration, good, fx }) => {
  // Every meme has one hungry dial; the other two share as many notches again.
  const big = 8 + level;
  // Mashing all three lands about two useful notches a slap, so the par is counted in slaps.
  const par = Math.round((duration / 1000) * 2 * (6.5 + level * 0.5));
  let hungry = randBtn(rng);
  const memes = shuffled(rng, CAPTIONS).map(([top, bottom], i) => {
    hungry = ((hungry + randInt(rng, 1, 2)) % 3) as Btn;
    const small = randInt(rng, 2, big - 2);
    const rest = [small, big - small];
    return { top, bottom, face: pick(rng, FACES), hue: i % 4, need: BTNS.map((b) => (b === hungry ? big : rest.pop()!)) };
  });
  let idx = 0;
  let fill = [0, 0, 0];
  let banked = 0;
  let lastGood = -1000;
  let ghost: HTMLElement | null = null;

  const wrap = h('div', 'g-deepfry');
  const frame = h('div', 'frame');
  const meme = h('div', 'meme');
  const top = h('span', 'cap');
  const blob = h('i', 'blob');
  blob.append(h('i', 'eye'), h('i', 'eye'), h('i', 'mouth'));
  const bottom = h('span', 'cap');
  meme.append(top, blob, bottom, h('i', 'grain'));
  frame.append(meme);
  const row = h('div', 'dials');
  const dials = BTNS.map((b) => {
    const dial = h('div', `dial c-${COLOR[b]}`);
    const knob = h('div', 'knob');
    knob.append(h('i'));
    const name = h('span', 'name');
    dial.append(knob, name);
    row.append(dial);
    return { dial, knob, name };
  });
  const note = h('div', 'g-note', 'Crank all three dials!');
  wrap.append(frame, row, note);
  root.append(wrap);

  const now = () => memes[idx % memes.length];

  function paint() {
    const p = BTNS.map((b) => fill[b] / now().need[b]);
    FRY.forEach((v, b) => meme.style.setProperty(v, String(p[b])));
    meme.style.setProperty('--heat', String((p[0] + p[1] + p[2]) / 3));
    dials.forEach((d, b) => {
      d.knob.style.setProperty('--p', String(p[b]));
      d.knob.style.setProperty('--n', String(now().need[b]));
      d.dial.classList.toggle('max', p[b] >= 1);
      d.name.textContent = p[b] >= 1 ? 'MAX!' : DIALS[b];
    });
  }

  function serve() {
    const m = now();
    meme.className = `meme ${m.face} h${m.hue}`;
    top.textContent = m.top;
    bottom.textContent = m.bottom;
    paint();
  }
  serve();

  // The fried meme lingers as a stamped ghost while the next one is already on the plate.
  function crisp() {
    banked += now().need.reduce((a, n) => a + n, 0);
    ghost?.remove();
    ghost = meme.cloneNode(true) as HTMLElement;
    ghost.classList.add('ghost');
    ghost.append(h('b', 'stamp', STAMPS[idx % STAMPS.length]));
    frame.append(ghost);
    idx++;
    fill = [0, 0, 0];
    serve();
    note.textContent = `${idx} meme${idx === 1 ? '' : 's'} fried`;
    fx.flash('white');
    fx.burst(frame, 'gold', 26);
    fx.sound('power');
  }

  return {
    press(b, t) {
      const { need } = now();
      const { knob, name } = dials[b];
      // A maxed dial has nothing more to give: its label just hops.
      if (fill[b] >= need[b]) {
        pulse(name, 'bump');
        fx.sound('tick');
        return;
      }
      fill[b]++;
      paint();
      pulse(knob, 'crank');
      // Three fingers land together, so the combo counts slaps rather than notches.
      if (t - lastGood >= 100) {
        lastGood = t;
        good(knob);
      }
      if (fill[b] < need[b]) return;
      fx.burst(knob, COLOR[b], 12);
      fx.sound('zap');
      if (BTNS.every((x) => fill[x] >= need[x])) crisp();
    },
    tick() {},
    score: () => ratio(banked + fill[0] + fill[1] + fill[2], par),
    hint: () => BTNS.filter((b) => fill[b] < now().need[b]),
  };
};
