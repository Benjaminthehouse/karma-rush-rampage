# Karma Mash

A daily three-button party game for Reddit, built on Devvit Web.

Every day (UTC) the whole subreddit gets the same five 6–8 second mini-games, picked
and seeded from the date. You get one scored run, a spot on the day's leaderboard and
a streak. Red, green and blue are the only inputs: tap the pads, or use `A` `S` `D`
(also `J` `K` `L`, `1` `2` `3`, arrow keys).

| Mini-game | What you do |
| --- | --- |
| Upvote Crisis | Mash the colour of the arrow to push each post to the front page. Wrong colour costs votes. |
| Mod Queue | Red removes spam, green approves the nice posts, blue locks the fights. |
| Copypasta | Re-type a colour sequence in order. A slip locks you out briefly. |
| Downvote Dodge | Three lanes. Catch upvotes, avoid downvotes. |
| Flair Check | A colour word printed in another colour. The rule (word or ink) changes per day. |
| Poll Results | A cloud of votes flashes up. Call the winning colour. |
| Servers Are Down | Pure mashing, but the same button twice in a row does not count. |
| Peak Hour | Hit the named colour while the sweeping marker is inside it. |

## Modes

- **Daily Run** — the scored run. You race three rivals: recorded runs from other
  players of the same day, padded with labelled house bots while the day is young.
  Standings are shown after every round.
- **Live Party** — one lobby per post. Anyone presses START and everyone in the lobby
  plays a fresh lineup on a shared, server-timed clock, with live standings between
  rounds. Realtime pushes updates; a 2 s poll is the heartbeat and the fallback.
- **Practice** — random lineup, nothing recorded.

## Run it

```bash
npm install
npm test          # server rules on an in-memory store
npm run check     # type-check client and server
npm run mock      # no Reddit needed: http://localhost:5199/splash.html?u=alice
```

`npm run mock` serves the real client against the real server rules
(`src/server/core.ts`) with an in-memory store. `?u=<name>` logs that browser in;
open a second browser profile with another name to try Live Party. In Practice,
`game.html?games=upvote,dodge` forces the lineup.

On Reddit:

```bash
npm run login                 # devvit login
npx devvit playtest r/<your-test-subreddit>
npm run deploy                # check + build + devvit upload
npm run launch                # deploy + devvit publish (submits for review)
```

The first upload registers the app under your account. If the name `karma-mash` is
taken, change `name` in `devvit.json`. Installing the app creates the first post; after
that a scheduler task posts a new one at 00:00 UTC, and moderators can post on demand
from the subreddit menu ("Karma Mash: post today's game").

## Layout

```text
devvit.json            app config: entrypoints, permissions, menu, trigger, daily cron
src/shared/daily.ts    seeded lineup, timeline, game metadata (shared by both sides)
src/shared/api.ts      request/response and realtime message types
src/server/core.ts     leaderboard, streaks, rivals, party lobby (storage-agnostic)
src/server/index.ts    Express routes on Devvit Redis / Realtime / Reddit API
src/client/splash.*    inline post view: lineup, top five, live score feed, PLAY
src/client/main.ts     expanded view: menu, lobby, results, input
src/client/engine.ts   the intro → play → result timeline for one match
src/client/games/*.ts  one file per mini-game
tools/                 build script, mock server, mock Devvit client, rules test
```

## Adding a mini-game

1. Add an id to `GAME_IDS` and an entry to `GAME_META` in `src/shared/daily.ts`.
2. Write `src/client/games/<id>.ts` exporting a `GameFactory`: build DOM into
   `ctx.root`, use only `ctx.rng` for randomness (so every player gets the same
   content), and return `press`, `tick` and `score` (0–1000).
3. Register it in `src/client/games/index.ts` and style it in `style.css`.

## Known gaps

- Scores are computed on the client and only range-checked on the server.
- A daily run is saved when it finishes, so reloading mid-run gives a fresh attempt.
- The Devvit side (Redis, Realtime, scheduler, post creation) is type-checked against
  `@devvit/web` 0.15.4 and `devvit.json` validates against its schema, but it has not
  been run on Reddit yet. Playtest before submitting.
