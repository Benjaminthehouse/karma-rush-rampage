// Rules check for src/server/core.ts on an in-memory store: `npm test`.
import assert from 'node:assert/strict';
import { getInit, partyBeat, partyReady, partyScore, partyStart, setAvatar, submitRun, type Store } from '../src/server/core';
import { GAME_IDS, GAME_META, GO_MS, READY_WAIT, ROUNDS, TIMING, goTimes, lineupFor, matchLength, partyClock, roundsFromIds, timeline } from '../src/shared/daily';

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
    hSetNX: async (k, f, v) => void (hash(k).has(f) || hash(k).set(f, v)),
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
assert.deepEqual(p.players[0], { name: 'bob', inMatch: true, rounds: [800], live: 0 });
// A mid-round progress ping shows up as `live` for the others' race track.
p = await partyScore(s, 't3_x', 'bob', now + 9500, id, [800], 430);
assert.equal(p.players.find((x) => x.name === 'bob')!.live, 430);
p = await partyScore(s, 't3_x', 'bob', now + 9600, id, [800]);
assert.equal(p.players.find((x) => x.name === 'bob')!.live, 0);
p = await partyScore(s, 't3_x', 'cat', now + 9000, id, [999]);
assert.ok(!p.players.some((x) => x.name === 'cat'), 'cannot score without a seat');
// Nobody tapped READY, so every round waited out its full time before going.
now += 5000 + matchLength(lineupFor(id)) + ROUNDS * READY_WAIT - 2000;
assert.equal((await partyBeat(s, 't3_x', 'ann', now)).status, 'running');
now += 4000;
p = await partyBeat(s, 't3_x', 'ann', now);
assert.equal(p.status, 'lobby');
assert.notEqual((await partyStart(s, 't3_x', 'ann', now)).id, id);

// ---- party ready-up: each round's instructions wait until everyone has tapped READY
{
  const s = memory();
  const post = 't3_r';
  let now = 5_000_000;
  await partyBeat(s, post, 'ann', now);
  await partyBeat(s, post, 'bob', now);
  let p = await partyStart(s, post, 'ann', now);
  const id = p.id;
  const lineup = lineupFor(id);
  const tl = timeline(lineup);
  p = await partyBeat(s, post, 'bob', now + 100, id);
  const startAt = p.startAt;
  const deadline = startAt + TIMING.intro + READY_WAIT;
  assert.equal(p.go[0], deadline, 'an unsettled round goes at its deadline');
  assert.equal(p.gate, -1, 'nothing to be ready for during the countdown');
  assert.equal((await partyReady(s, post, 'ann', now + 200, id, 0)).fresh, false, 'no READY before the instructions');

  // Instructions up: ann taps, bob has not.
  now = startAt + 2500;
  await partyBeat(s, post, 'bob', now, id);
  let r = await partyReady(s, post, 'ann', now, id, 0);
  assert.equal(r.fresh, true);
  assert.equal(r.state.gate, 0);
  assert.equal(r.state.go[0], deadline, 'one of two ready does not start the round');
  assert.deepEqual(r.state.players.map((x) => [x.name, !!x.ready]), [['ann', true], ['bob', false]]);
  assert.equal((await partyReady(s, post, 'ann', now + 50, id, 0)).fresh, false, 'a repeat is not news');
  // The shared clock stands still, GO_MS short of the end of the intro.
  assert.equal(partyClock(now + 3000, startAt, lineup, r.state.go), tl[0].end - GO_MS);
  // A heartbeat must not undo the tap.
  await partyBeat(s, post, 'ann', now + 300, id);

  // bob taps: the round gets a start time a beat from now, the same for both.
  now += 3000;
  await partyBeat(s, post, 'ann', now, id);
  r = await partyReady(s, post, 'bob', now, id, 0);
  const go0 = r.state.go[0];
  assert.equal(go0, now + 1200);
  assert.equal(r.state.gate, -1);
  assert.equal((await partyBeat(s, post, 'ann', now + 100, id)).go[0], go0);
  assert.equal(partyClock(go0, startAt, lineup, r.state.go), tl[1].start, 'play starts at the go time');
  assert.equal(partyClock(go0 - GO_MS, startAt, lineup, r.state.go), tl[0].end - GO_MS);
  assert.equal(partyClock(go0 + 700, startAt, lineup, r.state.go), tl[1].start + 700);

  // Round 2: bob has left. ann alone being ready is enough once bob has gone quiet.
  const intro1 = go0 + GAME_META[lineup[0].id].duration + TIMING.result;
  assert.equal(partyClock(intro1, startAt, lineup, r.state.go), tl[3].start);
  now = intro1 + 2600;
  await partyBeat(s, post, 'ann', now, id);
  await partyBeat(s, post, 'bob', now - 500, id);
  r = await partyReady(s, post, 'ann', now, id, 0);
  assert.equal(r.fresh, false, 'a tap for a round that has gone is ignored');
  r = await partyReady(s, post, 'ann', now, id, 1);
  assert.equal(r.state.gate, 1, 'bob was heard from too recently to be skipped');
  now += 7000;
  p = await partyBeat(s, post, 'ann', now, id);
  assert.equal(p.go[1], now + 1200, 'the player who is still here is not held up');

  // The clock never runs backwards as go times arrive, and covers the whole timeline.
  const go = goTimes(startAt, lineup, [go0, p.go[1]]);
  let last = -Infinity;
  for (let t = startAt - 3000; t < go[ROUNDS - 1] + 60_000; t += 37) {
    const m = partyClock(t, startAt, lineup, go);
    assert.ok(m >= last, `clock ran backwards at ${t - startAt}`);
    last = m;
  }
  assert.ok(last > tl[tl.length - 1].end);
  assert.equal(partyClock(startAt - 1000, startAt, lineup, go), -1000, 'counts down before the start');

  // A new match on the same post starts with a clean slate.
  now = go[ROUNDS - 1] + 60_000;
  p = await partyStart(s, post, 'ann', now);
  assert.notEqual(p.id, id);
  assert.equal(p.go[0], p.startAt + TIMING.intro + READY_WAIT);
}

// ---- rivals come from the leaderboard: the leader, the top quarter, the middle
{
  const s = memory();
  const day = '2030-01-01';
  for (let i = 1; i <= 20; i++) {
    // player p01 is the best, p20 the worst
    await submitRun(s, { username: `p${String(i).padStart(2, '0')}`, day, today: day, rounds: [1000 - i * 40, 500, 500, 500, 500] });
  }
  await setAvatar(s, 'p01', 'https://example.test/p01.png');
  const fresh = await getInit(s, { username: 'newbie', day, today: day, now: 0 });
  assert.deepEqual(fresh.rivals.map((r) => [r.name, r.rank]), [['p01', 1], ['p05', 5], ['p10', 10]]);
  assert.equal(fresh.rivals[0].avatar, 'https://example.test/p01.png');
  assert.ok(!('avatar' in fresh.rivals[1]));
  assert.equal(fresh.leaderboard[0].avatar, 'https://example.test/p01.png');
  // the leader does not race themselves: the next one down steps in
  const leader = await getInit(s, { username: 'p01', day, today: day, now: 0 });
  assert.deepEqual(leader.rivals.map((r) => r.name), ['p02', 'p05', 'p10']);
  console.log('rivals: leader, top quarter and middle of the board');
}

console.log('core rules: all checks passed');
