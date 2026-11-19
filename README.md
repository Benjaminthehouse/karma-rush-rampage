# Karma Rush Rampage

A daily three-button party game for Reddit, built on Devvit Web.

Every day (UTC) the whole subreddit gets the same five rapid-fire mini-games, picked
and seeded from the date. An announcer shouts each command one word at a time, the
round runs for 6-8 seconds, and the score counts up over confetti. You get one scored
run, a spot on the day's leaderboard and a streak.

Red, green and blue are the only inputs. Tap the pads, or on a keyboard:

| Pad | Keys |
| --- | --- |
| Red (left) | `A`, `J`, `1`, `←` |
| Green (middle) | `S`, `K`, `2`, `↓`, `↑` |
| Blue (right) | `D`, `L`, `3`, `→` |

## Modes

- **Daily Run** — the scored run. You race three rivals: recorded runs from other
  players of the same day, padded with labelled house bots while the day is young.
- **Live Party** — one lobby per post. Anyone presses START and everyone in the lobby
  plays a fresh lineup on a shared, server-timed clock, with live standings between
  rounds. Realtime pushes updates; a 2 s poll is the heartbeat and the fallback.
- **Practice** — a random five, or the **Arcade**: browse every mini-game with the
  pads (prev / play / next) and practise one at a time. Nothing is recorded.

## Screens and states

Everything a player can see, for anyone designing it screen by screen. Each is
plain HTML in `src/client/game.html` (or `splash.html`) with its logic in `main.ts`
or `engine.ts`, so the look can change without touching the rules.

| Screen | What it holds |
| --- | --- |
| Splash (inline in the post) | Logo, today's five games, top five, live score feed, PLAY |
| Menu | Daily run / Live party / Practice, streak and best, settings toggles |
| Practice choice | Back / Random five / Arcade |
| Arcade | One game at a time: title, shout, how-to, button labels, your best |
| Lobby | Players in the party, START |
| Countdown | 3, 2, 1 |
| Round intro | Round number, the shout dictated word by word, how-to, button legend |
| Round | HUD (round pips, title, combo, live score), timer, race track, the stage, three pads |
| Round result | Score counting up, verdict, standings |
| Final | Total, verdict, per-round breakdown, leaderboard or party standings |

The race track under the timer shows every player's score in the current round,
live: recorded runs and bots replay as a curve to their final score, and party
players report theirs about once a second.

## The mini-games

Each game lives in three small files and is registered automatically. See
[`GAME_GUIDE.md`](GAME_GUIDE.md) for the contract, the design rules and the
automated play-tester. The current set is whatever is in `src/shared/games/`.

A daily lineup takes five games with at most two of one kind (mash, react, sort,
memory, timing, brain) and never two of a kind back to back. It is frozen the first
time anyone opens that day, so shipping new games never reshuffles a day that
already has scores.

## Sound, voice and lights

- All sound is synthesised with Web Audio (`src/client/sfx.ts`): pad clicks, a
  combo ladder that climbs in pitch, a seeded beat per round that speeds up each
  round, stingers and a fanfare. No audio files.
- The announcer (`src/client/voice.ts`) uses the browser's speech voice where one
  exists. Every word also lands with a synthesised hit, so the intro works without it.
- Sparks, floating text, flashes, screen shake, confetti and the chasing arena
  lights live in `src/client/fx.ts` and `style.css`.
- Three toggles on the menu: SOUND, VOICE, FLASH. FLASH off (or the OS "reduce
  motion" setting) removes flashes, shakes and spinning lights.

## Run it

```bash
npm install
npm test                          # server rules on an in-memory store
npm run check                     # regenerate registries, type-check client and server
node tools/game-check.mjs --all   # play-test every mini-game with bots, in isolation
npm run smoke                     # play every mini-game inside the real app, end to end
npm run mock                      # no Reddit needed: http://localhost:5199/splash.html?u=alice
node tools/build-artifact.mjs     # a static, server-less demo in dist/artifact
```

With no game server behind it (the static demo), the client switches to demo mode:
today's lineup, house-bot rivals, scores kept on the device, Live Party off.

`npm run mock` serves the real client against the real server rules
(`src/server/core.ts`) with an in-memory store. `?u=<name>` logs that browser in;
open a second browser profile with another name to try Live Party. In Practice,
`game.html?games=upvote,dodge` forces the lineup and `&autoplay=1` lets a demo bot
play (practice and arcade only; scored runs ignore it).

On Reddit:

```bash
npm run login                 # devvit login
npx devvit playtest r/<your-test-subreddit>
npm run deploy                # check + build + devvit upload
npm run launch                # deploy + devvit publish (submits for review)
```

The first upload registers the app under your account. If the app name in
`devvit.json` is taken, change it. Installing the app creates the first post; after
that a scheduler task posts a new one at 00:00 UTC, and moderators can post on demand
from the subreddit menu.

## Layout

```text
devvit.json                 app config: entrypoints, permissions, menu, trigger, daily cron
GAME_GUIDE.md               how to write a mini-game
src/shared/games/<id>.ts    one metadata file per mini-game
src/shared/daily.ts         seeded lineup, timeline, bots (shared by both sides)
src/shared/api.ts           request/response and realtime message types
src/server/core.ts          leaderboard, streaks, rivals, frozen lineups, party lobby
src/server/index.ts         Express routes on Devvit Redis / Realtime / Reddit API
src/client/games/<id>.ts    one game per file, with <id>.css beside it
src/client/engine.ts        the intro → play → result timeline for one match
src/client/sfx.ts, voice.ts, fx.ts   sound, announcer, effects
src/client/main.ts          menu, lobby, results, input
src/client/splash.*         inline post view: lineup, top five, live score feed, PLAY
src/client/bot.ts           demo player that follows a game's hint (practice only)
tools/game-check.mjs        automated play-tester (bots, layout checks, screenshots)
tools/smoke.mjs             end-to-end run of every game in the real app
tools/                      build script, registry generator, mock server, rules test
```

## A note on the name

Reddit's Devvit rules do not allow "Reddit" or "Snoo" in an app's name or branding
without written approval, so the game is not called "Reddit" anything.

## Known gaps

- Scores are computed on the client and only range-checked on the server.
- A daily run is saved when it finishes, so reloading mid-run gives a fresh attempt.
- The Devvit side (Redis, Realtime, scheduler, post creation) is type-checked against
  `@devvit/web` 0.15.4 and `devvit.json` validates against its schema, but it has not
  been run on Reddit yet. Playtest before submitting.
- Sound and speech were verified to run without errors, not auditioned by ear.
