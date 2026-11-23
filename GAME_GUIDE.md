# Making a mini-game

A mini-game is 6-8 seconds of one clear idea, played with three buttons, that makes
the player feel fast and clever. This guide is the whole contract. If your game
passes `node tools/game-check.mjs <id>` and looks right in its screenshots, it ships.

## The three files

Pick an id: lowercase letters only (`banhammer`). Everything is named after it.

| File | What it holds |
| --- | --- |
| `src/shared/games/<id>.ts` | The metadata: title, announcer shout, labels, duration. |
| `src/client/games/<id>.ts` | The game: `export const create: GameFactory`. |
| `src/client/games/<id>.css` | Styles, every selector starting with `.g-<id>`. |

Do not edit any other file. The registries are generated from these
(`npm run gen`), and the daily lineup picks from whatever is registered.

Reference games to read first: `upvote` and `selfpromo` (the look to match, and
scoring against a par), then for mechanics `banevasion` (time-driven pop-ups),
`tothemoon` (hold and release), `crosspost` (two-button chords).

### Metadata

```ts
import { defineGame } from '../meta';

export default defineGame({
  id: 'banhammer',
  title: 'Ban Hammer',            // max 22 characters
  shout: 'SMASH THE SPAMMERS!',   // 2-6 words, ALL CAPS, no word over 11 letters
  how: 'Hit the lane a spammer pops up in. Leave the nice users alone.', // max 90 chars
  labels: ['LEFT', 'MID', 'RIGHT'], // red, green, blue; max 9 characters each
  duration: 7000,                 // 6000-8000
  kind: 'react',                  // mash | react | sort | memory | timing | brain
  think: 400,                     // see below
});
```

The announcer dictates `shout` one word at a time before the round, then the game
starts instantly. The shout is the tutorial: a first-time player must know what to
do from those words plus the button labels. Write the shout as a command. If the
speech voice would mangle it, add `say: 'how to pronounce it'`.

`think` is how long a typical player needs between seeing a new prompt and pressing:
about 250 for a visible sequence, 400 for a three-way choice, 550 for a trick rule,
700+ when there is text to read, 1000+ for counting. Use 0 for pure mashing and for
timing games where the player sees the moment coming. The play-tester builds its
"casual player" from this number, so be honest. Set `mashable: true` only when
hitting anything fast is the intended way to score.

### The game

```ts
import './banhammer.css';
import { h, pick, randBtn, ratio, type GameFactory } from './common';

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const wrap = h('div', 'g-banhammer');   // exactly one wrapper, class g-<id>
  root.append(wrap);
  // ...build the round from rng...
  return {
    press(b, t) {},     // b is 0 red, 1 green, 2 blue; t is ms since the round began
    release(b, t) {},   // optional, for hold mechanics
    tick(t) {},         // every animation frame
    score: () => 0,     // integer 0..1000, valid at any moment
    hint: (t) => null,  // what a perfect player would do right now
  };
};
```

`ctx` gives you:

- `root` the empty stage. `rng()` seeded randomness. `level` 0-4 (the round's
  position in the run; later is harder). `duration` in ms. `down[b]` live button state.
- `good(at?, text?)` a correct action: rising combo sound, combo meter, sparks from
  `at`, floating `text`. Call it once per scored unit.
- `bad(at?, text?)` a mistake: buzz, shake, combo reset.
- `fx.burst(at, color, count)`, `fx.pop(at, text, color)`, `fx.flash(color)`,
  `fx.shake()`, `fx.sound(name)` for bigger moments. Colours: red, green, blue, gold,
  white, purple. Sounds: pop, coin, zap, whoosh, thud, tick, power, laser, ding, boing.

Every `good()` plays the game's hit sound, a semitone higher for each hit in a streak.
Which sound that is comes from one table, `src/client/hits.ts`: pick the voice that
matches what the player is doing (`vote`, `coin`, `water`, `key`, `stamp`, `pop`,
`bell`, `zap`, `pluck`, `swipe`, `step`, `sizzle`, `snap`, `horn`, or the default
`blip`) and add a line for your game. `fx.sound(name)` one-offs climb with the streak too.
`fx.note(b)` plays pad `b`'s note without a press, for showing a sequence to copy; list the
game in `FIXED_NOTES` there if each pad should keep one note all round.

`hint(t)` drives the automated play-tester (and never scoring). Return `null` to
wait, a button to tap it now, an array to tap a chord, or `{ hold: [...] }` for the
exact set of buttons that should be held down at this moment.

## Hard rules

The checker enforces these.

1. All randomness from `ctx.rng`. Never `Math.random`. Everyone must get the same round.
2. All time from the `t` you are passed. No `Date`, timers or `requestAnimationFrame`.
   Move things in `tick(t)`; animate with CSS.
3. Render only inside `ctx.root`. Never touch `document` or `window`.
4. Import only `./common` and your own CSS.
5. `score()` is always an integer 0-1000. Doing nothing scores 150 or less. Random
   mashing scores 450 or less and one-button spam 500 or less (unless `mashable`).
   A perfect player (10 presses a second, instant reactions) reaches 950 at level 0
   and 900 at level 4.
6. CSS: every selector starts with `.g-<id>`; keyframes are named `g-<id>-*`; sizes
   in `em`, never `rem` or `px` for layout; no `position: fixed`.
7. All text is at least 11px on a 360x640 phone and stays inside the stage.
   Hide things with `opacity`, `visibility` or `display`, never by parking them
   off-stage: anything positioned outside the stage counts as cut off.
   A window that scrolls long content on purpose (see `rant`) sets `data-scroll`.

## Design rules

These are what make a game feel good. The checker warns on some; a reviewer checks the rest.

- **One idea.** If the shout needs an "and" to explain the rules, cut a rule.
- **Never run out.** Generate more content than anyone can finish and score against
  a par: `ratio(done, par)`. A fast player hits the par near the end; a typical player
  lands at 650-900 on level 0 and 400-850 on level 4. Nobody should sit idle.
- **Every press answers back.** Something moves, fills, pops or breaks on every
  input. Call `good()` and `bad()` so the combo, sound and lights respond.
- **Show the progress.** A meter filling, a stack growing, a counter climbing. The
  player should see they are winning without reading.
- **Pay off the big moments.** Finishing a card, clearing a wave: `fx.burst` with
  more sparks, `fx.pop` with a word, `fx.sound('coin')`.
- **Make mistakes cost, briefly.** Subtract points or lock input for 300-500 ms. No
  instant fail; the round always runs its full length.
- **Get harder with `level`.** Faster, more items, tighter windows, trickier decoys.
  Never new rules.
- **Colour means button.** Red is left, green is middle, blue is right. If the game
  uses colour to mean something else (say, red for "remove"), the label must say so.
- **Big, few, bold.** Two to four elements on screen, large type, high contrast.
  See "Make it a scene" below for how it should look.
- **Keep the joke specific.** Reddit regulars should smirk. Keep it PG. No real
  people, brands, copyrighted characters, logos, lyrics or titles.

## Make it a scene

A mini-game is a little cartoon of the internet, not a control panel. The player
should see a place, someone in it, and a thing happening to them. Read
`upvote` (a post climbs the sky to a FRONT PAGE banner) and `selfpromo` (a mod bear
dozes at the mod desk while your spam piles up) before you draw anything.

- **Put it somewhere.** Give the wrapper a scene class for a bright backdrop:
  `scene-sky` `scene-dusk` `scene-night` `scene-feed` `scene-grid` `scene-office`
  `scene-danger` `scene-grass` `scene-mint` `scene-sun`. They also switch the text
  to the pixel font. Swap the scene class mid-round for drama (alarm goes red).
- **Cast someone.** `person({ tone, kind, hat, mood, px })` is a face with nine
  moods: idle, happy, shock, angry, sleep, sad, cool, wink, dead. Kinds: plain, cat,
  bear, bot. Hats: mod (green cap), horns (a troll), crown. Change `.mood()` when
  things happen: happy on a hit, shock on a miss. A reacting face is half the fun.
- **Show the thing itself changing.** The post rises, the pile grows, the balloon
  swells, the troll gets squashed. A meter alone is not feedback. On every press
  something in the world moves, and `fx.poof(at)` puffs smoke where it jumped,
  landed, appeared or vanished.
- **Use forum furniture for forum things.** `postCard({ sub, user, title, votes,
  tone, avatar, big })` is a post with a vote rail; `comment({ user, text, depth,
  avatar, op, mod })` is a reply. Votes are the `up` sprite (flip it for down), mods
  wear the shield, awards are stars and coins. Affectionate and generic: no logos,
  no mascots, no brand assets.
- **Go big and bright.** The star of the scene is at least a third of the stage
  wide on a phone. Two to four big things, thick dark outlines (`#0b1020`), hard
  offset shadows, square corners, saturated colour. No blur, no soft gradients, no
  thin grey lines on navy.
- **Colour still means button.** Red left, green middle, blue right. Where colour
  alone tells the player what to press, put `padDots(b)` beside it so it also reads
  as left / middle / right.

### The cast and the sets

Characters come from one shared cast, so a character redrawn once changes in every
game. Use `actor(who, { mood, px })` from `./common`; `who` is one of:

| who | is | use for |
| --- | --- | --- |
| `modbear` | the mods (hand-drawn) | judges, bouncers, desk officers, anyone enforcing rules |
| `automod` | grey screen-faced robot | rules, orders, bots, AI |
| `troll` | green, horned | impostors, alts, sarcasm, rug pulls, villains |
| `op` | the poster, a cat | anyone who posts, wants upvotes, races to comment |
| `dev` | hoodie, dark circles | servers, deploys, laptops, vibecoding |
| `ape` | diamond hands | stonks, coins, rockets, jackpots |
| `npc` | identical grey people | crowds, voters, extras |
| `lurker` | hooded, glowing eyes | watchers, detectives, the audience |

Moods: idle, happy, shock, angry, sad, sleep, cool, wink, dead, talk, peep. `px` is one
art pixel in em; every actor is 16 art pixels wide, so `px: 0.5` is 8em. Make the
main character big (a third of the stage wide or more) and change its mood as things
happen. Only draw your own character with `defineSprite` when the game needs one the
cast cannot play (a costume, a prop, a creature).

Backdrops are shared sets too. Put one scene class on the wrapper:
`scene-office` (mod office), `scene-court`, `scene-devcave`, `scene-casino`,
`scene-stage` (party stage), `scene-kitchen`, `scene-street` (feed street at dusk),
`scene-alley` (night), `scene-sky`, `scene-night`. Dark sets (devcave, casino, stage,
alley) set light text; the others dark. They are placeholders until drawn, so build
the scene on top of them rather than painting your own background.

Hand-drawn art lives in `src/client/kit/art/`.

### Sprites

`sprite(name, { tone, flip, flipY, px })` draws pixel art from the shared sheet in
`src/client/kit/sprites.ts`: up, heart, star, coin, comment, shield, hammer, lock,
trash, check, cross, envelope, crown, flame1, flame2, poof1-3, spark, zed, bang,
quest, rocket, cloud, banana, cake, bell, trophy, bug, phone, laptop, server,
cookie, megaphone, skull, bomb, gift, thumb, moon, eye, window. `px` is the size of
one pixel in em (default 0.25, so a 12-pixel sprite is 3em). `tone` recolours the
`A` `a` `L` pixels: red green blue gold orange purple pink teal grey ink brown night.
`setSprite(el, name, opts)` swaps the picture: the next frame, another colour.

Draw what the sheet lacks in your own game file. One character is one pixel:

```ts
defineSprite('banhammer-mole', `
..kkkkkk..
.kAAAAAAk.
kAwkAAwkAk
kAAAAAAAAk
kAAkkkkAAk
.kaaaaaak.
..kkkkkk..`);
```

`.` empty, `k` outline, `w W` white, `d D x` greys, `y Y` gold, `o O` orange,
`r R` red, `g G` green, `b B` blue, `p P` purple, `n N` brown, `c` cyan, `m` pink,
`s` skin, `t` teal, and `A a L` for the tone (main, shade, light). Keep sprites
10-16 pixels across, outline them in `k`, light them from the top left, and name
them `<id>-something`. Every row must be the same length.

## Layout

The stage is about 330x440 on a small phone and 700x450 on desktop. Your wrapper
fills it as a centred flex column; its font size scales with the stage, so size
everything in `em`. Fill the stage: anchor things to the top and bottom rather
than floating one card in the middle. Helpers from `./common`: `h` (make an
element), `pulse(el, cls)` with `pop-in`, `shake` or `bump`, `dealer(rng, items)`
(deals without repeats; use it for every list of titles or names), `pick`,
`shuffled`, `randBtn`, `randInt`, `ratio`, `clamp1000`. Colour classes `c-red`
`c-green` `c-blue` set `--c` and `--cd`. Theme colours are CSS variables:
`--bg --red --green --blue --gold --purple --ink --dim`. Text on a bright scene
should be dark (`#0b1020`); text on a dark panel should be `--ink`.

## Check it

```bash
node tools/game-check.mjs --art banhammer
```

It lints the files, type-checks them alone, then plays the game: a perfect player,
a fast player, a casual player (built from `think`), an idle player, a random
masher, a one-button spammer and a chaos monkey, across levels and seeds. Then it
plays three real-time rounds at phone, small-phone and desktop sizes, checks the
layout and saves screenshots to `dist/check/<id>/`. Look at all three screenshots.
`FAIL` lines must be fixed; `WARN` lines need a reason to ignore. `--art` also
fails a game that has no scene class, no sprites on stage, or sprite names
without its id.

Then play it for real: `npm run mock`, open
`http://localhost:5199/game.html?u=you&games=banhammer`, choose PRACTICE.

## Drawn art

Hand-made art lives in `art/<id>/` (the source files) and, ready for the game, in
`src/client/kit/art/`. Reference it from CSS with `url('../kit/art/<name>.png')`
(from a game) or `url('./art/<name>.png')` (from the kit); every build bundles it.

Pixel art that arrives as an SVG of squares on a grid is converted to a 1x PNG and
scaled up crisply with `image-rendering: pixelated`:

```bash
node tools/pixelize.cjs art/upvote/upvote-bg.svg src/client/kit/art/upvote-bg.png 8
```

The last number is the size of one art pixel in SVG units.
