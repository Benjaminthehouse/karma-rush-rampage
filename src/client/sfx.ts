// Tiny synthesised sound effects; no audio files to load.
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('km_muted') === '1';
} catch {
  /* storage can be unavailable in embedded web views */
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* audio is a nice-to-have */
  }
}

export const sfx = {
  press: (b: number) => tone([330, 415, 494][b], 0.06, 'square', 0.035),
  good: () => tone(660, 0.14, 'triangle', 0.09, 1.5),
  bad: () => tone(160, 0.18, 'sawtooth', 0.06, 0.6),
  tick: () => tone(880, 0.07, 'square', 0.04),
  go: () => tone(1175, 0.25, 'square', 0.06),
  result: (score: number) => {
    const base = score >= 700 ? 523 : score >= 400 ? 392 : 220;
    tone(base, 0.12, 'triangle', 0.09);
    setTimeout(() => tone(base * (score >= 400 ? 1.5 : 0.75), 0.25, 'triangle', 0.09), 120);
  },
  isMuted: () => muted,
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('km_muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return muted;
  },
};
