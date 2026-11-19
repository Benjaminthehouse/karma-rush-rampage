export type Btn = 0 | 1 | 2;
export const COLOR = ['red', 'green', 'blue'] as const;
export const COLOR_NAME = ['RED', 'GREEN', 'BLUE'] as const;

export type GameCtx = {
  /** Empty stage element the game renders into. */
  root: HTMLElement;
  rng: () => number;
  /** 0 for the first round of a run up to 4 for the last: later rounds are harder. */
  level: number;
  duration: number;
  good(): void;
  bad(): void;
};

export type GameInst = {
  /** `t` is ms since the round started. */
  press(b: Btn, t: number): void;
  tick(t: number): void;
  /** 0..1000 */
  score(): number;
};

export type GameFactory = (ctx: GameCtx) => GameInst;

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

export function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Restarts a CSS animation class on an element. */
export function pulse(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Vote arrow drawn in CSS-coloured SVG. */
export function arrow(dir: 'up' | 'down', cls = ''): HTMLElement {
  const el = h('span', `arrow ${dir} ${cls}`);
  el.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 2.5 12.5H8V22h8v-9.500h5.5z" fill="currentColor" stroke="#0b1020" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  return el;
}

export const ratio = (n: number, d: number) => Math.round(1000 * Math.max(0, Math.min(1, n / d)));
