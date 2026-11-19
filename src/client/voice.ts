// The announcer. Uses the browser's speech voice where one exists; the game
// never depends on it (every word also gets a synthesised hit in sfx).
import { settings } from './settings';

const synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
let chosen: SpeechSynthesisVoice | null = null;
let unlocked = false;

function choose() {
  if (!synth) return;
  const voices = synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  const prefer = [/google us english/i, /daniel/i, /aaron/i, /samantha/i, /alex/i, /en-us/i];
  chosen = prefer.map((re) => voices.find((v) => re.test(v.name) || re.test(v.lang))).find(Boolean) ?? voices[0] ?? null;
}
if (synth) {
  choose();
  try {
    synth.addEventListener('voiceschanged', choose);
  } catch {
    /* some web views lack the event */
  }
}

export const voice = {
  available: () => !!synth,
  /** Call from a user gesture once; mobile browsers refuse speech before that. */
  unlock() {
    if (!synth || unlocked) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      // Only count it once the browser really accepted an utterance.
      u.onstart = u.onend = () => (unlocked = true);
      synth.speak(u);
    } catch {
      /* ignore */
    }
  },
  say(text: string, o: { rate?: number; pitch?: number } = {}) {
    if (!synth || !settings.get('voice') || !settings.get('sound')) return;
    try {
      synth.cancel();
      // Lowercase so engines read words instead of spelling out capitals.
      const u = new SpeechSynthesisUtterance(text.toLowerCase().replace(/’/g, "'"));
      if (chosen) u.voice = chosen;
      u.lang = chosen?.lang ?? 'en-US';
      u.rate = o.rate ?? 1.25;
      u.pitch = o.pitch ?? 1.15;
      u.volume = 1;
      synth.speak(u);
    } catch {
      /* ignore */
    }
  },
  hush() {
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
  },
};
