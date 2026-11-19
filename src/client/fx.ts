// Visual juice: sparks, floating text, flashes, shakes. Everything is CSS-animated
// DOM in a layer above the stage, so games never have to clean up.
import type { FxColor } from './games/common';
import { settings } from './settings';

const HEX: Record<FxColor, string> = {
  red: '#ff4b55',
  green: '#2fd66f',
  blue: '#3f8cff',
  gold: '#ffcf3f',
  white: '#f4f6ff',
  purple: '#b14bff',
};

export type FxLayer = ReturnType<typeof createFx>;

export function createFx(arena: HTMLElement, layer: HTMLElement) {
  const full = () => settings.get('fx');
  let lastFlash = -1000;

  function point(at: Element | null): { x: number; y: number } {
    const base = layer.getBoundingClientRect();
    const r = (at ?? layer).getBoundingClientRect();
    return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
  }

  function spawn(cls: string, x: number, y: number): HTMLElement {
    const el = document.createElement('i');
    el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.addEventListener('animationend', () => el.remove(), { once: true });
    layer.append(el);
    // Safety net: the layer never accumulates if an animation is skipped.
    if (layer.childElementCount > 140) layer.firstElementChild?.remove();
    return el;
  }

  return {
    burst(at: Element | null, color: FxColor = 'gold', count = 10) {
      const { x, y } = point(at);
      const n = full() ? count : Math.min(4, count);
      for (let i = 0; i < n; i++) {
        const el = spawn('spark', x, y);
        const ang = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 70;
        el.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
        el.style.setProperty('--dy', `${Math.sin(ang) * dist - 20}px`);
        el.style.background = HEX[color];
        el.style.animationDuration = `${380 + Math.random() * 260}ms`;
      }
    },
    pop(at: Element | null, text: string, color: FxColor = 'gold') {
      const { x, y } = point(at);
      const el = spawn('pop-text', x, y);
      el.textContent = text;
      el.style.color = HEX[color];
    },
    /** Milestone text across the top of the arena, clear of the action. */
    banner(text: string, color: FxColor = 'gold') {
      const el = spawn('pop-text banner', layer.clientWidth / 2, layer.clientHeight * 0.14);
      el.textContent = text;
      el.style.color = HEX[color];
    },
    flash(color: FxColor = 'white') {
      if (!full()) return;
      // Never more than about two full-arena flashes a second, however often games ask.
      const now = performance.now();
      if (now - lastFlash < 450) return;
      lastFlash = now;
      const el = spawn('flash', 0, 0);
      el.style.background = HEX[color];
    },
    shake() {
      if (!full()) return;
      arena.classList.remove('shake');
      void arena.offsetWidth;
      arena.classList.add('shake');
    },
    /** Ring lights around the arena blink in a colour. */
    lights(color: FxColor) {
      arena.style.setProperty('--hit', HEX[color]);
      arena.classList.remove('hit');
      void arena.offsetWidth;
      arena.classList.add('hit');
    },
    confetti(count = 70) {
      const w = layer.clientWidth;
      const n = full() ? count : 16;
      const colors = Object.values(HEX);
      for (let i = 0; i < n; i++) {
        const el = spawn('confetti', Math.random() * w, -10);
        el.style.background = colors[i % colors.length];
        el.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
        el.style.setProperty('--rot', `${(Math.random() - 0.5) * 1440}deg`);
        el.style.animationDuration = `${1100 + Math.random() * 1300}ms`;
        el.style.animationDelay = `${Math.random() * 350}ms`;
      }
    },
    clear() {
      layer.replaceChildren();
    },
  };
}
