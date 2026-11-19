// Game rules that live on the server, written against a tiny key-value
// interface so the exact same code runs on Devvit Redis and in the local mock.
import type { InitResponse, LbEntry, PartyPlayer, PartyState, Rival, SubmitResponse } from '../shared/api';
import {
  ROUNDS,
  botRounds,
  clampScore,
  hashStr,
  lineupFor,
  matchLength,
  mulberry32,
  prevDayKey,
} from '../shared/daily';

export interface Store {
  hGet(key: string, field: string): Promise<string | undefined | null>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<unknown>;
  zAdd(key: string, ...members: { member: string; score: number }[]): Promise<unknown>;
  zScore(key: string, member: string): Promise<number | undefined | null>;
  zRank(key: string, member: string): Promise<number | undefined | null>;
  zCard(key: string): Promise<number>;
  zRange(
    key: string,
    start: number,
    stop: number,
    options: { by: 'rank'; reverse?: boolean }
  ): Promise<{ member: string; score: number }[]>;
}

const lbKey = (day: string) => `lb:${day}`;
const runsKey = (day: string) => `runs:${day}`;
const userKey = (name: string) => `user:${name}`;

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function cleanRounds(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length !== ROUNDS) return null;
  return input.map(clampScore);
}

async function top(store: Store, day: string, n = 10): Promise<LbEntry[]> {
  const rows = await store.zRange(lbKey(day), 0, n - 1, { by: 'rank', reverse: true });
  return rows.map((r, i) => ({ name: r.member, score: r.score, rank: i + 1 }));
}

async function rankOf(store: Store, day: string, name: string | null, players: number) {
  if (!name) return null;
  const asc = await store.zRank(lbKey(day), name);
  return asc === undefined || asc === null ? null : players - asc;
}

/** Up to three recorded runs from other players of this day, padded with house bots. */
async function pickRivals(store: Store, day: string, me: string | null, players: number) {
  const rivals: Rival[] = [];
  const rng = mulberry32(hashStr(`rivals:${day}:${me ?? ''}:${players}`));
  const tried = new Set<number>();
  for (let attempt = 0; attempt < 8 && rivals.length < 3 && tried.size < players; attempt++) {
    const idx = Math.floor(rng() * players);
    if (tried.has(idx)) continue;
    tried.add(idx);
    const [row] = await store.zRange(lbKey(day), idx, idx, { by: 'rank' });
    if (!row || row.member === me) continue;
    const raw = await store.hGet(runsKey(day), row.member);
    const rounds = raw ? cleanRounds(JSON.parse(raw)) : null;
    if (rounds) rivals.push({ name: row.member, rounds });
  }
  for (const bot of botRounds(day)) if (rivals.length < 3) rivals.push({ ...bot, bot: true });
  return rivals;
}

async function userStats(store: Store, name: string | null, today: string) {
  if (!name) return { streak: 0, best: 0 };
  const u = await store.hGetAll(userKey(name));
  const alive = u.lastDay === today || u.lastDay === prevDayKey(today);
  return { streak: alive ? Number(u.streak) || 0 : 0, best: Number(u.best) || 0 };
}

export async function getInit(
  store: Store,
  p: { username: string | null; day: string; today: string; now: number }
): Promise<InitResponse> {
  const players = await store.zCard(lbKey(p.day));
  const raw = p.username ? await store.hGet(runsKey(p.day), p.username) : null;
  const rounds = raw ? cleanRounds(JSON.parse(raw)) : null;
  const stats = await userStats(store, p.username, p.today);
  return {
    username: p.username,
    day: p.day,
    isToday: p.day === p.today,
    myRun: rounds ? { rounds, total: sum(rounds) } : null,
    ...stats,
    leaderboard: await top(store, p.day),
    rank: await rankOf(store, p.day, p.username, players),
    players,
    rivals: await pickRivals(store, p.day, p.username, players),
    now: p.now,
  };
}

/** Records the player's run for the day. Only the first run of a day counts. */
export async function submitRun(
  store: Store,
  p: { username: string | null; day: string; today: string; rounds: number[] }
): Promise<SubmitResponse> {
  let total = sum(p.rounds);
  let saved = false;
  if (p.username) {
    const existing = await store.hGet(runsKey(p.day), p.username);
    if (existing) {
      total = sum(cleanRounds(JSON.parse(existing)) ?? p.rounds);
    } else {
      await store.hSet(runsKey(p.day), { [p.username]: JSON.stringify(p.rounds) });
      await store.zAdd(lbKey(p.day), { member: p.username, score: total });
      saved = true;
      const u = await store.hGetAll(userKey(p.username));
      const next: Record<string, string> = {
        best: String(Math.max(Number(u.best) || 0, total)),
      };
      if (p.day === p.today && u.lastDay !== p.today) {
        const kept = u.lastDay === prevDayKey(p.today) ? Number(u.streak) || 0 : 0;
        next.streak = String(kept + 1);
        next.lastDay = p.today;
      }
      await store.hSet(userKey(p.username), next);
    }
  }
  const players = await store.zCard(lbKey(p.day));
  return {
    saved,
    total,
    ...(await userStats(store, p.username, p.today)),
    leaderboard: await top(store, p.day),
    rank: await rankOf(store, p.day, p.username, players),
    players,
  };
}

// ---------------------------------------------------------------- live party
// One lobby per post. `meta` holds the current match; every player owns exactly
// one field of the players hash, so concurrent writes never clobber each other.

type Seat = { hb: number; m: string; r: number[] };

const LOBBY_TTL = 12_000;
const SEAT_TTL = 5 * 60_000;
export const PARTY_COUNTDOWN = 5000;

const metaKey = (post: string) => `party:${post}:meta`;
const seatsKey = (post: string) => `party:${post}:seats`;

function parseSeat(raw: string | undefined | null): Seat {
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === 'object') {
      return { hb: Number(s.hb) || 0, m: String(s.m ?? ''), r: Array.isArray(s.r) ? s.r.map(clampScore) : [] };
    }
  } catch {
    /* fall through to an empty seat */
  }
  return { hb: 0, m: '', r: [] };
}

async function readMeta(store: Store, post: string, now: number) {
  const meta = await store.hGetAll(metaKey(post));
  const id = meta.id ?? '';
  const startAt = Number(meta.startAt) || 0;
  const running = !!id && now < startAt + matchLength(lineupFor(id)) + 1500;
  return { id, startAt, running };
}

async function partyState(store: Store, post: string, who: string, now: number): Promise<PartyState> {
  const meta = await readMeta(store, post, now);
  const all = await store.hGetAll(seatsKey(post));
  const players: PartyPlayer[] = [];
  const dead: string[] = [];
  for (const [name, raw] of Object.entries(all)) {
    const seat = parseSeat(raw);
    const inMatch = !!meta.id && seat.m === meta.id;
    const age = now - seat.hb;
    if (age > SEAT_TTL && !(inMatch && meta.running)) dead.push(name);
    else if (age < LOBBY_TTL || inMatch) {
      players.push({ name, inMatch, rounds: inMatch ? seat.r : [] });
    }
  }
  if (dead.length) await store.hDel(seatsKey(post), dead);
  players.sort((a, b) => sum(b.rounds) - sum(a.rounds) || a.name.localeCompare(b.name));
  return { id: meta.id, status: meta.running ? 'running' : 'lobby', startAt: meta.startAt, now, you: who, players };
}

/** Heartbeat. Passing the current match id (before its first round ends) takes a seat in it. */
export async function partyBeat(store: Store, post: string, who: string, now: number, matchId?: string) {
  const meta = await readMeta(store, post, now);
  const seat = parseSeat(await store.hGet(seatsKey(post), who));
  seat.hb = now;
  if (matchId && matchId === meta.id && meta.running && seat.m !== matchId) {
    seat.m = matchId;
    seat.r = [];
  }
  await store.hSet(seatsKey(post), { [who]: JSON.stringify(seat) });
  return partyState(store, post, who, now);
}

export async function partyStart(store: Store, post: string, who: string, now: number) {
  const meta = await readMeta(store, post, now);
  if (!meta.running) {
    const id = `${post}-${now.toString(36)}`;
    await store.hSet(metaKey(post), { id, startAt: String(now + PARTY_COUNTDOWN) });
    await store.hSet(seatsKey(post), { [who]: JSON.stringify({ hb: now, m: id, r: [] } satisfies Seat) });
  }
  return partyState(store, post, who, now);
}

export async function partyScore(
  store: Store,
  post: string,
  who: string,
  now: number,
  matchId: string,
  rounds: unknown
) {
  const seat = parseSeat(await store.hGet(seatsKey(post), who));
  if (seat.m === matchId && Array.isArray(rounds) && rounds.length <= ROUNDS) {
    seat.hb = now;
    seat.r = rounds.map(clampScore);
    await store.hSet(seatsKey(post), { [who]: JSON.stringify(seat) });
  }
  return partyState(store, post, who, now);
}

export function guestName(input: unknown): string | null {
  const s = String(input ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  return s.length >= 4 ? `guest-${s}` : null;
}
