// Sound design, fully synthesised with Web Audio: no audio files to load.
// Everything routes through one compressor so stacked hits stay punchy, not harsh.
import { settings } from './settings';

let ac: AudioContext | null = null;
let out: GainNode | null = null;
let beat: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

// Mix: what the player does (presses, hits, rewards) must sit on top of the beat.
const FX_GAIN = 1.9;
const MUSIC_GAIN = 0.55;

function audio(): AudioContext | null {
  if (!settings.get('sound')) return null;
  try {
    if (!ac) {
      ac = new AudioContext();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 6;
      out = ac.createGain();
      out.gain.value = FX_GAIN;
      out.connect(comp).connect(ac.destination);
      beat = ac.createGain();
      beat.gain.value = MUSIC_GAIN;
      beat.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== 'running') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

type Tone = { f: number; dur: number; type?: OscillatorType; vol?: number; to?: number; at?: number; attack?: number; music?: boolean };

function tone({ f, dur, type = 'square', vol = 0.08, to, at = 0, attack = 0.004, music = false }: Tone) {
  const a = audio();
  const bus = music ? beat : out;
  if (!a || !bus || a.state !== 'running') return; // a suspended context would only hoard nodes
  const t0 = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  // Decay to -34 dB rather than to silence, so short sounds keep some body.
  g.gain.exponentialRampToValueAtTime(vol * 0.02, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

type Noise = { dur: number; vol?: number; type?: BiquadFilterType; f?: number; to?: number; at?: number; attack?: number; q?: number; music?: boolean };

function noise({ dur, vol = 0.08, type = 'highpass', f = 2000, to, at = 0, attack = 0.002, q = 0.8, music = false }: Noise) {
  const a = audio();
  const bus = music ? beat : out;
  if (!a || !bus || !noiseBuf || a.state !== 'running') return;
  const t0 = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = a.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, t0);
  if (to) filt.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(vol * 0.02, t0 + dur);
  src.connect(filt).connect(g).connect(bus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

const kick = (at = 0, vol = 0.2, music = false) => tone({ f: 160, to: 42, dur: 0.16, type: 'sine', vol, at, music });
const snare = (at = 0, vol = 0.12) => {
  noise({ dur: 0.12, vol, f: 1800, at, music: true });
  tone({ f: 190, to: 120, dur: 0.08, type: 'triangle', vol: vol * 0.8, at, music: true });
};
const hat = (at = 0, vol = 0.035) => noise({ dur: 0.035, vol, f: 7000, at, music: true });

const semis = (n: number) => 2 ** (n / 12);
// Major pentatonic ladder: each step of a combo climbs one rung.
/** Semitones a streak can climb before the pitch holds. */
const CLIMB = 30;

function arp(notes: number[], step: number, o: Partial<Tone> = {}) {
  notes.forEach((n, i) => {
    tone({ f: 523.25 * semis(n), dur: 0.16, type: 'square', vol: 0.07, at: i * step, ...o });
    tone({ f: 261.63 * semis(n), dur: 0.16, type: 'triangle', vol: 0.07, at: i * step });
  });
}

function cheer(at = 0, dur = 1.1) {
  noise({ dur, vol: 0.07, type: 'bandpass', f: 1400, to: 2600, at, attack: 0.25, q: 0.6 });
  noise({ dur: dur * 0.8, vol: 0.03, f: 5200, at: at + 0.1, attack: 0.3 });
}

// ------------------------------------------------------------------ music
// A tiny step sequencer. Tempo climbs each round; the bass riff is seeded per game.

const RIFFS = [
  [0, 0, 12, 0, 7, 0, 10, 12],
  [0, 7, 0, 12, 0, 10, 7, 3],
  [0, 0, 3, 0, 5, 0, 7, 10],
  [0, 12, 7, 12, 5, 12, 3, 10],
  [0, 3, 7, 10, 12, 10, 7, 3],
];
let musicTimer = 0;
let musicNext = 0;
let musicStep = 0;
let musicRush = false;

function musicTick(stepLen: number, riff: number[], root: number) {
  const a = ac;
  if (!a) return;
  while (musicNext < a.currentTime + 0.12) {
    const at = Math.max(0, musicNext - a.currentTime);
    const s = musicStep % 16;
    if (s % 4 === 0) kick(at, 0.36, true);
    if (s === 4 || s === 12) snare(at, 0.1);
    if (s % 2 === 1 || musicRush) hat(at, s % 4 === 2 ? 0.04 : 0.022);
    if (s % 2 === 0) {
      const n = riff[(musicStep / 2) % riff.length | 0];
      tone({ f: root * semis(n), dur: stepLen * 1.7, type: 'sawtooth', vol: 0.07, at, music: true });
      tone({ f: root * 2 * semis(n), dur: stepLen * 0.9, type: 'square', vol: 0.028, at, music: true });
    }
    if (musicRush && s % 4 === 2) tone({ f: 1760, dur: 0.04, type: 'square', vol: 0.05, at, music: true });
    musicNext += stepLen;
    musicStep++;
  }
}

export const music = {
  /** Tempo climbs with the round. Games that land on the beat use the same number. */
  bpm: (round: number) => 128 + round * 7,
  start(seed: number, round: number) {
    music.stop();
    const a = audio();
    if (!a) return;
    const bpm = music.bpm(round);
    const stepLen = 60 / bpm / 4;
    const riff = RIFFS[seed % RIFFS.length];
    const root = 55 * semis([0, 3, 5, 7, 10][(seed >>> 3) % 5]);
    musicNext = a.currentTime + 0.03;
    musicStep = 0;
    musicRush = false;
    musicTimer = window.setInterval(() => musicTick(stepLen, riff, root), 25);
    musicTick(stepLen, riff, root);
  },
  /** Last seconds of a round: busier hats and a ticking lead. */
  rush(on: boolean) {
    musicRush = on;
  },
  stop() {
    clearInterval(musicTimer);
    musicTimer = 0;
  },
};

// -------------------------------------------------------------------- sfx

const NAMED: Record<string, () => void> = {
  pop: () => tone({ f: 420, to: 980, dur: 0.07, type: 'sine', vol: 0.14 }),
  coin: () => {
    tone({ f: 988, dur: 0.07, vol: 0.07 });
    tone({ f: 1319, dur: 0.22, vol: 0.07, at: 0.07 });
  },
  zap: () => tone({ f: 1400, to: 180, dur: 0.14, type: 'sawtooth', vol: 0.07 }),
  whoosh: () => noise({ dur: 0.26, vol: 0.09, type: 'bandpass', f: 400, to: 4200, attack: 0.08 }),
  thud: () => {
    tone({ f: 110, to: 38, dur: 0.22, type: 'sine', vol: 0.22 });
    noise({ dur: 0.08, vol: 0.06, type: 'lowpass', f: 500 });
  },
  tick: () => tone({ f: 1250, dur: 0.025, vol: 0.04 }),
  power: () => tone({ f: 180, to: 1500, dur: 0.38, type: 'sawtooth', vol: 0.06 }),
  laser: () => tone({ f: 1900, to: 320, dur: 0.18, type: 'square', vol: 0.05 }),
  ding: () => {
    tone({ f: 1568, dur: 0.5, type: 'sine', vol: 0.12 });
    tone({ f: 3136, dur: 0.3, type: 'sine', vol: 0.04 });
  },
  boing: () => tone({ f: 180, to: 520, dur: 0.2, type: 'triangle', vol: 0.14 }),
};

// iPhones mute Web Audio while the ring switch is on silent, though speech still plays.
// Asking the audio session for the "playback" category (iOS 16.4 and later) lifts that.
// Where that is missing, one looping clip of real silence moves the page into the media
// category instead. It is a single reused element, tried on a few gestures at most.
let sessionAsked = false;
let clipTries = 0;
let clip: HTMLAudioElement | null = null;
function silence(): string {
  const n = 8000; // one second of 8-bit mono at 8 kHz
  const bytes = new Uint8Array(44 + n).fill(128);
  const head = new DataView(bytes.buffer);
  const put = (at: number, text: string) => [...text].forEach((ch, i) => head.setUint8(at + i, ch.charCodeAt(0)));
  put(0, 'RIFF');
  head.setUint32(4, 36 + n, true);
  put(8, 'WAVEfmt ');
  head.setUint32(16, 16, true);
  head.setUint16(20, 1, true);
  head.setUint16(22, 1, true);
  head.setUint32(24, 8000, true);
  head.setUint32(28, 8000, true);
  head.setUint16(32, 1, true);
  head.setUint16(34, 8, true);
  put(36, 'data');
  head.setUint32(40, n, true);
  let text = '';
  bytes.forEach((v) => (text += String.fromCharCode(v)));
  return `data:audio/wav;base64,${btoa(text)}`;
}
function unmuteIos() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return;
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      if (!sessionAsked) session.type = 'playback';
      sessionAsked = true;
      return;
    }
    if (clipTries >= 3) return;
    clipTries++;
    if (!clip) {
      clip = new Audio(silence());
      clip.loop = true;
      clip.setAttribute('playsinline', '');
    }
    void clip.play().then(
      () => (clipTries = 3),
      () => undefined
    );
  } catch {
    /* sound stays tied to the ring switch */
  }
}

let primed = false;

export const sfx = {
  /** Call from a user gesture so the audio context may start. */
  unlock: () => {
    if (!settings.get('sound')) return;
    unmuteIos();
    const a = audio();
    if (!a || primed) return;
    // Phones only start the audio clock once a sound is played from inside a gesture, so a
    // one-sample silent buffer is played on each gesture until the clock is running.
    try {
      const src = a.createBufferSource();
      src.buffer = a.createBuffer(1, 1, a.sampleRate);
      src.connect(a.destination);
      src.start(0);
    } catch {
      /* the next gesture tries again */
    }
    if (a.state === 'running') primed = true;
  },
  /** For the menu's status line: off, none (no audio support), or the audio clock's state. */
  state: (): string => (!settings.get('sound') ? 'off' : (ac?.state ?? 'not started')),
  /** Every pad press answers with its own note: low, middle, high for red, green, blue. */
  press(b: number) {
    tone({ f: [330, 415, 494][b], dur: 0.06, type: 'triangle', vol: 0.15 });
    noise({ dur: 0.025, vol: 0.05, f: 3200 });
  },
  /**
   * A hit. `combo` is the streak length including this one: the note climbs a semitone
   * with every hit in a row, for two and a half octaves, so a streak winds up like a
   * siren and a miss drops it back to the bottom.
   */
  good(combo: number) {
    const step = Math.min(combo - 1, CLIMB);
    const f = 349.23 * semis(step);
    tone({ f, to: f * 1.04, dur: 0.13, type: 'square', vol: 0.1 });
    tone({ f: f * 2, dur: 0.09, type: 'triangle', vol: 0.085, at: 0.025 });
    // At the top of the climb a shimmer keeps each hit feeling like more.
    if (combo - 1 > CLIMB) tone({ f: f * 3, dur: 0.07, type: 'triangle', vol: 0.04, at: 0.05 });
    noise({ dur: 0.04, vol: 0.02, f: 7500 });
  },
  /** A miss: a two-step falling buzz that cannot be mistaken for anything good. */
  bad() {
    tone({ f: 196, to: 120, dur: 0.12, type: 'sawtooth', vol: 0.15 });
    tone({ f: 110, to: 55, dur: 0.26, type: 'sawtooth', vol: 0.15, at: 0.1 });
    tone({ f: 116, to: 58, dur: 0.26, type: 'square', vol: 0.07, at: 0.1 });
    noise({ dur: 0.16, vol: 0.07, type: 'lowpass', f: 500 });
  },
  milestone() {
    arp([12, 16, 19, 24], 0.045, { vol: 0.06, dur: 0.1 });
    noise({ dur: 0.3, vol: 0.04, f: 6000, attack: 0.02 });
  },
  /** One announcer word landing. `i` is the word index, so the stabs climb. */
  slam(i: number) {
    kick(0, 0.2);
    noise({ dur: 0.07, vol: 0.06, f: 1500 });
    tone({ f: 261.63 * semis([0, 4, 7, 12, 14, 16][i % 6]), dur: 0.16, type: 'sawtooth', vol: 0.11 });
  },
  whoosh: () => NAMED.whoosh(),
  count(n: number) {
    tone({ f: n > 0 ? 660 : 1320, dur: 0.14, vol: 0.11 });
    kick(0, 0.14);
  },
  go() {
    [392, 494, 587, 784].forEach((f) => tone({ f, to: f * 1.03, dur: 0.42, type: 'sawtooth', vol: 0.055 }));
    noise({ dur: 0.35, vol: 0.05, f: 3000, attack: 0.01 });
    kick(0, 0.2);
  },
  tick: () => NAMED.tick(),
  roundEnd() {
    noise({ dur: 0.7, vol: 0.06, f: 5000, attack: 0.005 });
    kick(0, 0.18);
  },
  /** 0 = flop ... 3 = perfect. */
  result(tier: number) {
    if (tier >= 3) {
      arp([0, 4, 7, 12, 16, 19, 24], 0.07);
      cheer(0.2);
    } else if (tier === 2) arp([0, 4, 7, 12], 0.09);
    else if (tier === 1) arp([0, 7], 0.12);
    else {
      [196, 185, 174.6, 130.8].forEach((f, i) =>
        tone({ f, to: f * 0.94, dur: 0.3, type: 'sawtooth', vol: 0.07, at: i * 0.22 })
      );
    }
  },
  fanfare() {
    arp([0, 0, 0, 4, 7, 12, 7, 12, 16, 19, 24], 0.1, { dur: 0.2 });
    cheer(0.5, 1.8);
  },
  named(name: string) {
    NAMED[name]?.();
  },
};
