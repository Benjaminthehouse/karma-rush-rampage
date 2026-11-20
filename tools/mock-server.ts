// Local stand-in for Reddit: serves the mock client build and runs the real
// server rules (src/server/core.ts) on an in-memory store.
//   npm run mock   →  http://localhost:5199/splash.html?u=alice
import express from 'express';
import path from 'node:path';
import { feedChannel, partyChannel } from '../src/shared/api';
import { GAME_META, dayKey } from '../src/shared/daily';
import { cleanRounds, getInit, guestName, hasShared, markFlair, markShared, shareText, streakFlair, wantsFlair, partyBeat, partyScore, partyStart, submitRun, type Store } from '../src/server/core';

const hashes = new Map<string, Map<string, string>>();
const zsets = new Map<string, Map<string, number>>();
const hash = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
const zset = (k: string) => zsets.get(k) ?? zsets.set(k, new Map()).get(k)!;
const sorted = (k: string) =>
  [...zset(k)].map(([member, score]) => ({ member, score })).sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));

const store: Store = {
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
  zRange: async (k, start, stop, o) => {
    const rows = sorted(k);
    if (o.reverse) rows.reverse();
    return rows.slice(start, stop + 1);
  },
};

const listeners = new Map<string, Set<express.Response>>();
const send = (channel: string, msg: unknown) =>
  listeners.get(channel)?.forEach((res) => res.write(`data: ${JSON.stringify(msg)}\n\n`));

const POST = 't3_mockpost';
const app = express();
app.use(express.json());
// `?u=name` on any page logs that browser in as `name`; no cookie = logged out.
const user = (req: express.Request) => /(?:^|;\s*)u=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1] ?? null;
app.use((req, res, next) => {
  if (typeof req.query.u === 'string') res.setHeader('Set-Cookie', `u=${req.query.u.replace(/[^\w-]/g, '')}; Path=/`);
  next();
});

app.get('/mock/realtime', (req, res) => {
  const channel = String(req.query.channel);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  res.write(':ok\n\n');
  const set = listeners.get(channel) ?? listeners.set(channel, new Set()).get(channel)!;
  set.add(res);
  req.on('close', () => set.delete(res));
});

// Journey events are accepted and logged, so the flow can be checked without Reddit.
const journey: string[] = [];
app.get('/mock/journey', (_req, res) => void res.json(journey));
app.post(/^\/api\/telemetry\/journey\/(.+)$/, (req, res) => {
  journey.push(`${req.params[0]} ${JSON.stringify(req.body ?? {})}`);
  res.json({ journeyId: 'journey_mock', receipt: { status: 'JOURNEY_RECEIPT_VALID', message: 'mock' } });
});
app.get('/api/init', async (req, res) => {
  const name = user(req);
  const init = await getInit(store, { username: name, day: dayKey(), today: dayKey(), now: Date.now() });
  res.json({ ...init, subreddit: 'mocksub', shared: name ? await hasShared(store, dayKey(), name) : false, flair: name ? await wantsFlair(store, name) : false });
});
/** Comments "posted" in this session, so a test can read them back. */
const comments: string[] = [];
app.get('/mock/comments', (_req, res) => void res.json(comments));
app.post('/api/share', async (req, res) => {
  const name = user(req);
  if (!name) return void res.json({ ok: false, message: 'Log in to do that' });
  const init = await getInit(store, { username: name, day: dayKey(), today: dayKey(), now: Date.now() });
  const text = shareText(init, (id) => GAME_META[id]?.title ?? id);
  if (!text) return void res.json({ ok: false, message: 'Play today’s run first' });
  if (await hasShared(store, dayKey(), name)) return void res.json({ ok: true, message: 'Already posted' });
  comments.push(`${name}: ${text}`);
  await markShared(store, dayKey(), name);
  res.json({ ok: true, message: 'Posted to the comments' });
});
app.post('/api/join', (_req, res) => void res.json({ ok: true, message: 'Joined r/mocksub' }));
app.post('/api/flair', async (req, res) => {
  const init = await getInit(store, { username: user(req), day: dayKey(), today: dayKey(), now: Date.now() });
  const name = user(req);
  if (name) await markFlair(store, name);
  res.json({ ok: true, message: `Flair set: ${streakFlair(init.streak, init.best)}` });
});
app.post('/api/submit', async (req, res) => {
  const rounds = cleanRounds(req.body?.rounds);
  if (!rounds) return void res.status(400).json({ status: 'error' });
  const out = await submitRun(store, { username: user(req), day: dayKey(), today: dayKey(), rounds });
  if (out.saved) send(feedChannel(dayKey()), { t: 'score', name: user(req), total: out.total });
  res.json(out);
});
const who = (req: express.Request) => user(req) ?? guestName(req.body?.guest) ?? 'guest-anon';
app.post('/api/party/beat', async (req, res) => {
  res.json(await partyBeat(store, POST, who(req), Date.now(), req.body?.matchId));
});
app.post('/api/party/start', async (req, res) => {
  res.json(await partyStart(store, POST, who(req), Date.now()));
  send(partyChannel(POST), { t: 'sync' });
});
app.post('/api/party/score', async (req, res) => {
  res.json(await partyScore(store, POST, who(req), Date.now(), String(req.body?.matchId ?? ''), req.body?.rounds, req.body?.live));
  if (!(Number(req.body?.live) > 0)) send(partyChannel(POST), { t: 'sync' });
});

// Opening the bare address lands in the game, logged in as a default player.
app.get('/', (req, res) => res.redirect(user(req) ? '/game.html' : '/game.html?u=player'));
app.use(express.static(path.resolve(process.cwd(), 'dist/mock-client')));
const port = Number(process.env.PORT) || 5199;
app.listen(port, () => console.log(`mock Karma Rush Rampage on http://localhost:${port}/splash.html?u=alice`));
