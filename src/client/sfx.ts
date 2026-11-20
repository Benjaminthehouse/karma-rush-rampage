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
      comp.attack.value = 0.001; // fast enough to catch clicks and snaps before they clip
      out = ac.createGain();
      out.gain.value = FX_GAIN;
// A soft clipper after the compressor: untouched below 70% of full scale, rounded off
      // above it, so a sharp click can never hard-clip the speaker.
      const limit = ac.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / 512 - 1) * 2; // the input range covered is -2..2
        const m = Math.abs(x);
        curve[i] = Math.sign(x) * (m < 0.7 ? m : 0.7 + 0.3 * Math.tanh((m - 0.7) / 0.3));
      }
      limit.curve = curve;
      const pre = ac.createGain();
      pre.gain.value = 0.5; // the shaper maps -1..1, so halve going in and use the -2..2 curve
      comp.connect(pre).connect(limit).connect(ac.destination);
      out.connect(comp);
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

// One-off sounds a game asks for by name. `k` is a pitch multiplier: they climb with the
// streak too, at half the rate of the hit sound, so a hot run sounds hot everywhere.
const NAMED: Record<string, (k: number) => void> = {
  pop: (k) => tone({ f: 420 * k, to: 980 * k, dur: 0.07, type: 'sine', vol: 0.14 }),
  coin: (k) => {
    tone({ f: 988 * k, dur: 0.07, vol: 0.07 });
    tone({ f: 1319 * k, dur: 0.22, vol: 0.07, at: 0.07 });
  },
  zap: (k) => tone({ f: 1400 * k, to: 180 * k, dur: 0.14, type: 'sawtooth', vol: 0.07 }),
  whoosh: (k) => noise({ dur: 0.26, vol: 0.09, type: 'bandpass', f: 400 * k, to: 4200 * k, attack: 0.08 }),
  thud: (k) => {
    tone({ f: 110 * k, to: 38 * k, dur: 0.22, type: 'sine', vol: 0.22 });
    noise({ dur: 0.08, vol: 0.06, type: 'lowpass', f: 500 * k });
  },
  tick: (k) => tone({ f: 1250 * k, dur: 0.025, vol: 0.04 }),
  power: (k) => tone({ f: 180 * k, to: 1500 * k, dur: 0.38, type: 'sawtooth', vol: 0.06 }),
  laser: (k) => tone({ f: 1900 * k, to: 320 * k, dur: 0.18, type: 'square', vol: 0.05 }),
  ding: (k) => {
    tone({ f: 1568 * k, dur: 0.5, type: 'sine', vol: 0.12 });
    tone({ f: 3136 * k, dur: 0.3, type: 'sine', vol: 0.04 });
  },
  boing: (k) => tone({ f: 180 * k, to: 520 * k, dur: 0.2, type: 'triangle', vol: 0.14 }),
};

/**
 * The sound of a hit, chosen per game so it matches what the player is doing (see
 * hits.ts). Every voice takes `k`, the streak's pitch multiplier (1 at the start of a
 * streak, a semitone higher per hit), so whatever the action, a streak climbs.
 * Low, thumpy voices climb by a gentler power of `k` so they stay thumps.
 */
export type HitVoice =
  | 'blip' | 'vote' | 'coin' | 'water' | 'key' | 'stamp' | 'pop' | 'bell'
  | 'zap' | 'pluck' | 'swipe' | 'step' | 'sizzle' | 'snap' | 'horn';

const HIT: Record<HitVoice, (k: number) => void> = {
  // A game-console blip: the default, and anything robotic.
  blip(k) {
    const f = 349.23 * k;
    tone({ f, to: f * 1.04, dur: 0.13, type: 'square', vol: 0.1 });
    tone({ f: f * 2, dur: 0.09, type: 'triangle', vol: 0.085, at: 0.025 });
    noise({ dur: 0.04, vol: 0.02, f: 7500 });
  },
  // An upvote: a chirp that slides up an octave.
  vote(k) {
    const f = 294 * k;
    tone({ f, to: f * 2, dur: 0.11, type: 'triangle', vol: 0.17 });
    tone({ f: f * 2, to: f * 4, dur: 0.09, type: 'square', vol: 0.035, at: 0.02 });
  },
  // Money: two bright notes, a fifth apart.
  coin(k) {
    const f = 523.25 * k;
    tone({ f, dur: 0.06, type: 'square', vol: 0.075 });
    tone({ f: f * 1.5, dur: 0.2, type: 'square', vol: 0.075, at: 0.055 });
    tone({ f: f * 3, dur: 0.12, type: 'sine', vol: 0.03, at: 0.055 });
  },
  // Water and paint: a splash that falls, over a bloop.
  water(k) {
    const j = k ** 0.7;
    noise({ dur: 0.15, vol: 0.13, type: 'bandpass', f: 1500 * j, to: 500 * j, q: 1.4, attack: 0.004 });
    tone({ f: 520 * j, to: 240 * j, dur: 0.1, type: 'sine', vol: 0.13 });
  },
  // Typing: a key clack.
  key(k) {
    const j = k ** 0.8;
    noise({ dur: 0.022, vol: 0.16, f: 2600 * j, attack: 0.001 });
    tone({ f: 260 * j, dur: 0.035, type: 'square', vol: 0.12, attack: 0.002 });
    tone({ f: 520 * j, dur: 0.05, type: 'triangle', vol: 0.14, at: 0.012, attack: 0.002 });
  },
  // Stamps, gavels, hammers, slabs: a thud with a crack on top.
  stamp(k) {
    const j = k ** 0.6;
    tone({ f: 150 * j, to: 55 * j, dur: 0.17, type: 'sine', vol: 0.17, attack: 0.003 });
    tone({ f: 420 * j, dur: 0.04, type: 'triangle', vol: 0.1, attack: 0.001 });
    noise({ dur: 0.05, vol: 0.09, type: 'lowpass', f: 1100 * j, attack: 0.001 });
  },
  // Closing, bursting, bubble-wrap: a pop.
  pop(k) {
    tone({ f: 380 * k, to: 900 * k, dur: 0.065, type: 'sine', vol: 0.15, attack: 0.004 });
    noise({ dur: 0.02, vol: 0.035, f: 4000, attack: 0.002 });
  },
  // Dings, chimes, doorbells, "done!".
  bell(k) {
    const f = 587.33 * k;
    tone({ f, dur: 0.38, type: 'sine', vol: 0.095, attack: 0.002 });
    tone({ f: f * 2, dur: 0.2, type: 'triangle', vol: 0.04, attack: 0.002 });
    tone({ f: f * 2.76, dur: 0.14, type: 'sine', vol: 0.03, attack: 0.002 });
  },
  // Electricity and lasers: a zap that falls.
  zap(k) {
    const j = k ** 0.8;
    tone({ f: 1100 * j, to: 240 * j, dur: 0.1, type: 'sawtooth', vol: 0.15 });
    tone({ f: 330 * j, dur: 0.06, type: 'square', vol: 0.08 });
  },
  // A plucked string: replies, chains, zen gardens.
  pluck(k) {
    const f = 392 * k;
    tone({ f, dur: 0.24, type: 'triangle', vol: 0.15, attack: 0.002 });
    tone({ f: f * 2, dur: 0.05, type: 'square', vol: 0.04, attack: 0.001 });
  },
  // Scrolling, swiping, sending: a quick rush of air upwards.
  swipe(k) {
    const j = k ** 0.7;
    noise({ dur: 0.12, vol: 0.24, type: 'bandpass', f: 700 * j, to: 3600 * j, q: 1.6, attack: 0.02 });
    tone({ f: 300 * j, to: 620 * j, dur: 0.09, type: 'sine', vol: 0.11 });
  },
  // Footsteps and dance steps.
  step(k) {
    const j = k ** 0.7;
    tone({ f: 210 * j, to: 110 * j, dur: 0.07, type: 'triangle', vol: 0.2, attack: 0.002 });
    noise({ dur: 0.03, vol: 0.07, type: 'lowpass', f: 1400 * j, attack: 0.001 });
  },
  // Frying.
  sizzle(k) {
    const j = k ** 0.7;
    noise({ dur: 0.13, vol: 0.13, f: 3200 * j, attack: 0.01 });
    tone({ f: 220 * j, to: 300 * j, dur: 0.09, type: 'sawtooth', vol: 0.08 });
  },
  // A camera shutter or a finger snap: spotting, catching, tagging.
  snap(k) {
    const j = k ** 0.8;
    noise({ dur: 0.016, vol: 0.16, f: 4200, attack: 0.002 });
    noise({ dur: 0.022, vol: 0.16, f: 3000, at: 0.05, attack: 0.001 });
    tone({ f: 880 * j, dur: 0.05, type: 'sine', vol: 0.13, at: 0.05, attack: 0.002 });
  },
  // A megaphone honk.
  horn(k) {
    const j = k ** 0.8;
    tone({ f: 233 * j, dur: 0.12, type: 'sawtooth', vol: 0.13, attack: 0.008 });
    tone({ f: 349.6 * j, dur: 0.12, type: 'square', vol: 0.06, attack: 0.008 });
  },
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
    // Bright and percussive so it cuts through the beat on a phone speaker: a square blip
    // that drops into its note, with a click on the front.
    const f = [659.25, 830.61, 987.77][b];
    tone({ f: f * 1.5, to: f, dur: 0.11, type: 'square', vol: 0.2, attack: 0.001 });
    tone({ f: f / 2, dur: 0.08, type: 'triangle', vol: 0.16, attack: 0.001 });
    noise({ dur: 0.035, vol: 0.1, f: 2400, attack: 0.001 });
  },
  /**
   * A hit. `combo` is the streak length including this one: the note climbs a semitone
   * with every hit in a row, for two and a half octaves, so a streak winds up like a
   * siren and a miss drops it back to the bottom.
   */
  good(combo: number, voice: HitVoice = 'blip') {
    const step = Math.min(combo - 1, CLIMB);
    const k = semis(step);
    HIT[voice](k);
    // At the top of the climb a shimmer keeps each hit feeling like more.
    if (combo - 1 > CLIMB) tone({ f: 1046.5 * k, dur: 0.07, type: 'triangle', vol: 0.04, at: 0.05 });
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
  whoosh: () => NAMED.whoosh(1),
  count(n: number) {
    tone({ f: n > 0 ? 660 : 1320, dur: 0.14, vol: 0.11 });
    kick(0, 0.14);
  },
  go() {
    [392, 494, 587, 784].forEach((f) => tone({ f, to: f * 1.03, dur: 0.42, type: 'sawtooth', vol: 0.055 }));
    noise({ dur: 0.35, vol: 0.05, f: 3000, attack: 0.01 });
    kick(0, 0.2);
  },
  tick: () => NAMED.tick(1),
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
  /** A named one-off. Pass the current streak and it is pitched up to match, to an octave at most. */
  named(name: string, combo = 0) {
    NAMED[name]?.(semis(Math.min(Math.max(0, combo), 24) / 2));
  },
};
