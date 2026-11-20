import './banevasion.css';
import { actor, clamp1000, defineSprite, h, person, pick, pulse, randBtn, randInt, setSprite, sprite, type Btn, type GameFactory, type Layer, type Mood, type Person, type Tone } from './common';

const FACES = ['grin', 'frown', 'shades', 'wink', 'gasp'];
const HUES = ['gold', 'pink', 'teal', 'ink'];
const NAMES = ['totally_new', 'not_banned', 'fresh_acct', 'who_me', 'day_one', 'honest_guy', 'reformed', 'acct_47'];
// A face is an expression; a hue is the colour of the head. The troll can't change either.
const MOOD: Record<string, Mood> = { grin: 'happy', frown: 'sad', shades: 'cool', wink: 'wink', gasp: 'shock' };

// Costumes. Everyone in the queue wears a wig or a hat (so nobody's horns show) and some
// wear glasses; the disguise is never the tell. They keep row 6 and the eye area clear so
// every expression still reads.
defineSprite('banevasion-wig', `
....kkkkkkkk....
..kkAAAAAAAAkk..
.kAALAAAAAAAAAk.
kAALAAAAAAAAAAAk
kAAAAAaAAAAaAAAk
kAakkaAkkAakkaAk
kAk..........kAk
kAk..........kAk
kak..........kak
.k............k.`);
defineSprite('banevasion-hat', `
....kkkkkkkk....
....kAAAAAAk....
....kALAAAAk....
.kkkkaaaaaakkkk.
kAAAAAAAAAAAAAAk
kkkkkkkkkkkkkkkk`);
defineSprite('banevasion-glasses', `
................
................
................
................
................
..dddddddddddd..
..d....dd....d..
ddd....dd....ddd
..d....dd....d..
..d....dd....d..
..dddddddddddd..`);
const WIGS: Tone[] = ['brown', 'purple', 'orange', 'night'];
const HATS: Tone[] = ['night', 'brown', 'red', 'blue'];
const PX = 0.3; // one art pixel in em for the queue: each head is 4.8em

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
  // Costumes are dealt after the round is laid out, so the round itself is unchanged.
  const looks: Layer[][] = pops.map(() => {
    const top: Layer = rng() < 0.5 ? { name: 'banevasion-wig', tone: pick(rng, WIGS) } : { name: 'banevasion-hat', tone: pick(rng, HATS) };
    return rng() < 0.45 ? [top, 'banevasion-glasses'] : [top];
  });
  // An alt that pops too close to the bell for its full window is a bonus, not part of the par.
  const alts = Math.max(1, pops.filter((p) => p.alt && p.at + up <= duration).length);
  const GRACE = 250; // ms after a head ducks in which a press is late, not a mistake
  let bans = 0;
  let wrong = 0;
  let calmAt = 0; // when the bouncer goes back to watching the line

  // The scene: a club door in a back alley at night. Mod Bear is the bouncer, the troll's
  // BANNED poster is taped by the door, and users queue on three coloured mats.
  const wrap = h('div', 'g-banevasion scene-alley');
  const club = h('div', 'club');
  const bear = actor('modbear', { mood: 'peep', px: 0.42 });
  bear.el.classList.add('bouncer');
  const door = h('div', 'door');
  door.append(h('div', 'neon', 'THE SUB'), h('i', 'knob'));
  const poster = h('div', 'poster');
  const mug = person({ tone: troll.hue as Tone, mood: MOOD[troll.face], hat: 'horns', px: 0.2 });
  poster.append(h('b', '', 'BANNED'), mug.el);
  club.append(bear.el, door, poster);

  const queue = h('div', 'queue');
  const spots = (['red', 'green', 'blue'] as const).map((c) => {
    const spot = h('div', `spot c-${c}`);
    const who = h('div', 'who');
    const face: Person = person({ tone: 'gold', px: PX });
    const costume = sprite('banevasion-wig', { px: PX }, 'costume');
    who.append(face.el, costume);
    const tag = h('span', 'tag');
    spot.append(who, tag, h('i', 'mat'));
    queue.append(spot);
    return { spot, who, face, costume, tag, cls: `spot c-${c}`, pop: -1, booted: false };
  });
  const note = h('div', 'note', '0 alts banned');
  wrap.append(club, queue, note);
  root.append(wrap);

  const active = (t: number, hole: Btn) => pops.findIndex((p) => !p.done && p.hole === hole && t >= p.at && t < p.at + up);

  return {
    press(b, t) {
      const s = spots[b];
      const i = active(t, b);
      if (i < 0) {
        // A beat too slow loses the ban but is not also fined (once per head).
        const late = pops.find((p) => !p.done && p.hole === b && t >= p.at + up && t < p.at + up + GRACE);
        if (late) late.done = true;
        else wrong++;
        pulse(bear.el, 'shake');
        bad(s.spot, late ? 'TOO LATE' : 'NOBODY!');
        return;
      }
      const p = pops[i];
      p.done = true;
      // Whoever was banned gets booted off the line.
      s.booted = true;
      bear.mood('angry');
      calmAt = t + 350;
      if (p.alt) {
        bans++;
        s.face.mood('dead');
        good(s.who, 'BANNED');
        fx.burst(s.who, 'red', 12);
        fx.poof(s.spot);
        fx.sound('thud');
        note.textContent = `${bans} alt${bans === 1 ? '' : 's'} banned`;
      } else {
        wrong++;
        s.face.mood('sad');
        pulse(bear.el, 'shake');
        bad(s.who, 'REGULAR!');
      }
    },
    tick(t) {
      if (calmAt && t >= calmAt) {
        calmAt = 0;
        bear.mood('peep');
      }
      spots.forEach((s, i) => {
        const j = active(t, i as Btn);
        if (j === s.pop) return;
        s.pop = j;
        if (j >= 0) {
          const p = pops[j];
          s.face.tone(p.hue as Tone);
          s.face.mood(MOOD[p.face]);
          setSprite(s.costume, looks[j], { px: PX });
          s.tag.textContent = `u/${p.name}`;
          s.spot.className = `${s.cls} up`;
        } else {
          // Banned: booted off the line. Otherwise they walk on into the club.
          s.spot.className = `${s.cls} ${s.booted ? 'boot' : 'walk'}`;
          s.booted = false;
        }
      });
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
