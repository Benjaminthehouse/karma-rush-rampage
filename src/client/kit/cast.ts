// The recurring cast. Every game draws its characters through `actor()`, so a character
// redrawn here (or swapped for hand-drawn art in ./art) changes in every game at once.
//
//   modbear  the mods: judge, bouncer, desk officer         (hand-drawn: sleep, peep, angry)
//   automod  grey screen-faced robot: rules, orders, bots
//   troll    green and horned: impostors, alts, sarcasm, rug pulls
//   op       the poster, a cat: wants upvotes and first comments
//   dev      hoodie and dark circles: servers, deploys, vibecoding
//   ape      diamond hands: stonks, rug pulls, the moon
//   npc      identical grey default people: crowds, voters, extras
//   lurker   hooded, glowing eyes: watches, remembers, spots reposts
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

/** The hand-drawn Mod Bear moods, and which one stands in for the moods not yet drawn. */
const BEAR_MOOD: Record<ActorMood, 'sleep' | 'peep' | 'angry'> = {
  idle: 'peep', peep: 'peep', talk: 'peep', happy: 'sleep', cool: 'sleep', wink: 'peep',
  shock: 'angry', angry: 'angry', dead: 'angry', sad: 'peep', sleep: 'sleep',
};

/** The placeholder faces for the rest of the cast, until they are drawn. */
const FACES: Record<Exclude<Who, 'modbear' | 'automod'>, Parameters<typeof person>[0]> = {
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
  if (who === 'modbear') {
    // Hand-drawn: three SVG drawings stacked, one shown.
    const el = document.createElement('div');
    el.className = `px actor modbear ${BEAR_MOOD[mood]}`;
    el.style.width = `${16 * px}em`;
    for (const m of ['sleep', 'peep', 'angry']) el.append(Object.assign(document.createElement('i'), { className: m }));
    return {
      el,
      who,
      mood(m) {
        if (m === mood) return;
        mood = m;
        el.className = `px actor modbear ${BEAR_MOOD[m]}`;
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
