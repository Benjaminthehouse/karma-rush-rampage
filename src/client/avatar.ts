// A player's face, wherever players are shown: the race track, standings, leaderboards.
// Real players show their Reddit avatar when they have one; everyone else (and the house
// bots) gets a pixel face that is always the same for the same name.
import { hashStr } from '../shared/daily';
import { person } from './kit/people';

const TONES = ['gold', 'orange', 'pink', 'teal', 'purple', 'green', 'blue', 'red', 'ink'] as const;
const KINDS = ['plain', 'cat', 'bear'] as const;

/** A square avatar, 1em on a side: size it with `font-size`. */
export function avatar(name: string, o: { url?: string; bot?: boolean } = {}): HTMLElement {
  const el = document.createElement('span');
  el.className = `av${o.bot ? ' bot' : ''}`;
  const seed = hashStr(name);
  const face = person(
    o.bot
      ? { tone: 'grey', kind: 'bot', px: 1 / 16 }
      : { tone: TONES[seed % TONES.length], kind: KINDS[(seed >>> 4) % KINDS.length], px: 1 / 16 }
  );
  el.append(face.el);
  if (o.url) {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    // If the picture cannot be loaded here, the pixel face underneath simply stays.
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = o.url;
    el.append(img);
  }
  return el;
}

/** A Reddit name without its prefix, cut to fit under a marker. */
export const shortName = (name: string, max = 9) => {
  const n = name.replace(/^u\//, '');
  return n.length > max ? `${n.slice(0, max - 1)}…` : n;
};
