// Game rules that live on the server, written against a tiny key-value
// interface so the exact same code runs on Devvit Redis and in the local mock.
import type { InitResponse, LbEntry, PartyPlayer, PartyState, Rival, SubmitResponse } from '../shared/api';
import {
  ROUNDS,
  botRounds,
  clampScore,
  hashStr,
  goTimes,
  introAt,
  lineupFor,
  mulberry32,
  partyEnd,
  prevDayKey,
} from '../shared/daily';

export interface Store {
  hGet(key: string, field: string): Promise<string | undefined | null>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<unknown>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<unknown>;
  /** Sets the field only if it is not there yet. */
  hSetNX(key: string, field: string, value: string): Promise<unknown>;
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

// Reddit avatars, remembered per player. '' means "looked up, has none".
const AVATARS = 'avatars';
export const avatarKnown = async (store: Store, name: string) => (await store.hGet(AVATARS, name)) != null;
export const setAvatar = (store: Store, name: string, url: string | undefined) => store.hSet(AVATARS, { [name]: url ?? '' });
const avatarOf = async (store: Store, name: string | null) => (name ? (await store.hGet(AVATARS, name)) || undefined : undefined);
/** `{ avatar }` when the player has one, else nothing: no stray undefined fields go over the wire. */
const withAvatar = async (store: Store, name: string | null) => {
  const avatar = await avatarOf(store, name);
  return avatar ? { avatar } : {};
};

async function top(store: Store, day: string, n = 10): Promise<LbEntry[]> {
  const rows = await store.zRange(lbKey(day), 0, n - 1, { by: 'rank', reverse: true });
  return Promise.all(rows.map(async (r, i) => ({ name: r.member, score: r.score, rank: i + 1, ...(await withAvatar(store, r.member)) })));
}

async function rankOf(store: Store, day: string, name: string | null, players: number) {
  if (!name) return null;
  const asc = await store.zRank(lbKey(day), name);
  return asc === undefined || asc === null ? null : players - asc;
}

/** Up to three recorded runs from other players of this day, padded with house bots. */
/**
 * Who a player races. Not a random draw: the day's leader, someone from the top quarter and
 * someone from the middle of the pack. So the race means what the leaderboard means: beat
 * all three and you are top of the day, beat the middle one and you are in the top half.
 * House bots fill in while fewer than three other people have played.
 */
async function pickRivals(store: Store, day: string, me: string | null, players: number) {
  const rivals: Rival[] = [];
  const wanted = [1, Math.max(2, Math.round(players * 0.25)), Math.max(3, Math.round(players * 0.5))];
  const taken = new Set<number>();
  for (const want of wanted) {
    // Slide down the board past the player themselves and anyone already picked.
    for (let rank = want; rank <= players && rank < want + 4; rank++) {
      if (taken.has(rank)) continue;
      const [row] = await store.zRange(lbKey(day), rank - 1, rank - 1, { by: 'rank', reverse: true });
      if (!row || row.member === me) continue;
      const raw = await store.hGet(runsKey(day), row.member);
      const rounds = raw ? cleanRounds(JSON.parse(raw)) : null;
      if (!rounds) continue;
      taken.add(rank);
      rivals.push({ name: row.member, rounds, rank, ...(await withAvatar(store, row.member)) });
      break;
    }
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

/**
 * A day's lineup is frozen the first time anyone opens it, so shipping new
 * mini-games later never reshuffles a day that already has scores.
 */
async function dayLineup(store: Store, day: string): Promise<string[]> {
  const saved = await store.hGet('lineups', day);
  if (saved) {
    try {
      const ids = JSON.parse(saved);
      if (Array.isArray(ids) && ids.length === ROUNDS) return ids.map(String);
    } catch {
      /* fall through and re-roll */
    }
  }
  const ids = lineupFor(day).map((r) => r.id);
  await store.hSet('lineups', { [day]: JSON.stringify(ids) });
  return ids;
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
    ...(await withAvatar(store, p.username)),
    day: p.day,
    isToday: p.day === p.today,
    lineup: await dayLineup(store, p.day),
    myRun: rounds ? { rounds, total: sum(rounds) } : null,
    ...stats,
    leaderboard: await top(store, p.day),
    rank: await rankOf(store, p.day, p.username, players),
    players,
    rivals: await pickRivals(store, p.day, p.username, players),
    now: p.now,
  };
}

const sharedKey = (day: string) => `shared:${day}`;

/** Whether the player already posted this day's score as a comment. */
export const hasShared = async (store: Store, day: string, username: string) => !!(await store.hGet(sharedKey(day), username));
export const markShared = (store: Store, day: string, username: string) => store.hSet(sharedKey(day), { [username]: '1' });

/** The comment a player posts under the day's post: their total, rank, streak and round scores. */
export function shareText(init: InitResponse, titles: (id: string) => string): string | null {
  if (!init.myRun) return null;
  const head = [`**${init.myRun.total.toLocaleString('en-US')}** points`];
  if (init.rank) head.push(`#${init.rank} of ${init.players.toLocaleString('en-US')}`);
  if (init.streak > 1) head.push(`${init.streak}-day streak`);
  const rounds = init.lineup.map((id, i) => `${titles(id)} ${init.myRun!.rounds[i] ?? 0}`).join(' · ');
  return `${head.join(' · ')}\n\n${rounds}\n\nBeat that.`;
}

/** The flair a player can choose to wear for their streak. Commas are not allowed in flair text. */
/**
 * The flair a player can choose to wear in this community. It stays until it is changed,
 * so it reads as a record, not as news about today, and it is refreshed after every run.
 * Commas are not allowed in flair text, so the best score has no thousands separator.
 */
export const streakFlair = (streak: number, best: number) => `Rush streak ${Math.max(1, streak)} · best ${best}`;
/** Whether the player opted in to wearing the flair; once they have, every saved run refreshes it. */
export const wantsFlair = async (store: Store, name: string) => (await store.hGet(userKey(name), 'flair')) === '1';
export const markFlair = (store: Store, name: string) => store.hSet(userKey(name), { flair: '1' });

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

type Seat = { hb: number; m: string; r: number[]; p: number };

const LOBBY_TTL = 12_000;
const SEAT_TTL = 5 * 60_000;
export const PARTY_COUNTDOWN = 5000;

const metaKey = (post: string) => `party:${post}:meta`;
const seatsKey = (post: string) => `party:${post}:seats`;

function parseSeat(raw: string | undefined | null): Seat {
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === 'object') {
      return { hb: Number(s.hb) || 0, m: String(s.m ?? ''), r: Array.isArray(s.r) ? s.r.map(clampScore) : [], p: clampScore(s.p) };
    }
  } catch {
    /* fall through to an empty seat */
  }
  return { hb: 0, m: '', r: [], p: 0 };
}

/** From "everyone is ready" to the round starting: time for the news to reach every phone. */
const GO_LEAD = 1200;
/** A seat that has not been heard from for this long does not hold the others up. */
const AWAY_TTL = 7000;
/** Nobody can be ready before the instructions have had this long on screen. */
const MIN_READ = 1500;

const readyKey = (post: string) => `party:${post}:ready`;

async function readMeta(store: Store, post: string, now: number) {
  const meta = await store.hGetAll(metaKey(post));
  const id = meta.id ?? '';
  const startAt = Number(meta.startAt) || 0;
  const lineup = id ? lineupFor(id) : [];
  const settled = lineup.map((_, r) => Number(meta[`go${r}`]) || undefined);
  const go = goTimes(startAt, lineup, settled);
  const running = !!id && now < partyEnd(startAt, lineup, go) + 1500;
  // The gate: the round whose instructions are up, with no start time fixed yet.
  let gate = -1;
  if (running) {
    gate = lineup.findIndex((_, r) => settled[r] === undefined && now >= introAt(startAt, lineup, go, r) && now < go[r]);
  }
  return { id, startAt, running, lineup, go, gate };
}

async function partyState(store: Store, post: string, who: string, now: number): Promise<PartyState> {
  let meta = await readMeta(store, post, now);
  const all = await store.hGetAll(seatsKey(post));
  const tapped = meta.gate >= 0 ? await store.hGetAll(readyKey(post)) : {};
  const want = `${meta.id}:${meta.gate}`;
  const players: PartyPlayer[] = [];
  const dead: string[] = [];
  let here = 0; // players in the match who are still around
  let waiting = 0; // and how many of those have not tapped READY
  for (const [name, raw] of Object.entries(all)) {
    const seat = parseSeat(raw);
    const inMatch = !!meta.id && seat.m === meta.id;
    const age = now - seat.hb;
    if (age > SEAT_TTL && !(inMatch && meta.running)) dead.push(name);
    else if (age < LOBBY_TTL || inMatch) {
      const ready = inMatch && meta.gate >= 0 && tapped[name] === want;
      if (inMatch && age < AWAY_TTL) {
        here++;
        if (!ready) waiting++;
      }
      players.push({
        name,
        inMatch,
        rounds: inMatch ? seat.r : [],
        live: inMatch ? seat.p : 0,
        ...(ready ? { ready } : {}),
        ...(await withAvatar(store, name)),
      });
    }
  }
  if (dead.length) {
    await store.hDel(seatsKey(post), dead);
    await store.hDel(readyKey(post), dead);
  }
  if (meta.gate >= 0 && here > 0 && waiting === 0) {
    // Everyone still here is ready: fix this round's start. The first write wins, so
    // players asking at the same moment all get the same answer.
    const earliest = introAt(meta.startAt, meta.lineup, meta.go, meta.gate) + MIN_READ;
    const at = Math.min(Math.max(now + GO_LEAD, earliest), meta.go[meta.gate]);
    await store.hSetNX(metaKey(post), `go${meta.gate}`, String(at));
    meta = await readMeta(store, post, now);
    for (const pl of players) delete pl.ready;
  }
  players.sort((a, b) => sum(b.rounds) - sum(a.rounds) || a.name.localeCompare(b.name));
  return {
    id: meta.id,
    status: meta.running ? 'running' : 'lobby',
    startAt: meta.startAt,
    go: meta.go,
    gate: meta.gate,
    now,
    you: who,
    players,
  };
}

/** Heartbeat. Passing the current match id (before its first round ends) takes a seat in it. */
export async function partyBeat(store: Store, post: string, who: string, now: number, matchId?: string) {
  const meta = await readMeta(store, post, now);
  const seat = parseSeat(await store.hGet(seatsKey(post), who));
  seat.hb = now;
  if (matchId && matchId === meta.id && meta.running && seat.m !== matchId) {
    seat.m = matchId;
    seat.r = [];
    seat.p = 0;
  }
  await store.hSet(seatsKey(post), { [who]: JSON.stringify(seat) });
  return partyState(store, post, who, now);
}

export async function partyStart(store: Store, post: string, who: string, now: number) {
  const meta = await readMeta(store, post, now);
  if (!meta.running) {
    const id = `${post}-${now.toString(36)}`;
    await store.hDel(metaKey(post), Array.from({ length: ROUNDS }, (_, r) => `go${r}`));
    await store.hSet(metaKey(post), { id, startAt: String(now + PARTY_COUNTDOWN) });
    await store.hSet(seatsKey(post), { [who]: JSON.stringify({ hb: now, m: id, r: [], p: 0 } satisfies Seat) });
  }
  return partyState(store, post, who, now);
}

export async function partyScore(
  store: Store,
  post: string,
  who: string,
  now: number,
  matchId: string,
  rounds: unknown,
  live?: unknown
) {
  const seat = parseSeat(await store.hGet(seatsKey(post), who));
  if (seat.m === matchId && Array.isArray(rounds) && rounds.length <= ROUNDS) {
    seat.hb = now;
    seat.r = rounds.map(clampScore);
    // Score so far in the round being played, for everyone else's race track.
    seat.p = clampScore(live);
    await store.hSet(seatsKey(post), { [who]: JSON.stringify(seat) });
  }
  return partyState(store, post, who, now);
}

/**
 * A player has read the instructions for `round` and tapped READY. When the last player
 * does, the round's start is fixed (in `partyState`). Returns whether this was news.
 */
export async function partyReady(
  store: Store,
  post: string,
  who: string,
  now: number,
  matchId: string,
  round: unknown
): Promise<{ state: PartyState; fresh: boolean }> {
  const meta = await readMeta(store, post, now);
  const seat = parseSeat(await store.hGet(seatsKey(post), who));
  let fresh = false;
  if (meta.gate >= 0 && round === meta.gate && matchId === meta.id && seat.m === matchId) {
    const mark = `${matchId}:${round}`;
    fresh = (await store.hGet(readyKey(post), who)) !== mark;
    // Its own hash, one field per player, so a heartbeat landing at the same time cannot undo it.
    if (fresh) await store.hSet(readyKey(post), { [who]: mark });
  }
  return { state: await partyState(store, post, who, now), fresh };
}

export function guestName(input: unknown): string | null {
  const s = String(input ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  return s.length >= 4 ? `guest-${s}` : null;
}
