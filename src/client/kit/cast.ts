// The recurring cast. Every game draws its characters through `actor()`, so a character
// redrawn here (or swapped for hand-drawn art in ./art) changes in every game at once.
//
//   modbear  the mods: judge, bouncer, desk officer                (drawn)
//   automod  grey screen-faced robot: rules, orders, bots         (drawn)
//   troll    green and horned: impostors, alts, sarcasm, rug pulls (drawn)
//   op       the poster, a cat: wants upvotes and first comments   (drawn: seven faces, ./art/op-*.png)
//   dev      hoodie and dark circles: servers, deploys, vibecoding (drawn)
//   ape      diamond hands: stonks, rug pulls, the moon            (drawn)
//   npc      identical grey default people: crowds, voters, extras (drawn)
//   lurker   hooded, glowing eyes: watches, remembers, spots reposts (drawn)
import './sprites';
import { person, type Mood } from './people';
import { defineSprite, setSprite, sprite } from './px';

export type Who = 'modbear' | 'automod' | 'troll' | 'op' | 'dev' | 'ape' | 'npc' | 'lurker';
/** Every actor takes every mood; one without its own drawing for a mood uses its nearest. */
export type ActorMood = Mood | 'talk' | 'peep';
export type Actor = { el: HTMLElement; who: Who; mood(m: ActorMood): void };

// AutoMod: the robot. Its screen face shows the mood.
const BOT_TOP = ['.......kk.......', '.......ky.......', '......kkkk......', '..kkkkkkkkkkkk..', '.kddddddddddddk.', '.kdkkkkkkkkkkdk.'];
const BOT_BOTTOM = ['.kDddddddddddDk.', '..kkkkkkkkkkkk..', '..kDDDkggkDDDk..', '..kDDkggggkDDk..', '..kkkkkkkkkkkk..'];
const BOT_FACE: Record<string, string[]> = {
  idle: ['.kdkcckkkkcckdk.', '.kdkcckkkkcckdk.', '.kdkkkkkkkkkkdk.', '.kdkkkcccckkkdk.', '.kdkkkkkkkkkkdk.'],
  talk: ['.kdkcckkkkcckdk.', '.kdkcckkkkcckdk.', '.kdkkkkkkkkkkdk.', '.kdkkcwwwwckkdk.', '.kdkkcccccckkdk.'],
  happy: ['.kdkkckkkkckkdk.', '.kdkckckkckckdk.', '.kdkkkkkkkkkkdk.', '.kdkkcckkcckkdk.', '.kdkkkcccckkkdk.'],
  angry: ['.kdkrrkkkkrrkdk.', '.kdkkrrkkrrkkdk.', '.kdkkkkkkkkkkdk.', '.kdkkrrrrrrkkdk.', '.kdkkkkkkkkkkdk.'],
  shock: ['.kdkcckkkkcckdk.', '.kdkcckkkkcckdk.', '.kdkkkkkkkkkkdk.', '.kdkkkkcckkkkdk.', '.kdkkkkcckkkkdk.'],
  sad: ['.kdkcckkkkcckdk.', '.kdkkkkkkkkkkdk.', '.kdkkkkkkkkkkdk.', '.kdkkkcccckkkdk.', '.kdkkckkkkckkdk.'],
  sleep: ['.kdkkkkkkkkkkdk.', '.kdkcckkkkcckdk.', '.kdkkkkkkkkkkdk.', '.kdkkkkcckkkkdk.', '.kdkkkkkkkkkkdk.'],
};
for (const [m, face] of Object.entries(BOT_FACE)) defineSprite(`cast-automod-${m}`, [...BOT_TOP, ...face, ...BOT_BOTTOM]);
const BOT_MOOD: Partial<Record<ActorMood, string>> = { talk: 'talk', happy: 'happy', cool: 'happy', wink: 'happy', angry: 'angry', dead: 'angry', shock: 'shock', sad: 'sad', sleep: 'sleep' };

/**
 * Cast members with drawn pixel art: one PNG per face in ./art (`<who>-<face>.png`, all the
 * same size), and which face stands in for each mood. The faces are stacked and one is
 * shown (see `.actor.drawn` in kit.css).
 */
const DRAWN: Partial<Record<Who, { w: number; h: number; faces: string[]; mood: Record<ActorMood, string> }>> = {
  modbear: {
    w: 41,
    h: 44,
    faces: ['idle', 'peep', 'happy', 'angry', 'shock', 'sleep'],
    mood: { idle: 'idle', talk: 'idle', sad: 'idle', peep: 'peep', wink: 'peep', happy: 'happy', cool: 'happy', angry: 'angry', dead: 'angry', shock: 'shock', sleep: 'sleep' },
  },
  op: {
    w: 41,
    h: 39,
    faces: ['idle', 'happy', 'wink', 'calm', 'sad', 'shock', 'angry'],
    mood: { idle: 'idle', peep: 'idle', talk: 'happy', happy: 'happy', cool: 'wink', wink: 'wink', sleep: 'calm', sad: 'sad', dead: 'sad', shock: 'shock', angry: 'angry' },
  },  troll: {
    w: 45,
    h: 43,
    faces: ['idle', 'happy', 'angry', 'shock', 'sad'],
    mood: { idle: 'idle', peep: 'idle', wink: 'idle', cool: 'idle', talk: 'happy', happy: 'happy', angry: 'angry', shock: 'shock', sad: 'sad', dead: 'sad', sleep: 'sad' },
  },
  dev: {
    w: 43,
    h: 45,
    faces: ['idle', 'happy', 'shock', 'sad'],
    mood: { idle: 'idle', peep: 'idle', sleep: 'idle', talk: 'happy', happy: 'happy', cool: 'happy', wink: 'happy', shock: 'shock', angry: 'shock', sad: 'sad', dead: 'sad' },
  },
  ape: {
    w: 45,
    h: 37,
    faces: ['idle', 'cool', 'happy', 'sad'],
    mood: { idle: 'idle', peep: 'idle', sleep: 'idle', cool: 'cool', wink: 'cool', talk: 'happy', happy: 'happy', sad: 'sad', dead: 'sad', shock: 'sad', angry: 'sad' },
  },
  lurker: {
    w: 44,
    h: 40,
    faces: ['idle', 'peep', 'shock', 'happy'],
    mood: { idle: 'idle', talk: 'idle', peep: 'peep', angry: 'peep', sad: 'peep', dead: 'peep', sleep: 'peep', cool: 'happy', happy: 'happy', wink: 'happy', shock: 'shock' },
  },
  automod: {
    w: 36,
    h: 43,
    faces: ['idle', 'talk', 'angry', 'shock'],
    mood: { idle: 'idle', peep: 'idle', happy: 'idle', cool: 'idle', wink: 'idle', sleep: 'idle', talk: 'talk', angry: 'angry', dead: 'angry', sad: 'angry', shock: 'shock' },
  },
  npc: {
    w: 40,
    h: 42,
    faces: ['idle', 'happy', 'shock', 'angry', 'sleep'],
    mood: { idle: 'idle', peep: 'idle', talk: 'happy', happy: 'happy', cool: 'happy', wink: 'happy', shock: 'shock', angry: 'angry', sleep: 'sleep', sad: 'sleep', dead: 'sleep' },
  },
};

/** The placeholder faces for the rest of the cast, until they are drawn. */
const FACES: Partial<Record<Who, Parameters<typeof person>[0]>> = {
  troll: { tone: 'green', hat: 'horns' },
  op: { tone: 'gold', kind: 'cat' },
  dev: { tone: 'purple' },
  ape: { tone: 'brown', kind: 'bear' },
  npc: { tone: 'grey' },
  lurker: { tone: 'night' },
};

/**
 * A member of the cast. `px` is one art pixel in em; every actor is 16 art pixels wide,
 * so `px: 0.5` makes an 8em character. Change the expression with `.mood('happy')`.
 */
export function actor(who: Who, o: { mood?: ActorMood; px?: number } = {}): Actor {
  const px = o.px ?? 0.4;
  let mood: ActorMood = o.mood ?? 'idle';
  const drawn = DRAWN[who];
  if (drawn) {
    // Drawn pixel art: every face stacked, the current one shown. As wide as any other actor.
    const el = document.createElement('div');
    el.className = `px actor drawn ${who}`;
    el.style.width = `${16 * px}em`;
    el.style.aspectRatio = `${drawn.w} / ${drawn.h}`;
    const faces = drawn.faces.map((f) => el.appendChild(Object.assign(document.createElement('i'), { className: f })));
    const show = (m: ActorMood) => faces.forEach((f) => f.classList.toggle('on', f.classList.contains(drawn.mood[m])));
    show(mood);
    return {
      el,
      who,
      mood(m) {
        if (m === mood) return;
        mood = m;
        show(m);
      },
    };
  }
  if (who === 'automod') {
    const name = (m: ActorMood) => `cast-automod-${BOT_MOOD[m] ?? 'idle'}`;
    const el = sprite(name(mood), { px }, 'actor automod');
    return {
      el,
      who,
      mood(m) {
        if (m === mood) return;
        mood = m;
        setSprite(el, name(m), { px });
      },
    };
  }
  const face = person({ ...FACES[who], px, mood: mood === 'talk' ? 'happy' : mood === 'peep' ? 'idle' : mood });
  face.el.classList.add('actor', who);
  return {
    el: face.el,
    who,
    mood(m) {
      if (m === mood) return;
      mood = m;
      face.mood(m === 'talk' ? 'happy' : m === 'peep' ? 'idle' : m);
    },
  };
}
