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

Reference games to read first: `upvote` (mash against a par), `modqueue`
(classify), `copypasta` (sequence), `dodge` (time-driven, uses `tick`), `peak`
(timing window).

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
  Flat shapes built from CSS and inline SVG. No images.
- **Keep the joke specific.** Reddit regulars should smirk. Keep it PG. No real
  people, brands, copyrighted characters, logos, lyrics or titles.

## Layout

The stage is about 330x440 on a small phone and 700x450 on desktop. Your wrapper is
a centred flex column filling it; its font size scales with the stage, so size
everything in `em`. Shared helpers you may use: `.g-note` (dim caption), `.rule`
(instruction line, `<b>` underlines), `.meter` / `.meter.big` with an inner `<i>`
(set its width), `arrow('up' | 'down')`, colour classes `c-red` `c-green` `c-blue`
(set `--c` and `--cd`), text colours `t-red` `t-green` `t-blue`, and the animation
classes `pop-in`, `shake`, `bump` via `pulse(el, cls)`. Theme colours are CSS
variables: `--bg --panel --panel-2 --line --ink --dim --red --green --blue --gold --purple`.

## Check it

```bash
node tools/game-check.mjs banhammer
```

It lints the files, type-checks them alone, then plays the game: a perfect player,
a fast player, a casual player (built from `think`), an idle player, a random
masher, a one-button spammer and a chaos monkey, across levels and seeds. Then it
plays three real-time rounds at phone, small-phone and desktop sizes, checks the
layout and saves screenshots to `dist/check/<id>/`. Look at all three screenshots.
`FAIL` lines must be fixed; `WARN` lines need a reason to ignore.

Then play it for real: `npm run mock`, open
`http://localhost:5199/game.html?u=you&games=banhammer`, choose PRACTICE.
