// Pixel art without image files. A sprite is a grid of characters; each
// character is a colour. Grids are drawn once to a tiny canvas and shown as a
// crisp, scaled-up background, so sprites stay sharp at any stage size.

/** A colour family for the recolourable part of a sprite: [main, shade, light]. */
export const TONES = {
  red: ['#ff4b55', '#a81f2e', '#ffa3a8'],
  green: ['#2fd66f', '#128a41', '#9df5bd'],
  blue: ['#3f8cff', '#1c4fb8', '#a9cbff'],
  gold: ['#ffcf3f', '#c98a10', '#fff0a8'],
  orange: ['#ff8a3d', '#c8551a', '#ffc79e'],
  purple: ['#b14bff', '#6a22b0', '#dcabff'],
  pink: ['#ff7ac8', '#c23d8e', '#ffc4e6'],
  teal: ['#2fd6c4', '#12897c', '#a6f5ec'],
  grey: ['#a8b1d6', '#646e9c', '#dde2f5'],
  ink: ['#f4f6ff', '#b9c1e3', '#ffffff'],
  brown: ['#b0703c', '#6e3f1c', '#dba678'],
  night: ['#2c3763', '#151c33', '#4b5890'],
} as const;
export type Tone = keyof typeof TONES;

/** Fixed colours. `A` `a` `L` are the sprite's tone: main, shade, light. */
const INK: Record<string, string> = {
  k: '#0b1020', // outline
  w: '#f4f6ff',
  W: '#ffffff',
  d: '#c4cbe4',
  D: '#7c86b0',
  x: '#3a4370',
  y: '#ffcf3f',
  Y: '#fff0a8',
  o: '#ff8a3d',
  O: '#c8551a',
  r: '#ff4b55',
  R: '#a81f2e',
  g: '#2fd66f',
  G: '#128a41',
  b: '#3f8cff',
  B: '#1c4fb8',
  p: '#b14bff',
  P: '#6a22b0',
  n: '#b0703c',
  N: '#6e3f1c',
  c: '#7ee7ff',
  m: '#ff7ac8',
  s: '#ffd2a8',
  t: '#2fd6c4',
};

const GRIDS: Record<string, string[]> = {};

/** Registers a sprite. Rows may be given as one string with newlines. */
export function defineSprite(name: string, art: string | string[]) {
  const rows = (Array.isArray(art) ? art : art.split('\n')).map((r) => r.trim()).filter(Boolean);
  const w = Math.max(...rows.map((r) => r.length));
  GRIDS[name] = rows.map((r) => r.padEnd(w, '.'));
}

export const hasSprite = (name: string) => name in GRIDS;

export type Layer = string | { name: string; tone?: Tone; x?: number; y?: number };
export type SpriteOpts = {
  tone?: Tone;
  /** Mirror left-to-right. */
  flip?: boolean;
  /** Turn upside down (an up arrow becomes a down arrow). */
  flipY?: boolean;
  /** Size of one sprite pixel in em. Default 0.25, so a 16-pixel sprite is 4em. */
  px?: number;
};

const cache = new Map<string, { url: string; w: number; h: number }>();

function render(layers: Layer[], opts: SpriteOpts) {
  const key = JSON.stringify([layers, opts.tone, opts.flip, opts.flipY]);
  const hit = cache.get(key);
  if (hit) return hit;
  const parts = layers.map((l) => (typeof l === 'string' ? { name: l, tone: opts.tone, x: 0, y: 0 } : { tone: opts.tone, x: 0, y: 0, ...l }));
  let w = 1;
  let h = 1;
  for (const p of parts) {
    const g = GRIDS[p.name];
    if (!g) continue;
    w = Math.max(w, p.x + g[0].length);
    h = Math.max(h, p.y + g.length);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  if (opts.flip || opts.flipY) {
    c.translate(opts.flip ? w : 0, opts.flipY ? h : 0);
    c.scale(opts.flip ? -1 : 1, opts.flipY ? -1 : 1);
  }
  for (const p of parts) {
    const g = GRIDS[p.name];
    if (!g) continue;
    const tone = TONES[p.tone ?? 'gold'];
    g.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        const col = ch === 'A' ? tone[0] : ch === 'a' ? tone[1] : ch === 'L' ? tone[2] : INK[ch];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(p.x + x, p.y + y, 1, 1);
      }
    });
  }
  const out = { url: canvas.toDataURL(), w, h };
  cache.set(key, out);
  return out;
}

function paint(el: HTMLElement, layers: Layer[], opts: SpriteOpts) {
  const { url, w, h } = render(layers, opts);
  const px = opts.px ?? 0.25;
  el.style.backgroundImage = `url(${url})`;
  el.style.width = `${w * px}em`;
  el.style.height = `${h * px}em`;
}

/** A sprite element. Pass several layers to stack them (a face on a head, a hat on top). */
export function sprite(layers: Layer | Layer[], opts: SpriteOpts = {}, cls = ''): HTMLElement {
  const el = document.createElement('i');
  el.className = `px ${cls}`.trim();
  paint(el, Array.isArray(layers) ? layers : [layers], opts);
  return el;
}

/** Swaps what a sprite element shows: the next animation frame, a new mood, another colour. */
export function setSprite(el: HTMLElement, layers: Layer | Layer[], opts: SpriteOpts = {}) {
  paint(el, Array.isArray(layers) ? layers : [layers], opts);
}
