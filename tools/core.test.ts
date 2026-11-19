// Rules check for src/server/core.ts on an in-memory store: `npm test`.
import assert from 'node:assert/strict';
import { getInit, partyBeat, partyScore, partyStart, submitRun, type Store } from '../src/server/core';
import { GAME_IDS, GAME_META, lineupFor, matchLength, roundsFromIds } from '../src/shared/daily';

function memory(): Store {
  const hs = new Map<string, Map<string, string>>();
  const zs = new Map<string, Map<string, number>>();
  const hash = (k: string) => hs.get(k) ?? hs.set(k, new Map()).get(k)!;
  const zset = (k: string) => zs.get(k) ?? zs.set(k, new Map()).get(k)!;
  const sorted = (k: string) =>
    [...zset(k)].map(([member, score]) => ({ member, score })).sort((a, b) => a.score - b.score);
  return {
    hGet: async (k, f) => hash(k).get(f),
    hSet: async (k, fv) => void Object.entries(fv).forEach(([f, v]) => hash(k).set(f, v)),
    hGetAll: async (k) => Object.fromEntries(hash(k)),
    hDel: async (k, fs) => void fs.forEach((f) => hash(k).delete(f)),
    zAdd: async (k, ...ms) => void ms.forEach((m) => zset(k).set(m.member, m.score)),
    zScore: async (k, m) => zset(k).get(m),
    zRank: async (k, m) => {
      const i = sorted(k).findIndex((r) => r.member === m);
      return i < 0 ? undefined : i;
    },
    zCard: async (k) => zset(k).size,
    zRange: async (k, a, b, o) => (o.reverse ? sorted(k).reverse() : sorted(k)).slice(a, b + 1),
  };
}

const s = memory();
const d1 = '2026-11-19', d2 = '2026-11-20', d4 = '2026-11-22';

// Lineups are deterministic per day and differ between days.
assert.deepEqual(lineupFor(d1), lineupFor(d1));
assert.notDeepEqual(lineupFor(d1).map((r) => r.seed), lineupFor(d2).map((r) => r.seed));
assert.equal(new Set(lineupFor(d1).map((r) => r.id)).size, 5);

// First run counts, ranks, and starts a streak.
let r = await submitRun(s, { username: 'ann', day: d1, today: d1, rounds: [1000, 500, 0, 250, 250] });
assert.deepEqual([r.saved, r.total, r.rank, r.streak, r.players], [true, 2000, 1, 1, 1]);
r = await submitRun(s, { username: 'bob', day: d1, today: d1, rounds: [1000, 1000, 0, 250, 250] });
assert.deepEqual([r.rank, r.leaderboard.map((e) => e.name)], [1, ['bob', 'ann']]);

// A second run the same day is not saved and does not change the score.
r = await submitRun(s, { username: 'ann', day: d1, today: d1, rounds: [1000, 1000, 1000, 1000, 1000] });
assert.deepEqual([r.saved, r.total, r.rank, r.streak], [false, 2000, 2, 1]);

// Logged-out players get a total but never reach the board.
r = await submitRun(s, { username: null, day: d1, today: d1, rounds: [1, 1, 1, 1, 1] });
assert.deepEqual([r.saved, r.rank, r.players], [false, null, 2]);

// Next day extends the streak; skipping a day resets it; an old post never touches it.
r = await submitRun(s, { username: 'ann', day: d2, today: d2, rounds: [100, 100, 100, 100, 100] });
assert.deepEqual([r.streak, r.best], [2, 2000]);
assert.equal((await getInit(s, { username: 'ann', day: d4, today: d4, now: 0 })).streak, 0);
r = await submitRun(s, { username: 'ann', day: d1.replace('19', '18'), today: d4, rounds: [9, 9, 9, 9, 9] });
assert.equal(r.streak, 0);
r = await submitRun(s, { username: 'ann', day: d4, today: d4, rounds: [9, 9, 9, 9, 9] });
assert.equal(r.streak, 1);

// Rivals: real runs from other players first, bots fill the rest, never yourself.
const init = await getInit(s, { username: 'ann', day: d1, today: d1, now: 0 });
assert.equal(init.rivals.length, 3);
assert.ok(init.rivals.some((x) => x.name === 'bob' && !x.bot));
assert.ok(!init.rivals.some((x) => x.name === 'ann'));
assert.deepEqual(init.myRun, { rounds: [1000, 500, 0, 250, 250], total: 2000 });

// A day's lineup is frozen on first open: five known games, same on every later open.
assert.equal(init.lineup.length, 5);
assert.deepEqual((await getInit(s, { username: 'bob', day: d1, today: d2, now: 0 })).lineup, init.lineup);
await s.hSet('lineups', { [d4]: JSON.stringify(['upvote', 'gone', 'peak', 'poll', 'flair']) });
const old = (await getInit(s, { username: null, day: d4, today: d4, now: 0 })).lineup;
assert.deepEqual(old, ['upvote', 'gone', 'peak', 'poll', 'flair'], 'stored ids are returned untouched');
assert.equal(roundsFromIds(d4, old).filter((r) => GAME_META[r.id]).length, 5, 'unknown ids get a substitute');

// Variety rule: with enough games, never two of the same kind back to back.
for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
  const kinds = lineupFor(seed).map((r) => GAME_META[r.id].kind);
  assert.equal(new Set(lineupFor(seed).map((r) => r.id)).size, 5);
  if (GAME_IDS.length >= 20) kinds.forEach((k, i) => i && assert.notEqual(k, kinds[i - 1], `seed ${seed}: ${kinds}`));
}

// Party: lobby → start → late joiner seated → scores → back to lobby when over.
let now = 1_000_000;
let p = await partyBeat(s, 't3_x', 'ann', now);
assert.deepEqual([p.status, p.players.map((x) => x.name)], ['lobby', ['ann']]);
await partyBeat(s, 't3_x', 'bob', now);
p = await partyStart(s, 't3_x', 'ann', now);
assert.equal(p.status, 'running');
const id = p.id;
assert.equal((await partyStart(s, 't3_x', 'bob', now + 10)).id, id, 'a second START must not restart');
p = await partyBeat(s, 't3_x', 'bob', now + 100, id);
assert.deepEqual(p.players.map((x) => [x.name, x.inMatch]), [['ann', true], ['bob', true]]);
p = await partyScore(s, 't3_x', 'bob', now + 9000, id, [800]);
assert.deepEqual(p.players[0], { name: 'bob', inMatch: true, rounds: [800] });
p = await partyScore(s, 't3_x', 'cat', now + 9000, id, [999]);
assert.ok(!p.players.some((x) => x.name === 'cat'), 'cannot score without a seat');
now += 5000 + matchLength(lineupFor(id)) + 2000;
p = await partyBeat(s, 't3_x', 'ann', now);
assert.equal(p.status, 'lobby');
assert.notEqual((await partyStart(s, 't3_x', 'ann', now)).id, id);

console.log('core rules: all checks passed');
