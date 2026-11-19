import './banevasion.css';
import { clamp1000, h, pick, randBtn, randInt, type Btn, type GameFactory } from './common';

const FACES = ['grin', 'frown', 'shades', 'wink', 'gasp'];
const HUES = ['gold', 'pink', 'teal', 'ink'];
const NAMES = ['totally_new', 'not_banned', 'fresh_acct', 'who_me', 'day_one', 'honest_guy', 'reformed', 'acct_47'];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const troll = { face: pick(rng, FACES), hue: pick(rng, HUES) };
  const up = 900 - level * 80; // ms a head stays up
  const pops: { at: number; hole: Btn; alt: boolean; face: string; hue: string; name: string; done: boolean }[] = [];
  let at = 500;
  let lastHole = -1;
  while (at + 300 < duration) {
    let hole = randBtn(rng);
    while (hole === lastHole) hole = randBtn(rng);
    lastHole = hole;
    const alt = rng() < 0.62;
    let face = troll.face;
    let hue = troll.hue;
    if (!alt) {
      // A regular differs in face, in colour, or (early on) in both.
      const both = rng() < 0.5 - level * 0.1;
      if (both || rng() < 0.5) face = pick(rng, FACES.filter((f) => f !== troll.face));
      if (both || face === troll.face) hue = pick(rng, HUES.filter((x) => x !== troll.hue));
    }
    pops.push({ at, hole, alt, face, hue, name: pick(rng, NAMES), done: false });
    at += randInt(rng, 560, 760) - level * 55;
  }
  const alts = Math.max(1, pops.filter((p) => p.alt).length);
  let bans = 0;
  let wrong = 0;

  const wrap = h('div', 'g-banevasion');
  const wanted = h('div', 'wanted');
  wanted.append(h('span', '', 'BANNED:'), h('i', `head ${troll.face} ${troll.hue}`));
  const row = h('div', 'row');
  const holes = [0, 1, 2].map(() => {
    const hole = h('div', 'hole');
    const head = h('i', 'head');
    const tag = h('span', 'tag');
    hole.append(head, tag);
    row.append(hole);
    return { hole, head, tag, pop: -1 };
  });
  const note = h('div', 'g-note');
  wrap.append(wanted, row, note);
  root.append(wrap);

  const active = (t: number, hole: Btn) => pops.findIndex((p) => !p.done && p.hole === hole && t >= p.at && t < p.at + up);

  return {
    press(b, t) {
      const i = active(t, b);
      if (i < 0) {
        wrong++;
        bad(holes[b].hole, 'NOBODY THERE');
        return;
      }
      const p = pops[i];
      p.done = true;
      if (p.alt) {
        bans++;
        good(holes[b].head, 'BANNED');
        fx.burst(holes[b].head, 'red', 12);
        fx.sound('thud');
      } else {
        wrong++;
        bad(holes[b].head, 'THAT WAS A REGULAR');
      }
    },
    tick(t) {
      holes.forEach((hole, i) => {
        const j = active(t, i as Btn);
        if (j === hole.pop) return;
        hole.pop = j;
        hole.hole.classList.toggle('up', j >= 0);
        if (j >= 0) {
          hole.head.className = `head ${pops[j].face} ${pops[j].hue}`;
          hole.tag.textContent = `u/${pops[j].name}`;
        }
      });
      note.textContent = `${bans} alts banned`;
    },
    score: () => clamp1000((1000 * (bans - wrong)) / alts),
    hint(t) {
      for (const b of [0, 1, 2] as Btn[]) {
        const i = active(t, b);
        if (i >= 0 && pops[i].alt) return b;
      }
      return null;
    },
  };
};
