# Karma Rush Rampage: notes for whoever works on this next

A Devvit Web daily game for Reddit's "Game of the Day" hackathon (deadline 8 December
2026, 6pm PT). 51 three-button mini-games; five a day. `README.md` covers running it,
`GAME_GUIDE.md` covers writing a mini-game, `art/BRIEF.md` covers commissioning art.

## Standing rules

- Work on `main` and push there. Do not open a pull request unless asked.
- Never run `devvit publish`: the hackathon rules forbid submitting the app for publishing.
- Never add a looping silent `<audio>` clip to keep sound alive. It froze the owner's
  iPhone on first tap, twice.
- No "Reddit" or "Snoo" in the app's name or branding; no real brands, people, logos or
  existing characters; it must not recreate any existing party game.
- Everything on screen is pixel art. Anything new that is not pixel art gets made pixel art.
- The owner tests on an iPhone 14 inside the Reddit app. The phone's silent switch mutes
  game sound but not the announcer's voice; that is expected.
- After a change: `npm run check`, `npm test`, and `node tools/game-check.mjs --art <id>`
  for any game touched; `npm run smoke` for anything shared. Bump `BUILD` in
  `src/client/main.ts` so the owner can tell which build is on screen.

## How the owner works

- They describe a game by what it says on screen ("the moon one", "post inside the
  colour"), not by its id. Find it by its shout or how-to text in `src/shared/games/`.
- They want to see the result: send a screenshot of the changed screen with each change.
- Bots in the checks have perfect timing and memory, so a passing check says nothing about
  whether a person can do it. Reason about human timing and say plainly that it is untested
  by hand.
- Long test runs get interrupted. Commit, push and show the result first; run the long
  smoke test after.

## The art pipeline

Art comes from the owner (SVGs, sheets) or from the Sprite Fusion connector, which makes
true pixel art and spends the owner's credits: 15 per request (a set of options, an edit,
a style match or an animation), 3 for a single sprite. Check `get_credits` first and say
what a job will cost. Every piece ends up as a small PNG with one image pixel per art
pixel, shown with `image-rendering: pixelated`.

Sprite Fusion results arrive as enlarged previews saved under the session's tool-results
folder (an exact whole-number enlargement): `python3 tools/sf-exact.py preview.png out.png`
turns one back into the sprite.
`generate_sprites_in_style` with an existing piece as the reference keeps the look, and
its nine options usually include several usable expressions of the same character;
`edit_sprite` on the chosen one gives the rest. OP the cat was made this way
(`src/client/kit/art/op-*.png`, wired through `DRAWN` in `src/client/kit/cast.ts`).

Props (coin, rocket, cake, the per-game objects) are drawn too. A PNG in `art/sprites/`
replaces the hand-typed placeholder sprite of the same name everywhere the game draws it,
inside the box the placeholder had: add or change the PNG, run
`python3 tools/art-sprites.py`, and it is in `src/client/kit/art.gen.ts`. They were made
with `generate_sprites`, `count: 1` (3 credits), size 24 or 32 (48 for furniture), the
game's own 42 colours as the palette (`TONES` and `INK` in `px.ts`), and every prompt
ending "Thick dark outline, bold simple shapes, bright playful colours, one highlight."
The generator leans pale: gold comes back cream, red comes back with orange shading. Swap
those pixels for the exact game colours afterwards, then run `python3 tools/art-ink.py`
on the new files: the house look is one solid black outline (`#0b1020`) round saturated
colour, never a grey or navy outline and never pastel fills. A prop the game recolours (a bin in
each button colour) is drawn in red and listed under `tint` in
`art/sprites/manifest.json`; `mirror` and `alias` there reuse one drawing.

| The art arrives as | Use |
|---|---|
| A grid SVG (one square per pixel, any cell size) | `python3 tools/gridsvg.py in.svg out.png` (exact) |
| A PNG already on an exact grid with transparency | sample it down by its cell size (exact) |
| A soft "pixel-looking" picture from an image generator | `python3 tools/repixel.py in out --block N --colours 40 [--cutout] [--holes]` |
| A sheet of several drawings on white | `python3 tools/sheetcut.py sheet out_dir`, then one of the above per piece |

- Menu art lives in `src/client/art/` (sky, logo, pagoda, trees, mountain, row frames,
  icons); per-game art in `src/client/games/art/<id>-<piece>.png`.
- A picture pasted into the chat while a task is running is not saved to disk. Ask for
  it again in a message of its own.
- Art with words baked in cannot be used where the game writes the words (signs, tags,
  buttons). Ask for those blank.
- Sort By New is the worked example of a game using supplied art.

## Things that are easy to get wrong

- A game's wrapper needs a `scene-*` class: it supplies the pixel font as well as the
  backdrop. Override the backdrop in the game's CSS if the game has its own.
- Game art elements need the `px` class, or the art check reports no sprites.
- Menu row icons follow the row's title (`ROW_ICON` in `main.ts`), not its colour.
- The title-card backdrop (`#cardbg`) sits behind `#card` and must never move its arrow
  layers past each other: only the light inside them moves.
- Live Party's clock waits for everyone's READY; the server fixes each round's start
  (`partyReady` in `src/server/core.ts`, `partyClock` in `src/shared/daily.ts`).
