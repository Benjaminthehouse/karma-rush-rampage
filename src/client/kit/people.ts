// Characters: a face stacked from sprite layers, with moods that can change on the fly.
import './sprites';
import { setSprite, sprite, type Layer, type Tone } from './px';

export type Mood = 'idle' | 'happy' | 'shock' | 'angry' | 'sleep' | 'sad' | 'cool' | 'wink' | 'dead';

const FACE: Record<Mood, { eyes: string; ey: number; mouth: string; blush?: boolean }> = {
  idle: { eyes: 'eyes-open', ey: 7, mouth: 'mouth-smile' },
  happy: { eyes: 'eyes-happy', ey: 7, mouth: 'mouth-open', blush: true },
  shock: { eyes: 'eyes-shock', ey: 6, mouth: 'mouth-o' },
  angry: { eyes: 'eyes-angry', ey: 6, mouth: 'mouth-grit' },
  sleep: { eyes: 'eyes-sleep', ey: 7, mouth: 'mouth-flat' },
  sad: { eyes: 'eyes-open', ey: 7, mouth: 'mouth-frown' },
  cool: { eyes: 'eyes-cool', ey: 7, mouth: 'mouth-smile' },
  wink: { eyes: 'eyes-wink', ey: 7, mouth: 'mouth-smile', blush: true },
  dead: { eyes: 'eyes-dead', ey: 7, mouth: 'mouth-frown' },
};

export type PersonOpts = {
  tone?: Tone;
  /** `cat` and `bear` add ears; `bot` is a square robot head. */
  kind?: 'plain' | 'cat' | 'bear' | 'bot';
  /** `mod` is the green moderator cap, `horns` a troll, `crown` a winner. */
  hat?: 'mod' | 'horns' | 'crown';
  mood?: Mood;
  /** Size of one pixel in em. The face is 16 pixels square; default 0.25 gives 4em. */
  px?: number;
};

function layers(o: PersonOpts, mood: Mood): Layer[] {
  const f = FACE[mood];
  const out: Layer[] = [];
  if (o.kind === 'cat') out.push('ears-cat');
  if (o.kind === 'bear') out.push('ears-bear');
  out.push(o.kind === 'bot' ? 'headbot' : 'head');
  if (f.blush) out.push({ name: 'blush', y: 10 });
  out.push({ name: f.eyes, y: f.ey }, { name: f.mouth, y: 11 });
  if (o.hat === 'mod') out.push({ name: 'hat-mod', y: 1 });
  if (o.hat === 'horns') out.push('hat-horns');
  if (o.hat === 'crown') out.push('hat-crown');
  return out;
}

export type Person = { el: HTMLElement; mood(m: Mood): void; tone(t: Tone): void };

/** A character face. Change its expression with `.mood('happy')` as things happen. */
export function person(opts: PersonOpts = {}): Person {
  const o = { tone: 'gold' as Tone, mood: 'idle' as Mood, ...opts };
  let mood = o.mood;
  const el = sprite(layers(o, mood), { tone: o.tone, px: o.px }, 'person');
  const paint = () => setSprite(el, layers(o, mood), { tone: o.tone, px: o.px });
  return {
    el,
    mood(m) {
      if (m === mood) return;
      mood = m;
      paint();
    },
    tone(t) {
      o.tone = t;
      paint();
    },
  };
}
