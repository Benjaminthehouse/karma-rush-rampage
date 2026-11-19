// Everything that must be identical for every player of a given day (or party
// match) is derived from a seed string here, on both client and server.

export const GAME_IDS = [
  'upvote',
  'modqueue',
  'copypasta',
  'dodge',
  'flair',
  'poll',
  'servers',
  'peak',
] as const;
export type GameId = (typeof GAME_IDS)[number];

export const ROUNDS = 5;
export const MAX_ROUND_SCORE = 1000;
export const MAX_TOTAL = ROUNDS * MAX_ROUND_SCORE;

export const TIMING = { countdown: 3000, intro: 2800, result: 2800 } as const;

export type GameMeta = {
  title: string;
  /** One-line instruction shown on the intro card. */
  how: string;
  /** What each button does in this game: red, green, blue. */
  labels: [string, string, string];
  duration: number;
};

export const GAME_META: Record<GameId, GameMeta> = {
  upvote: {
    title: 'Upvote Crisis',
    how: 'Mash the arrow’s colour to send each post to the front page!',
    labels: ['UPVOTE', 'UPVOTE', 'UPVOTE'],
    duration: 7000,
  },
  modqueue: {
    title: 'Mod Queue',
    how: 'Remove the spam, approve the nice stuff, lock the fights.',
    labels: ['REMOVE', 'APPROVE', 'LOCK'],
    duration: 8000,
  },
  copypasta: {
    title: 'Copypasta',
    how: 'Paste it again! Hit the colours in order, left to right.',
    labels: ['RED', 'GREEN', 'BLUE'],
    duration: 7000,
  },
  dodge: {
    title: 'Downvote Dodge',
    how: 'Jump lanes. Catch the upvotes, dodge the downvotes.',
    labels: ['LEFT', 'MIDDLE', 'RIGHT'],
    duration: 8000,
  },
  flair: {
    title: 'Flair Check',
    how: 'Read the rule, then tag every flair before time runs out.',
    labels: ['RED', 'GREEN', 'BLUE'],
    duration: 7000,
  },
  poll: {
    title: 'Poll Results',
    how: 'Which colour got the most votes? Call it fast.',
    labels: ['RED', 'GREEN', 'BLUE'],
    duration: 8000,
  },
  servers: {
    title: 'Servers Are Down',
    how: 'Mash ANY buttons to reboot — but never the same one twice in a row!',
    labels: ['MASH', 'MASH', 'MASH'],
    duration: 6000,
  },
  peak: {
    title: 'Peak Hour',
    how: 'Post when the marker is inside the colour you’re told.',
    labels: ['RED', 'GREEN', 'BLUE'],
    duration: 8000,
  },
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Round = { id: GameId; seed: number; level: number };

/** The five mini-games (and their content seeds) for a seed string. */
export function lineupFor(seed: string): Round[] {
  const rng = mulberry32(hashStr(`lineup:${seed}`));
  const pool = [...GAME_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ROUNDS).map((id, level) => ({
    id,
    level,
    seed: hashStr(`${seed}:${level}:${id}`),
  }));
}

export type Phase = { type: 'intro' | 'play' | 'result'; round: number; start: number; end: number };

/** Fixed timeline in ms relative to the match start, so party players stay in sync. */
export function timeline(lineup: Round[]): Phase[] {
  const out: Phase[] = [];
  let t = 0;
  lineup.forEach((r, round) => {
    out.push({ type: 'intro', round, start: t, end: (t += TIMING.intro) });
    out.push({ type: 'play', round, start: t, end: (t += GAME_META[r.id].duration) });
    out.push({ type: 'result', round, start: t, end: (t += TIMING.result) });
  });
  return out;
}

export function matchLength(lineup: Round[]): number {
  const tl = timeline(lineup);
  return tl[tl.length - 1].end;
}

export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function prevDayKey(day: string): string {
  return dayKey(new Date(Date.parse(`${day}T00:00:00Z`) - 86400000));
}

export function prettyDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(MAX_ROUND_SCORE, v)) : 0;
}

const BOTS = [
  { name: 'LurkerBot', skill: 0.42 },
  { name: 'MashBot', skill: 0.6 },
  { name: 'KarmaBot', skill: 0.76 },
];

/** House bots: stand-in rivals with seeded scores, always labelled as bots in the UI. */
export function botRounds(seed: string): { name: string; rounds: number[] }[] {
  return BOTS.map((bot) => {
    const rng = mulberry32(hashStr(`bot:${bot.name}:${seed}`));
    return {
      name: bot.name,
      rounds: Array.from({ length: ROUNDS }, () => clampScore((bot.skill + (rng() - 0.5) * 0.3) * 1000)),
    };
  });
}
