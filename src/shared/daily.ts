// Everything that must be identical for every player of a given day (or party
// match) is derived from a seed string here, on both client and server.
import { CATALOG } from './catalog.gen';
import type { GameMeta } from './meta';
import { hashStr, mulberry32 } from './rng';

export { hashStr, mulberry32 } from './rng';

export type { GameMeta } from './meta';
export type GameId = string;

export const GAME_META: Record<GameId, GameMeta> = Object.fromEntries(CATALOG.map((m) => [m.id, m]));
export const GAME_IDS: GameId[] = CATALOG.map((m) => m.id);

export const ROUNDS = 5;
export const MAX_ROUND_SCORE = 1000;
export const MAX_TOTAL = ROUNDS * MAX_ROUND_SCORE;

/** `intro` is long enough for the announcer to dictate a six-word command. */
export const TIMING = { countdown: 3000, intro: 3600, result: 3200 } as const;

export type Round = { id: GameId; seed: number; level: number };

const MAX_PER_KIND = 2;

/**
 * The five mini-games (and their content seeds) for a seed string. At most two
 * games of one kind per lineup, and never two of the same kind back to back.
 */
export function lineupFor(seed: string, pool: GameId[] = GAME_IDS): Round[] {
  const rng = mulberry32(hashStr(`lineup:${seed}`));
  const order = pool.filter((id) => GAME_META[id]);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const picked: GameId[] = [];
  const perKind: Record<string, number> = {};
  const take = (strict: boolean) => {
    for (const id of order) {
      if (picked.length >= ROUNDS) return;
      if (picked.includes(id)) continue;
      const kind = GAME_META[id].kind;
      const last = picked[picked.length - 1];
      if (strict && ((perKind[kind] ?? 0) >= MAX_PER_KIND || (last && GAME_META[last].kind === kind))) continue;
      picked.push(id);
      perKind[kind] = (perKind[kind] ?? 0) + 1;
    }
  };
  take(true);
  take(false); // small pools cannot always satisfy the variety rules
  return picked.map((id, level) => ({ id, level, seed: hashStr(`${seed}:${level}:${id}`) }));
}

/** Rebuilds rounds from stored ids, swapping in a substitute for any game that no longer exists. */
export function roundsFromIds(seed: string, ids: GameId[]): Round[] {
  const fallback = lineupFor(seed).map((r) => r.id);
  return Array.from({ length: ROUNDS }, (_, level) => {
    const id = GAME_META[ids[level]] ? ids[level] : fallback[level];
    return { id, level, seed: hashStr(`${seed}:${level}:${id}`) };
  });
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
