import './bananascale.css';
import { actor, COLOR, clamp1000, defineSprite, h, pick, pulse, randInt, setSprite, shuffled, sprite, type Btn, type GameFactory, type Tone } from './common';

// A studio softbox on a stand, lighting the shoot.
defineSprite('bananascale-lamp', `
kkkkkkkkkk
kWWWWWWWWk
kWwwwwwwWk
kWwwwwwwWk
kkkkkkkkkk
....kk....
....kk....
....kk....
....kk....
....kk....
...kkkk...
..kk..kk..
.kk....kk.`);

// Every sprite is ROWS pixels tall and its art touches the top and bottom rows, so the
// code can size each by its height in bananas and the heights compare exactly.
const ROWS = 32;

// The unit of measure.
defineSprite('bananascale-banana', `
..kkk.........
..kNk.........
..kNk.........
..kNNk........
..kLAk........
..kLAAk.......
...kLAak......
...kLAAak.....
....kLAak.....
....kLAAak....
....kLLAAak...
.....kLAAak...
.....kLAAAak..
.....kLLAAak..
......kLAAAAak
......kLAAAAak
......kLAAAAak
......kLAAAAak
......kLAAAAak
.....kLAAAAAak
.....kLAAAAAak
.....kLAAAAak.
....kLAAAAAak.
....kLAAAAak..
...kLAAAAAak..
..kLAAAAAak...
.kLAAAAAak....
kLAAAAAak.....
kAAAAAak......
kaaaakk.......
kNNkk.........
.kk...........`);

const NANA_W = 14; // the banana's width in pixels

defineSprite('bananascale-cone', `
.........kkkk.........
........kLLLLk........
........kLAAak........
........kLAAak........
........kLAAak........
........kLAAak........
.......kLAAAALk.......
.......kLAAAAak.......
.......kLAAAAak.......
.......kLWWWWak.......
......kLwwwwwwLk......
......kLwwwwwwak......
......kLwwwwwwak......
......kLAAAAAAak......
......kLAAAAAAak......
.....kLAAAAAAAALk.....
.....kLAAAAAAAAak.....
.....kLAAAAAAAAak.....
.....kLWWWWWWWWak.....
.....kLwwwwwwwwak.....
....kLwwwwwwwwwwLk....
....kLwwwwwwwwwwak....
....kLAAAAAAAAAAak....
....kLAAAAAAAAAAak....
....kLAAAAAAAAAAak....
...kLAAAAAAAAAAAALk...
.kkkLaaaaaaaaaaaaakkk.
kAAAAAAAAAAAAAAAAAAAAk
kAaaaaaaaaaaaaaaaaaaak
kAaaaaaaaaaaaaaaaaaaak
kAaaaaaaaaaaaaaaaaaaak
.kkkkkkkkkkkkkkkkkkkk.`);

defineSprite('bananascale-fridge', `
.kkkkkkkkkkkkkkk.
kWWWWWWWWWWWWWWWk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kkkkkkkkkkkkkkkkk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwDDwdk
kWwYYYYwwwwwDDwdk
kWwyyyywwwwwDDwdk
kWwyyyywwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwwwwwwDDwdk
kWwwwwwmpwwwDDwdk
kWwwwwwppwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWwwwwwwwwwwwwwdk
kWddddddddddddddk
.kdddkkkkkkkdddk.
.kdxxk.....kdxxk.
..kkk.......kkk..`);

defineSprite('bananascale-rock', `
..................kk...........
..............kkkkLLkkk........
...........kkkLLLLLLLLLkkk.....
..........kLLLLLLLLLLLLLLLk....
..........kLLLLLLLLLLLLLLLLk...
.........kLALLLLLLLLLLLLLAak...
........kLAAALLLLLLLLLLLAAak...
.......kLAAAALLLLLLLLLLLAAALk..
......kLAAAAALLLLLLLLLLAAAAak..
.....kLAAAAAAALLLLLLLLAAAAAak..
....kLAAAAAAAALLLLAAAAAAAAAALk.
....kLAAAAAAAAAAAAAAAAAAAAAAak.
...kLAAAAAAAAAAAAAAAAAAAAAAAak.
...kLAAAAAAAAAAAAAAAAAAAAAAAak.
...kLAAAAAAAAAAAAAAAAAAAAAAAALk
..kLAAAAAAAAAAAAAAAAAAAAAaAAAak
..kLAAAAAAkkkkAAAkkkkAAAAAAAAak
..kLAAAAAAWWWWAAAWWWWAAAAAAAAak
.kLAAAAAAkWWWWkAkWWWWkAAAAAAAak
.kLAAAAAAkkkWWkAkkkWWkAAAAAAAak
.kLAAAAAAAkkWWAAAkkWWAAAAAAAAak
kLAAAAAAAAkkkkAAAkkkkAAAAAAAAak
kLAAAAAAAAAAAAAAAAAAAAAAAAAAak.
kLAAAAAAAAAAAAAAAAAAAAAAAAAAak.
kLAAAAAAaAAAAAAAAAAAAAAAAAAAak.
kLAAAAAAAAAAAAAAAAAAAAAAAAAAak.
kLAAAAAAAAAAAAAAAAAAAAAAAAAAak.
kLAAAAAAAAAAAAAAAAAAAAaAAAAAak.
.kLAAAaAAAAAAAAAAAAAAAAAAAAAak.
.kLAAAAAAAAAAAAAAAAAAAAAAAAAak.
.kLaaaaaaaaaaaaaaaaaaaaaaaaaak.
..kkkkkkkkkkkkkkkkkkkkkkkkkkk..`);

defineSprite('bananascale-cat', `
..k...............k...
.kLk.............kLk..
.kLLkk..kkkkk..kkLak..
.kLALLkkLLLLLkkLLAak..
.kLAmALLAAaAaLLAAmak..
.kLAmmAAAAaAaAAAmmak..
kLAAAAAAAAaAaAAAAAALk.
kLAAAAAAAAAAAAAAAAAak.
kLAAAAAAAAAAAAAAAAAak.
kLAAAAkkAAAAAkkAAAAak.
kLAAAAkkAAAAAkkAAAAak.
kLAAAAAAAAAAAAAAAAAak.
.kLAAAAAAAmmAAAAAAak..
.kLAAAAAAkAAkAAAAAak..
..kLaAAAAAkkAAAAaak...
...kkLaAAAAAAaaakk....
.....kkLAAAAakkk.kkk..
....kLLAAAAAALLkkLLLk.
...kLAAAAAAAAAALkLaak.
..kLAAAAssssssAALkkLLk
..kLAAAAssssssAAakkLak
.kLAAAAAssssssAAALkLak
.kLAAAAAssssssAAAakLak
.kLAAAAAssssssAAAakLak
kLAAAAAAAssssAAAAALAak
kLAAAAAAAssssAAAAAAAak
kLAAAAkAAssssAAkAAAAak
kLAAAAkAAAkkAAAkAAAAak
kLAAAAkAAAkkAAAkAAAAak
kLAAAAkWWdkkdWWkAAAaak
kLaaaakWWWkkWWWkaaakk.
.kkkkkkkkkkkkkkkkkk...`);

defineSprite('bananascale-pc', `
.kkkkkkkkkkkkkk.
kWWWWWWWWWWWWWWk
kWwwwwwwwwwwwwdk
kWwkkkkkkkkkkwdk
kWwkxxxxxxxxkwdk
kWwkxxppppxxkwdk
kWwkxpxxxxpxkwdk
kWwkxpxDDxpxkwdk
kWwkxpxxxxpxkwdk
kWwkxxppppxxkwdk
kWwkxxxxxxxxkwdk
kWwkxxyyyyxxkwdk
kWwkxyxxxxyxkwdk
kWwkxyxDDxyxkwdk
kWwkxyxxxxyxkwdk
kWwkxxyyyyxxkwdk
kWwkxxxxxxxxkwdk
kWwkxxccccxxkwdk
kWwkxcxxxxcxkwdk
kWwkxcxDDxcxkwdk
kWwkxcxxxxcxkwdk
kWwkxxccccxxkwdk
kWwkxxxxxxxxkwdk
kWwkkkkkkkkkkwdk
kWwwwwwwwwwwwwdk
kWwwwwwwwwwwwwdk
kWwwwwwWcwwwwwdk
kWwwwwwccwwwwwdk
kWwwwwwwwwwwwwdk
kWdddddddddddddk
.kdddkkkkkkdddk.
..kkk......kkk..`);

defineSprite('bananascale-chair', `
.....kkkkkkkkk.....
....kLLLLLLLLLk....
...kLAAAAAAAAALk...
...kLAAkDxxkAAak...
...kLAAkWWWkAAak...
...kLAAkWWWkAAak...
...kLAAkDxxkAAak...
...kLAAkDxxkAAak...
...kLAAkDxxkAAak...
...kLAAkDxxkAAak...
...kLAAkDxxkAAak...
.kkkLAAkDxxkAAakkk.
kDDkLAAkDxxkAAakDDk
kDxkLAAkDxxkAAakDxk
kDxkLAAkDxxkAAakDxk
kDxkLAAkDxxkAAakDxk
kDxkLAAkDxxkAAakDxk
.kLkkkkkkkkkkkkkLk.
.kLAAAAAAAAAAAAAak.
.kLAAAAAAAAAAAAAak.
.kLaaaaaaaaaaaaaak.
..kkkkkkdddkkkkkk..
.......kdDxk.......
.......kdDxk.......
.......kdDxk.......
..kkkkkkdDxkkkkkk..
.kddddddDDDddddddk.
.kdxxxxxxxxxxxxxxk.
kWWWkkkkWWWkkkkWWWk
kWwdk..kWwdk..kWwdk
kWddk..kWddk..kWddk
.kkk....kkk....kkk.`);

defineSprite('bananascale-boxes', `
...kkkkkkkkkkkkkkkkkkkkkk..
..kssssssssssssssssssssssk.
..kAALAAAAAAAAAAAAAAAAAAAk.
..ksLLLLLLLLLLLLLLLLLLLLAk.
..ksAAAAAAAAAAAAAAAAAAAAAk.
.kkkkkkkkkkkkkkkkkkkkkkkk..
kssssssssssssssssssssssk...
kAALAAAAAAAAAAAAAAAAAAAk...
ksLLLLLLLLLLLLLLLLLLLLAk...
ksAAAAAAAAAAAAAAAAAAAAAk...
.kkkkkkkkkkkkkkkkkkkkkkkkk.
...kssssssssssssssssssssssk
...kAALAAAAAAAAAAAAAAAAAAAk
...ksLLLLLLLLLLyyyyLLLLLLAk
...ksAAAAAAAAAAyyyyAAAAAAAk
..kkkkkkkkkkkkkkkkkkkkkkkk.
.kssssssssssssssssssssssk..
.kAALAAAAAAAAAAAAAAAAAAAk..
.ksLLLLLLLLLLLLLLLLLLLLAk..
.ksAAAAAAAAAAAAAAAAAAAAAk..
..kkkkkkkkkkkkkkkkkkkkkkk..
..kssssssssssssssssssssssk.
..kAALAAAAAAAAAAAAAAAAAAAk.
..ksLLLLAALLLLLLLLLLLLLLAk.
..ksAAAAAAAAAAAAAAAAAAAAAk.
.kkkkkkkkkkkkkkkkkkkkkkkk..
kssssssssssssssssssssssk...
kAALAAAAAAAAAAAAAAAAAAAk...
ksLLLLLLLLLLLLLLLLLLLLAk...
ksLLLLLLLLLLLLLLLLLLLLAk...
ksAAAAAAAAAAAAAAAAAAAAAk...
.kkkkkkkkkkkkkkkkkkkkkk....`);

defineSprite('bananascale-floorlamp', `
....kkkkkkkk....
...kYYYYYYYYk...
...kYyyyyyyok...
...kYyyyyyyok...
..kYyyyyyyyyYk..
..kYyyyyyyyyok..
..kYyyyyyyyyok..
.kYyyyyyyyyyyYk.
.kYyyyyyyyyyyok.
.kYyyyyyyyyyyok.
kYooooooooooooYk
.kkkkkkddkkkkkk.
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
......kdDk......
....kkkdDkkk....
...kdddDDdddk...
..kdDDDDDDDDdk..
..kdxxxxxxxxxk..
...kkkkkkkkkk...`);

defineSprite('bananascale-armchair', `
.......kkkkkkkkkkkkkkkkkk.......
......kLLLLLLLLLLLLLLLLLLk......
.....kLAAAAAAAAAAAAAAAAAALk.....
.....kLAAAAAAAAAAAAAAAAAAak.....
.....kLAAAAAAAAAAAAAAAAAAak.....
.....kLAAAAAAAAAAAAAAAAAAak.....
.....kLAAAAAAAAAAAAAAAAAAak.....
.....kLAAAAaAAAAaAAAAaAAAak.....
.....kLAAAAAAAAAAAAAAAAAAak.....
.....kLAAAAAAAAAAAAAAAAAAak.....
..kkkkLAAAAAAAAAAAAAAAAAAakkkk..
.kLLLLAAAAAAAaAAAAAaAAAAAALLLLk.
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAALk
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkkkkkkkkkkkkkkkkAAAAAAak
kLAAAAAAkssssssAssssssskAAAAAAak
kLAAAAAAkLLLLLLALLLLLLLkAAAAAAak
kLAAAAAAkLLLLLLALLLLLLLkAAAAAAak
kLAAAAAAkLLLLLLALLLLLLLkAAAAAAak
kLAAAAAAkkkkkkkkkkkkkkkkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLAAAAAAkAAAAAAAAAAAAAAkAAAAAAak
kLaaaaaakaaaaaaaaaaaaaakaaaaaaak
.kknnnkkkkkkkkkkkkkkkkkkkknnnkk.
..knNNk..................knNNk..
..knNNk..................knNNk..
...kkk....................kkk...`);

// `w` is the sprite's width in pixels (it is ROWS tall); `tone` colours its A/a/L pixels.
const THINGS: { art: string; w: number; tone?: Tone; caps: string[] }[] = [
  { art: 'bananascale-cone', w: 22, tone: 'orange', caps: ['Roommate came home with this', 'Found a cone. It is mine now.'] },
  { art: 'bananascale-fridge', w: 17, caps: ['New fridge day!', 'My fridge, magnets included'] },
  { art: 'bananascale-rock', w: 31, tone: 'grey', caps: ['Suspiciously large rock', 'Is this a good rock?'] },
  { art: 'bananascale-cat', w: 22, tone: 'orange', caps: ['He just sits like this', 'Orange cat, one brain cell'] },
  { art: 'bananascale-pc', w: 16, caps: ['First build! Rate my rig', 'It runs hot. Very hot.'] },
  { art: 'bananascale-chair', w: 19, tone: 'purple', caps: ["The mod's gaming chair", 'Have not left it since 2019'] },
  { art: 'bananascale-boxes', w: 27, tone: 'brown', caps: ['Dinner for one', 'Leftovers, day nine'] },
  { art: 'bananascale-floorlamp', w: 16, caps: ['Thrifted this lamp for $3', 'Lamp. Moths love it.'] },
  { art: 'bananascale-armchair', w: 32, tone: 'brown', caps: ['Free chair from the kerb', "Grandpa's haunted armchair"] },
];

/** A banana sprite sized by the stylesheet (the stack and the answer chips set its box). */
function nana(): HTMLElement {
  const el = sprite('bananascale-banana', {}, 'nana');
  el.style.width = el.style.height = '';
  return el;
}

const STACK_MS = 240; // the bananas climb to the top in this long
const RIGHT_MS = 520; // then the verdict stays up until the next thing
const WRONG_MS = 800;

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Each call costs a look (about a second) plus the half-second stack-up, so six right
  // answers is a great round. Later levels get harder through closer guesses, not a higher par.
  const par = 6;
  const things = shuffled(rng, THINGS);
  let bag: Btn[] = [];
  // More things than anyone can measure; the right answer sits on each button equally often.
  const rounds = Array.from({ length: 27 }, (_, i) => {
    if (i % 3 === 0) bag = shuffled(rng, [0, 1, 2] as Btn[]);
    const thing = things[i % things.length];
    // Guesses two apart are easy to eyeball; later levels mix in consecutive ones. Those stop
    // at 3 / 4 / 5: nobody can tell five bananas from six at a glance.
    const step = rng() < level * 0.2 ? 1 : 2;
    const low = randInt(rng, 2, step === 1 ? 3 : 3 + Math.floor(level / 3));
    const win = bag[i % 3];
    return { thing, cap: pick(rng, thing.caps), guesses: [low, low + step, low + 2 * step], win, tall: low + win * step };
  });
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let reveal: { from: number; until: number; ok: boolean; shown: number } | null = null;
  const score = () => clamp1000((1000 * (right - wrong / 2)) / par);

  // A photo studio set up in the kitchen: OP Cat posts the photo (the caption is its
  // speech bubble), the thing stands on the backdrop paper next to one banana, and the
  // bananas stack up beside it when you answer.
  const wrap = h('div', 'g-bananascale scene-kitchen');
  wrap.style.setProperty('--nar', String(NANA_W / ROWS));
  const head = h('div', 'head');
  const cat = actor('op', { px: 0.38 });
  const title = h('div', 'title');
  head.append(cat.el, title);
  const scene = h('div', 'scene');
  scene.append(h('i', 'chart'), sprite('bananascale-lamp', { px: 0.26 }, 'lamp left'), sprite('bananascale-lamp', { px: 0.26, flip: true }, 'lamp right'));
  const pair = h('div', 'pair');
  const stack = h('div', 'stack');
  const thing = h('div', 'thing');
  const art = sprite('bananascale-banana', {}, 'art');
  const stamp = h('div', 'stamp');
  thing.append(art, stamp);
  // The floor line doubles as the progress meter.
  const floor = h('div', 'meter floor');
  const fill = h('i');
  floor.append(fill);
  pair.append(stack, thing);
  scene.append(pair, floor);
  const picks = h('div', 'picks');
  const chips = [0, 1, 2].map((i) => {
    const chip = h('div', `pick c-${COLOR[i]}`);
    chip.append(h('b'), nana());
    picks.append(chip);
    return chip;
  });
  wrap.append(head, scene, picks);
  root.append(wrap);

  function show() {
    const r = rounds[idx % rounds.length];
    reveal = null;
    title.className = 'title';
    title.textContent = r.cap;
    cat.mood('idle');
    pair.className = 'pair';
    pair.style.setProperty('--ar', String(r.thing.w / ROWS));
    pair.style.setProperty('--k', String(r.tall));
    // The bottom banana is the one for scale; the rest stay hidden until the reveal.
    stack.replaceChildren(...Array.from({ length: r.tall }, nana));
    // The stylesheet sizes the thing from --h and --ar, not the sprite's own pixel size.
    setSprite(art, r.thing.art, { tone: r.thing.tone });
    art.style.width = art.style.height = '';
    stamp.className = 'stamp';
    chips.forEach((chip, i) => {
      chip.className = `pick c-${COLOR[i]}`;
      chip.firstElementChild!.textContent = String(r.guesses[i]);
    });
    pulse(pair, 'pop-in');
  }
  show();

  // The stack has reached the top of the thing: stamp the verdict.
  function verdict(tall: number, ok: boolean) {
    title.textContent = `${tall} BANANAS TALL`;
    stamp.textContent = ok ? 'APPROVED\nUNIT' : 'NOT TO\nSCALE';
    stamp.className = ok ? 'stamp on' : 'stamp on no';
    pair.classList.add('done');
    if (ok) {
      pair.classList.add('spin');
      fx.burst(thing, 'gold', 14);
      fx.sound('coin');
    } else fx.sound('thud');
  }

  return {
    press(b, t) {
      if (reveal) return;
      const r = rounds[idx % rounds.length];
      const ok = b === r.win;
      if (ok) {
        right++;
        cat.mood('happy');
        good(chips[b]);
      } else {
        wrong++;
        cat.mood('shock');
        bad(chips[b], 'NOPE');
      }
      reveal = { from: t, until: t + (ok ? RIGHT_MS : WRONG_MS), ok, shown: 1 };
      chips.forEach((chip, i) => chip.classList.add(i === r.win ? 'yes' : 'no'));
      pulse(chips[b], 'bump');
      title.className = 'title count';
      title.textContent = '1';
      fill.style.transform = `scaleX(${score() / 1000})`;
    },
    tick(t) {
      if (!reveal) return;
      const r = rounds[idx % rounds.length];
      const upTo = Math.min(r.tall, 1 + Math.floor(((t - reveal.from) * (r.tall - 1)) / STACK_MS));
      while (reveal.shown < upTo) {
        stack.children[reveal.shown++].classList.add('on');
        fx.sound('tick');
        if (reveal.shown === r.tall) verdict(r.tall, reveal.ok);
        else title.textContent = String(reveal.shown);
      }
      if (t >= reveal.until) {
        idx++;
        show();
      }
    },
    score,
    hint: () => (reveal ? null : rounds[idx % rounds.length].win),
  };
};
