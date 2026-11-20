import express, { type Request, type Response } from 'express';
import { telemetryRouter } from '@devvit/analytics/server/reddit';
import { context, createServer, getServerPort, realtime, reddit, redis } from '@devvit/web/server';
import {
  feedChannel,
  partyChannel,
  type FeedMessage,
  type PartyBeat,
  type PartyMessage,
  type PartyScore,
  type SocialResponse,
  type SubmitRequest,
} from '../shared/api';
import { GAME_META, dayKey, prettyDay } from '../shared/daily';
import {
  cleanRounds,
  avatarKnown,
  getInit,
  guestName,
  hasShared,
  markFlair,
  markShared,
  partyBeat,
  partyScore,
  partyStart,
  setAvatar,
  shareText,
  streakFlair,
  submitRun,
  wantsFlair,
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

/** Looks a player's Reddit avatar up the first time they are seen, and remembers it. */
async function rememberAvatar(name: string | null) {
  if (!name || (await avatarKnown(store, name))) return;
  try {
    await setAvatar(store, name, await reddit.getSnoovatarUrl(name));
  } catch (err) {
    console.error(`avatar lookup for ${name} failed`, err);
  }
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
    const name = await username();
    const day = postDay();
    await rememberAvatar(name);
    const init = await getInit(store, { username: name, day, today: dayKey(), now: Date.now() });
    res.json({
      ...init,
      subreddit: context.subredditName,
      shared: name ? await hasShared(store, day, name) : false,
      flair: name ? await wantsFlair(store, name) : false,
    });
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
    if (out.saved && name) {
      await push<FeedMessage>(feedChannel(day), { t: 'score', name, total: out.total });
      // A player who wears the flair gets it refreshed with their new streak and best.
      if (await wantsFlair(store, name)) {
        try {
          await reddit.setUserFlair({ subredditName: context.subredditName, username: name, text: streakFlair(out.streak, out.best) });
        } catch (err) {
          console.error('flair refresh failed', err);
        }
      }
    }
    res.json(out);
  })
);

// ------------------------------------------------- result card: community

const social = (fn: (name: string) => Promise<SocialResponse>) =>
  route(async (_req, res) => {
    const name = await username();
    if (!name) {
      res.json({ ok: false, message: 'Log in to do that' } satisfies SocialResponse);
      return;
    }
    res.json(await fn(name));
  });

/** Posts the player's score under the day's post: as them where Reddit allows it, else from the app. */
router.post(
  '/api/share',
  social(async (name) => {
    const day = postDay();
    const post = context.postId;
    const init = await getInit(store, { username: name, day, today: dayKey(), now: Date.now() });
    const text = shareText(init, (id) => GAME_META[id]?.title ?? id);
    if (!post || !text) return { ok: false, message: 'Play today’s run first' };
    if (await hasShared(store, day, name)) return { ok: true, message: 'Already posted' };
    try {
      await reddit.submitComment({ id: post, text, runAs: 'USER' });
    } catch (err) {
      console.error('comment as user failed, posting from the app', err);
      await reddit.submitComment({ id: post, text: `u/${name} scored ${text}` });
    }
    await markShared(store, day, name);
    return { ok: true, message: 'Posted to the comments' };
  })
);

router.post(
  '/api/join',
  social(async () => {
    try {
      await reddit.subscribeToCurrentSubreddit();
    } catch (err) {
      // Shown to the player for now, so a failed join can be diagnosed from a playtest.
      console.error('subscribe failed', err);
      return { ok: false, message: `Could not join: ${err instanceof Error ? err.message : String(err)}`.slice(0, 160) };
    }
    return { ok: true, message: `Joined r/${context.subredditName}` };
  })
);

/** Opt-in: the player asks to wear their streak as flair in this community. */
router.post(
  '/api/flair',
  social(async (name) => {
    const init = await getInit(store, { username: name, day: postDay(), today: dayKey(), now: Date.now() });
    const text = streakFlair(init.streak, init.best);
    await reddit.setUserFlair({ subredditName: context.subredditName, username: name, text });
    await markFlair(store, name);
    return { ok: true, message: `Flair set: ${text}` };
  })
);

async function partyWho(body: PartyBeat): Promise<string | null> {
  const name = await username();
  await rememberAvatar(name);
  return name ?? guestName(body?.guest);
}

function partyRoute(
  fn: (post: string, who: string, body: PartyBeat & Partial<PartyScore>) => ReturnType<typeof partyBeat>,
  notify: boolean | 'onRoundEnd'
) {
  return route(async (req, res) => {
    const post = context.postId;
    const who = await partyWho(req.body);
    if (!post || !who) {
      res.status(400).json({ status: 'error', message: 'Party needs a post and a player' });
      return;
    }
    const state = await fn(post, who, req.body ?? {});
    // A finished round is news for everyone; a mid-round progress ping is not worth a broadcast.
    const midRound = notify === 'onRoundEnd' && Number((req.body as PartyScore)?.live) > 0;
    if (notify && !midRound) await push<PartyMessage>(partyChannel(post), { t: 'sync' });
    res.json(state);
  });
}

router.post('/api/party/beat', partyRoute((post, who, b) => partyBeat(store, post, who, Date.now(), b.matchId), false));
router.post('/api/party/start', partyRoute((post, who) => partyStart(store, post, who, Date.now()), true));
router.post(
  '/api/party/score',
  partyRoute((post, who, b) => partyScore(store, post, who, Date.now(), String(b.matchId ?? ''), b.rounds, b.live), 'onRoundEnd')
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
// Devvit Journeys: the client's journey events arrive on /api/telemetry/*.
app.use(telemetryRouter);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
