// Per-viewer preferences. Storage can be missing in embedded web views, so every access is guarded.
type Key = 'sound' | 'voice' | 'fx';

const reducedMotion = (() => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();

const state: Record<Key, boolean> = { sound: true, voice: true, fx: !reducedMotion };

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
