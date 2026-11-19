// Local stand-in for Reddit: serves the mock client build and runs the real
// server rules (src/server/core.ts) on an in-memory store.
//   npm run mock   →  http://localhost:5199/splash.html?u=alice
import express from 'express';
import path from 'node:path';
import { feedChannel, partyChannel } from '../src/shared/api';
import { dayKey } from '../src/shared/daily';
import { cleanRounds, getInit, guestName, partyBeat, partyScore, partyStart, submitRun, type Store } from '../src/server/core';

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

app.get('/api/init', async (req, res) => {
  res.json(await getInit(store, { username: user(req), day: dayKey(), today: dayKey(), now: Date.now() }));
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
  res.json(await partyScore(store, POST, who(req), Date.now(), String(req.body?.matchId ?? ''), req.body?.rounds));
  send(partyChannel(POST), { t: 'sync' });
});

app.use(express.static(path.resolve(process.cwd(), 'dist/mock-client')));
const port = Number(process.env.PORT) || 5199;
app.listen(port, () => console.log(`mock Karma Mash on http://localhost:${port}/splash.html?u=alice`));
