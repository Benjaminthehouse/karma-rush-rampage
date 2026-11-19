// The contract every mini-game implements, plus small DOM helpers.
//
// A game is three files named after its id:
//   src/shared/games/<id>.ts   default-exports its GameMeta (title, shout, labels, duration...)
//   src/client/games/<id>.ts   exports `create: GameFactory`
//   src/client/games/<id>.css  styles, every selector scoped under `.g-<id>`
//
// Rules a game must follow (tools/game-check.mjs enforces them):
// - All randomness comes from `ctx.rng`, so every player gets the same round.
// - All time comes from the `t` passed to press/release/tick (ms since the round
//   started). No timers, no Date, no requestAnimationFrame; animate with CSS.
// - Render only inside `ctx.root`. Size things in `em` so they scale with the stage.
// - `score()` is an integer 0..1000 at any moment. Doing nothing scores about 0.

export type Btn = 0 | 1 | 2;
export const COLOR = ['red', 'green', 'blue'] as const;
export const COLOR_NAME = ['RED', 'GREEN', 'BLUE'] as const;

export type FxColor = 'red' | 'green' | 'blue' | 'gold' | 'white' | 'purple';
export type SoundName = 'pop' | 'coin' | 'zap' | 'whoosh' | 'thud' | 'tick' | 'power' | 'laser' | 'ding' | 'boing';

export type GameCtx = {
  /** Empty stage element the game renders into. Give your wrapper the class `g-<id>`. */
  root: HTMLElement;
  rng: () => number;
  /** 0 for the first round of a run up to 4 for the last: later rounds are harder. */
  level: number;
  /** Round length in ms (your meta's `duration`). */
  duration: number;
  /** Live button state, for hold and chord mechanics. */
  down: readonly boolean[];
  /**
   * A correct action. Plays the rising combo sound, grows the combo meter and
   * bursts sparks from `at` (or the stage centre); floats `text` if given.
   * Call it once per scored unit, at most about eight times a second.
   */
  good(at?: Element | null, text?: string): void;
  /** A mistake: buzz, shake, combo reset. Floats `text` from `at` if given. */
  bad(at?: Element | null, text?: string): void;
  /** Extra juice beyond good/bad. All of it is safe to call at any rate. */
  fx: {
    burst(at: Element | null, color?: FxColor, count?: number): void;
    /** Floating text that rises from `at` and fades, e.g. "+1" or "BANNED". */
    pop(at: Element | null, text: string, color?: FxColor): void;
    /** A puff of pixel smoke under anything that jumps, lands, pops or vanishes. */
    poof(at: Element | null): void;
    /** Brief coloured wash over the whole arena. Use for big moments only. */
    flash(color?: FxColor): void;
    shake(): void;
    sound(name: SoundName): void;
  };
};

/**
 * What a perfect player would do right now. Used by the automated play-tester
 * and demos, never for scoring.
 *   null            wait
 *   Btn             tap this button now
 *   Btn[]           tap these together (a chord)
 *   { hold: Btn[] } exactly these buttons should be held down right now
 */
export type Hint = null | Btn | Btn[] | { hold: Btn[] };

export type GameInst = {
  /** `t` is ms since the round started. */
  press(b: Btn, t: number): void;
  release?(b: Btn, t: number): void;
  /** Called every animation frame with the current `t`. */
  tick(t: number): void;
  /** Integer 0..1000, valid at any moment. */
  score(): number;
  hint(t: number): Hint;
};

export type GameFactory = (ctx: GameCtx) => GameInst;

// The pixel-art kit: sprites, characters and forum furniture. See GAME_GUIDE.md.
export { TONES, defineSprite, hasSprite, setSprite, sprite, type Layer, type SpriteOpts, type Tone } from '../kit/px';
export { person, type Mood, type Person, type PersonOpts } from '../kit/people';
export { comment, postCard, type PostCard } from '../kit/ui';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

export const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const randBtn = (rng: () => number): Btn => Math.floor(rng() * 3) as Btn;
export const randInt = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PULSES = ['pop-in', 'shake', 'bump'];

/**
 * Plays a one-shot animation class on an element (`pop-in`, `shake`, `bump` are
 * global). Any earlier one-shot is cleared first, so the new one always plays.
 */
export function pulse(el: HTMLElement, cls: string) {
  el.classList.remove(cls, ...PULSES);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Deals items in shuffled order and reshuffles when the pile runs out, so
 * nothing comes up twice in a row. Use it for titles, names and prompts.
 */
export function dealer<T>(rng: () => number, items: readonly T[]): () => T {
  let pile: T[] = [];
  let last: T | undefined;
  return () => {
    if (!pile.length) {
      pile = shuffled(rng, items);
      if (pile.length > 1 && pile[pile.length - 1] === last) pile.unshift(pile.pop()!);
    }
    last = pile.pop()!;
    return last;
  };
}

/**
 * Three small squares with one lit: which pad (left, middle, right) a colour
 * means. Put it beside any cue where colour alone tells the player what to
 * press, so the game also works for players who cannot tell red from green.
 */
export function padDots(b: Btn): HTMLElement {
  const el = h('span', 'pad-dots');
  for (let i = 0; i < 3; i++) el.append(h('i', i === b ? `on c-${COLOR[b]}` : ''));
  return el;
}

/** Vote arrow. Colour comes from CSS `color`; size from `font-size` (2.4em square by default). */
export function arrow(dir: 'up' | 'down', cls = ''): HTMLElement {
  const el = h('span', `arrow ${dir} ${cls}`);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2.5 12.500H8V22h8v-9.500h5.500z" fill="currentColor" stroke="#0b1020" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  return el;
}

/** 0..1000 from a fraction, clamped and rounded. */
export const ratio = (n: number, d: number) => Math.round(1000 * Math.max(0, Math.min(1, d > 0 ? n / d : 0)));
/** Clamp any number to an integer 0..1000. */
export const clamp1000 = (n: number) => Math.max(0, Math.min(1000, Math.round(Number.isFinite(n) ? n : 0)));
