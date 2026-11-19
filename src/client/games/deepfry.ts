import './deepfry.css';
import { COLOR, h, person, pick, pulse, randBtn, randInt, ratio, setSprite, shuffled, sprite, type Btn, type GameFactory, type Mood, type Tone } from './common';

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
// Who gets fried: one colour per sunburst (h0-h3 in the css), three head shapes, five calm faces.
const BLOBS: Tone[] = ['gold', 'pink', 'teal', 'blue'];
const KINDS = ['plain', 'cat', 'bear'] as const;
const MOODS: Mood[] = ['idle', 'happy', 'wink', 'cool', 'sleep'];
const DIALS = ['COLOUR', 'CRUNCH', 'GLOW'];
const FRY = ['--sat', '--crunch', '--glow'];
const STAMPS = ['CRISPY!', 'WELL DONE!', 'NUKED!', 'TOASTY!', 'CHARRED!', 'GOLDEN!'];
const BTNS: Btn[] = [0, 1, 2];
const FACE = 0.42; // one pixel of the face, in em
const FLAME = 0.24;

export const create: GameFactory = ({ root, rng, level, duration, good, fx }) => {
  // Every meme has one hungry dial; the other two share as many notches again.
  const big = 8 + level;
  // Mashing all three lands about two useful notches a slap, so the par is counted in slaps:
  // 6.5 a second in round one, just under 8 in round five (the edge of what hands can do).
  const par = Math.round((duration / 1000) * 2 * (6.5 + level * 0.35));
  let hungry = randBtn(rng);
  let hue = randInt(rng, 0, 3);
  const memes = shuffled(rng, CAPTIONS).map(([top, bottom]) => {
    // Never the same hungry dial or the same colours twice running.
    hungry = ((hungry + randInt(rng, 1, 2)) % 3) as Btn;
    hue = (hue + randInt(rng, 1, 3)) % 4;
    const small = randInt(rng, 2, big - 2);
    const need = [small, big - small];
    need.splice(hungry, 0, big);
    return { top, bottom, need, hue, kind: pick(rng, KINDS), mood: pick(rng, MOODS) };
  });
  let idx = 0;
  let fill = [0, 0, 0];
  let banked = 0;
  let lastGood = -1000;
  let ghost: HTMLElement | null = null;
  let flick = -1;

  // The scene: a meme sizzling over the burner of a deep fryer, and the fryer's three dials.
  const wrap = h('div', 'g-deepfry scene-dusk');
  const frame = h('div', 'frame');
  const meme = h('div', 'meme');
  const top = h('span', 'cap');
  const face = h('div', 'face');
  const bottom = h('span', 'cap');
  meme.append(top, face, bottom, h('i', 'grain'));
  frame.append(meme);
  const fire = h('div', 'fire');
  const flames = [0, 1, 2, 3, 4].map(() => sprite('flame1', { px: FLAME }, 'flame'));
  fire.append(...flames);
  const fryer = h('div', 'fryer');
  const readout = h('div', 'readout', 'CRANK ALL THREE DIALS!');
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
  fryer.append(readout, row);
  wrap.append(frame, fire, fryer);
  root.append(wrap);

  const now = () => memes[idx % memes.length];
  let blob = person({ px: FACE });

  function paint() {
    const p = BTNS.map((b) => fill[b] / now().need[b]);
    const heat = (p[0] + p[1] + p[2]) / 3;
    FRY.forEach((v, b) => meme.style.setProperty(v, String(p[b])));
    meme.style.setProperty('--heat', String(heat));
    fire.style.setProperty('--heat', String(heat));
    // The face notices what is happening to it.
    blob.mood(heat >= 0.3 ? 'shock' : now().mood);
    dials.forEach((d, b) => {
      d.knob.style.setProperty('--p', String(p[b]));
      d.knob.style.setProperty('--n', String(now().need[b]));
      d.dial.classList.toggle('max', p[b] >= 1);
      d.name.textContent = p[b] >= 1 ? 'MAX!' : DIALS[b];
    });
  }

  function serve() {
    const m = now();
    meme.className = `meme h${m.hue}`;
    blob = person({ tone: BLOBS[m.hue], kind: m.kind, mood: m.mood, px: FACE });
    // A lens flare waits on each eye for the GLOW dial.
    face.replaceChildren(blob.el, h('i', 'flare l'), h('i', 'flare r'));
    top.textContent = m.top;
    bottom.textContent = m.bottom;
    paint();
  }
  serve();

  // The fried meme lingers as a stamped ghost while the next one is already on the burner.
  function crisp() {
    banked += 2 * big;
    blob.mood('dead');
    ghost?.remove();
    ghost = meme.cloneNode(true) as HTMLElement;
    ghost.classList.add('ghost');
    ghost.append(h('b', 'stamp', STAMPS[idx % STAMPS.length]));
    frame.append(ghost);
    idx++;
    fill = [0, 0, 0];
    serve();
    readout.textContent = `MEMES FRIED: ${idx}`;
    pulse(readout, 'ding');
    fx.flash('white');
    fx.poof(fire);
    fx.burst(frame, 'gold', 26);
    fx.sound('power');
  }

  return {
    press(b, t) {
      const { need } = now();
      const { knob, name } = dials[b];
      // A maxed dial has nothing more to give: its label hops and the hungry dials flash for attention.
      if (fill[b] >= need[b]) {
        pulse(name, 'bump');
        fx.sound('tick');
        dials.forEach((d, x) => {
          if (fill[x] < need[x]) pulse(d.dial, 'want');
        });
        return;
      }
      fill[b]++;
      paint();
      pulse(knob, 'crank');
      // Three fingers land together, so the combo counts slaps rather than notches.
      if (t - lastGood >= 120) {
        lastGood = t;
        good(knob);
      }
      if (fill[b] < need[b]) return;
      fx.burst(knob, COLOR[b], 12);
      fx.sound('zap');
      if (BTNS.every((x) => fill[x] >= need[x])) crisp();
    },
    tick(t) {
      // The burner flickers between its two flame frames.
      const f = Math.floor(t / 110) % 2;
      if (f === flick) return;
      flick = f;
      flames.forEach((el, i) => setSprite(el, (i + f) % 2 ? 'flame2' : 'flame1', { px: FLAME }));
    },
    score: () => ratio(banked + fill[0] + fill[1] + fill[2], par),
    hint: () => BTNS.filter((b) => fill[b] < now().need[b]),
  };
};
