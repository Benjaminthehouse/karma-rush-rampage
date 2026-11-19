// A demo player that follows a game's hint(). Used by practice auto-play
// (`?autoplay=1`) and the end-to-end smoke test; never by scored runs.
import type { Btn, GameInst } from './games/common';

export function createBot(think: number, perTap: boolean, rate = 6) {
  let lastKey = 'null';
  let since = 0;
  let nextTap = 0;
  let holding: Btn[] = [];
  const releases: { at: number; b: Btn }[] = [];

  return function step(inst: GameInst, t: number, press: (b: Btn) => void, release: (b: Btn) => void) {
    for (let i = releases.length - 1; i >= 0; i--) {
      if (releases[i].at <= t) {
        release(releases[i].b);
        releases.splice(i, 1);
      }
    }
    const hint = inst.hint(t);
    const key = JSON.stringify(hint);
    if (key !== lastKey) {
      lastKey = key;
      since = t;
    }
    const ready = t - since >= think;
    if (hint !== null && typeof hint === 'object' && !Array.isArray(hint)) {
      if (!ready) return;
      const want = hint.hold;
      ([0, 1, 2] as Btn[]).forEach((b) => {
        if (want.includes(b)) {
          if (!holding.includes(b)) press(b);
        } else if (holding.includes(b)) release(b);
      });
      holding = [...want];
      return;
    }
    if (holding.length && ready) {
      holding.forEach(release);
      holding = [];
    }
    if (hint === null || !ready || t < nextTap || releases.length) return;
    const btns = Array.isArray(hint) ? hint : [hint];
    btns.forEach(press);
    btns.forEach((b) => releases.push({ at: t + 60, b }));
    nextTap = t + 1000 / rate;
    if (perTap) since = t;
  };
}
