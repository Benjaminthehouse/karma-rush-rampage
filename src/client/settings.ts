// Per-viewer preferences. Storage can be missing in embedded web views, so every access is guarded.
type Key = 'sound' | 'voice' | 'fx';

const reducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

// The speech voice stalls iPhone web views for a moment on every word, so there it starts
// off (the VOICE toggle turns it on); the announcer's synthesised hits play either way.
const ios = (() => {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
})();

const state: Record<Key, boolean> = { sound: true, voice: !ios, fx: !reducedMotion };

for (const k of Object.keys(state) as Key[]) {
  try {
    const v = localStorage.getItem(`km_${k}`);
    if (v !== null) state[k] = v === '1';
  } catch {
    /* keep the default */
  }
}

export const settings = {
  get: (k: Key) => state[k],
  toggle(k: Key) {
    state[k] = !state[k];
    try {
      localStorage.setItem(`km_${k}`, state[k] ? '1' : '0');
    } catch {
      /* ignore */
    }
    return state[k];
  },
};
