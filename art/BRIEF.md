# Art brief: how to commission the game art

This is the working brief for redrawing the 51 mini-games. It has the rules that apply to
every picture, the pieces that are shared by many games (draw these first), and a
breakdown per game. Three games are written out as the pattern; the rest follow once
this format has been tried.

## 1. The one rule: pieces, not pictures

Never ask for a finished screenshot of a game. The game moves every piece by itself and
draws the parts that change (bars, zones, numbers, words), so it needs:

- **one backdrop** per scene, with nothing on it that moves or matters to the rules
- **each character and object by itself**, on a plain background, so it can be cut out
- **each state of a thing** as its own drawing (a candle unlit and lit, a face happy and sad)

Anything listed under "drawn by the game" must NOT be in the art.

## 2. What to ask the image tool for

Paste this at the top of every request:

> Pixel art game asset. Flat colours only: no gradients, no soft shadows, no glow, no
> anti-aliasing, no texture, no text or letters. Thick dark navy outline (#0b1020) round
> every shape. Chunky pixels: the whole drawing is on a **64 by 64 pixel grid** (or the
> size given below), every pixel the same size, nothing rotated or skewed. Light comes
> from the top left: one highlight shade and one shadow shade per colour, no more.
> Plain pure white background with nothing else on it, the subject centred with a margin
> of empty space all round. Style: bright, friendly Japanese arcade, night-time purples
> and blues with warm lantern yellows.

Then the piece, in one or two sentences, and its size.

- **Format: PNG is best.** A grid SVG (one square per pixel, like the logo) is just as
  good. A traced or "vectorised" SVG with curves is the one thing that does not work.
- **Colours are not your problem.** Every piece is converted to a small PNG with one
  image pixel per art pixel and its colours cut to 32 to 48. A character ends up at
  1 to 3 KB however many colours the tool used. Do not spend time reducing colours.
- **Same pixel size everywhere.** The icons so far came on three different grids, so
  some look finer than others. Always state the grid size from the tables below.
- **One sheet per character.** Ask for all of a character's expressions in ONE image, in
  a row with clear gaps, so it is the same character each time. Separate requests give
  six slightly different bears.
- **Fixed colours.** The three button colours must be exact wherever a thing belongs to a
  button: red `#ff4b55`, green `#2fd66f`, blue `#3f8cff`. Gold for rewards and targets
  is `#ffcf3f`.
- **No real brands, logos, people or existing characters**, and no Reddit mascot.

## 3. How to send the art back

Attach each PNG in the chat, one at a time, with a few words saying what it is ("to the
moon rocket", "mod bear moods"). That is all that is needed: naming, sorting into folders,
cutting out the background, snapping to the pixel grid and shrinking the file are done on
arrival.

- Send a picture in a message of its own, after the reply to the last one has finished.
  A picture pasted while a task is still running is not saved and has to be sent again.
- The file names in the tables below are what each piece will be called in the game.
  They are there so both sides can refer to a piece; the files you send can be named
  anything.

## 4. Shared pieces: draw these first

### The cast (8 characters, used across about 40 games)

One sheet each: head and shoulders, facing forward, **32 by 32 per expression**, six
expressions in a row: **idle, happy, sad, angry, shocked, talking** (mouth open). If
there is time, a second row: **cool** (sunglasses or smirk), **asleep**, **peeking**
(one eye open), **knocked out** (X eyes).

| File | Who | Look | Games |
|---|---|---|---|
| `cast-modbear-moods.png` | Mod Bear, the moderator | Brown bear, green cap, stern. Already drawn in three moods (asleep, peeking, angry): match those | 8 |
| `cast-automod-moods.png` | AutoMod, the robot | Grey box robot with an antenna; its face is a dark screen with cyan eyes and mouth | 4 |
| `cast-troll-moods.png` | The Troll | Green, purple horns, a smug grin | 5 |
| `cast-op-moods.png` | OP, the poster | Yellow cat, pink inner ears, eager | 11 |
| `cast-dev-moods.png` | The Dev | Purple hoodie, dark circles under the eyes, tired | 5 |
| `cast-ape-moods.png` | The Ape | Brown ape or bear in sunglasses when "cool"; diamond hands | 2 |
| `cast-npc-moods.png` | The NPC | Plain grey person with no features of note; crowds are copies of this one | 8 |
| `cast-lurker-moods.png` | The Lurker | Dark hood, only glowing eyes showing | 3 |

### The sets (backdrops)

**180 wide by 320 tall** (a phone held upright), everything important in the middle
third, because the edges are cropped on wide screens and the bottom third is usually
covered by the game. No characters, no objects the game uses, no text.

| File | Scene | Games |
|---|---|---|
| `set-office.png` | The mod office: cream wall, wooden floor, a desk edge | 9 |
| `set-street.png` | Feed street at dusk: shop fronts, lanterns | 8 |
| `set-night.png` | Night sky over a launch field: stars, a far horizon | 6 |
| `set-stage.png` | A party stage: red curtains each side, spotlight, boards | 5 |
| `set-danger.png` | Alarm room: red and dark stripes, warning lights | 4 |
| `set-court.png` | Courtroom: wood panels, a round seal on the wall | 3 |
| `set-feed.png` | Inside the feed: pale paper with faint lines | 3 |
| `set-devcave.png` | The dev's cave: dark room, monitor glow, cables | 3 |
| `set-kitchen.png` | A kitchen at night: tiles, a counter | 3 |
| `set-casino.png` | Casino floor: red carpet, gold trim, bulbs | 2 |
| `set-alley.png` | Back alley: brick, a bin, one street lamp | 2 |

## 5. Per-game breakdowns

Each game lists its scene, the pieces to draw (with the grid size to ask for), and what
the game draws itself.

### To The Moon (`tothemoon`)

Fly one rocket up against gravity and land it on the moon.

- **Set:** `set-night.png`
- **Cast:** the Ape, small, in the bottom corner (mission control)

| File | Piece | Size | Notes |
|---|---|---|---|
| `tothemoon-rocket.png` | A stubby rocket pointing up, round porthole, gold nose and fins, white body | 24 x 32 | No flame on it |
| `tothemoon-flame.png` | The exhaust flame, two frames side by side (short, long) | 16 x 16 each | Orange with a yellow core, pointing down |
| `tothemoon-moon.png` | A full moon with craters | 32 x 32 | Gold and cream; it is the landing target, so it must read at a glance |
| `tothemoon-pad.png` | A launch pad, seen from the side | 48 x 12 | Flat top for the rocket to stand on |

Drawn by the game: the gold band of moonlight across the sky (the landing zone), the
landing count, the rocket's movement.

### Cake Day (`cakeday`)

Flames fall down three lanes on the beat; tap a lane as its flame lands on the candle.

- **Set:** `set-stage.png`
- **Cast:** OP the cat in the middle with a party hat, an NPC guest each side

| File | Piece | Size | Notes |
|---|---|---|---|
| `cakeday-cake.png` | A wide birthday cake, pink sponge, white icing dripping, on a plate | 96 x 40 | Flat top, NO candles on it |
| `cakeday-candle-red.png`, `-green.png`, `-blue.png` | A striped candle, unlit, in each button colour | 12 x 24 | The wick at the very top centre |
| `cakeday-lit.png` | A candle flame, two frames side by side | 12 x 16 each | Sits on the wick |
| `cakeday-drop-red.png`, `-green.png`, `-blue.png` | A falling flame (a teardrop of fire) in each button colour | 16 x 20 | The point at the bottom is what lands on the wick |
| `cakeday-hat.png` | A striped party hat with a pompom | 16 x 16 | Worn by OP |
| `cakeday-bunting.png` | One triangular bunting flag | 12 x 12 | White; the game colours and repeats it |

Drawn by the game: the three lanes, the "HAPPY CAKE DAY" banner text, the ghost outline
where a flame will land.

### Peak Hour (`peak`)

A clock hand sweeps round; a slice of the clock lights up in a button colour; tap that
colour while the hand is inside it.

- **Set:** `set-stage.png` (or a town square at night if there is time for one more set)
- **Cast:** OP the cat, small, top left, holding a phone

| File | Piece | Size | Notes |
|---|---|---|---|
| `peak-clock.png` | A round town-clock face: gold rim with a mark at each of the 12 hours, plain pale face | 48 x 48 | NO hands and NO numbers; the centre must be exactly the middle pixel |
| `peak-phone.png` | A phone held upright, glowing screen | 12 x 16 | |

Drawn by the game: the gold hand, the hub, the coloured slice (it changes size and
position every few seconds), the rule sign.

## 6. Order of work

1. The eight cast sheets. They change the look of about 40 games at once.
2. The eleven sets.
3. Per-game pieces, starting with the games that are in rotation most.

The deadline is 8 December. If time runs short, stop after step 2: every game will
already look redrawn, with its old props.
