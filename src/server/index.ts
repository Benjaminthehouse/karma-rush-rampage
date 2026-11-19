import express, { type Request, type Response } from 'express';
import { context, createServer, getServerPort, realtime, reddit, redis } from '@devvit/web/server';
import {
  feedChannel,
  partyChannel,
  type FeedMessage,
  type PartyBeat,
  type PartyMessage,
  type PartyScore,
  type SubmitRequest,
} from '../shared/api';
import { GAME_META, dayKey, prettyDay } from '../shared/daily';
import {
  cleanRounds,
  getInit,
  guestName,
  partyBeat,
  partyScore,
  partyStart,
  submitRun,
  type Store,
} from './core';

const store: Store = redis;

const app = express();
app.use(express.json());
const router = express.Router();

/** The day a post belongs to: stamped on it at creation, else today. */
function postDay(): string {
  const d = context.postData?.day;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dayKey();
}

async function username(): Promise<string | null> {
  return context.username ?? (await reddit.getCurrentUsername()) ?? null;
}

async function push<T extends FeedMessage | PartyMessage>(channel: string, msg: T) {
  try {
    await realtime.send(channel, msg);
  } catch (err) {
    console.error(`realtime send to ${channel} failed`, err);
  }
}

const route =
  (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`${req.method} ${req.path} failed`, err);
      res.status(500).json({ status: 'error', message: 'Something went wrong' });
    }
  };

router.get(
  '/api/init',
  route(async (_req, res) => {
    res.json(
      await getInit(store, { username: await username(), day: postDay(), today: dayKey(), now: Date.now() })
    );
  })
);

router.post(
  '/api/submit',
  route(async (req, res) => {
    const rounds = cleanRounds((req.body as SubmitRequest)?.rounds);
    if (!rounds) {
      res.status(400).json({ status: 'error', message: 'Bad rounds' });
      return;
    }
    const name = await username();
    const day = postDay();
    const out = await submitRun(store, { username: name, day, today: dayKey(), rounds });
    if (out.saved && name) await push<FeedMessage>(feedChannel(day), { t: 'score', name, total: out.total });
    res.json(out);
  })
);

async function partyWho(body: PartyBeat): Promise<string | null> {
  return (await username()) ?? guestName(body?.guest);
}

function partyRoute(
  fn: (post: string, who: string, body: PartyBeat & Partial<PartyScore>) => ReturnType<typeof partyBeat>,
  notify: boolean
) {
  return route(async (req, res) => {
    const post = context.postId;
    const who = await partyWho(req.body);
    if (!post || !who) {
      res.status(400).json({ status: 'error', message: 'Party needs a post and a player' });
      return;
    }
    const state = await fn(post, who, req.body ?? {});
    if (notify) await push<PartyMessage>(partyChannel(post), { t: 'sync' });
    res.json(state);
  });
}

router.post('/api/party/beat', partyRoute((post, who, b) => partyBeat(store, post, who, Date.now(), b.matchId), false));
router.post('/api/party/start', partyRoute((post, who) => partyStart(store, post, who, Date.now()), true));
router.post(
  '/api/party/score',
  partyRoute((post, who, b) => partyScore(store, post, who, Date.now(), String(b.matchId ?? ''), b.rounds), true)
);

// ------------------------------------------------------------- daily posts

async function dayLineupTitles(day: string): Promise<string[]> {
  const init = await getInit(store, { username: null, day, today: day, now: Date.now() });
  return init.lineup.map((id) => GAME_META[id]?.title ?? id);
}

async function createDailyPost(): Promise<{ id: string; created: boolean }> {
  const day = dayKey();
  const existing = await redis.get(`post:${day}`);
  if (existing) return { id: existing, created: false };
  const games = (await dayLineupTitles(day));
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Karma Rush Rampage — ${prettyDay(day)}: ${games.join(' · ')}`,
    entry: 'default',
    postData: { day },
    textFallback: {
      text: `Today's Karma Rush Rampage: ${games.join(', ')}. Five rapid-fire three-button rounds, one shot at the daily leaderboard. Open this post on new Reddit or the app to play.`,
    },
  });
  await redis.set(`post:${day}`, post.id);
  return { id: post.id, created: true };
}

router.post(
  '/internal/menu/post-create',
  route(async (_req, res) => {
    const { id, created } = await createDailyPost();
    res.json({
      showToast: created ? 'Posted today’s Karma Rush Rampage' : 'Today’s Karma Rush Rampage is already up',
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${id.replace(/^t3_/, '')}`,
    });
  })
);

router.post(
  '/internal/on-app-install',
  route(async (_req, res) => {
    await createDailyPost();
    res.json({ status: 'ok' });
  })
);

router.post(
  '/internal/cron/daily-post',
  route(async (_req, res) => {
    await createDailyPost();
    res.json({ status: 'ok' });
  })
);

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
