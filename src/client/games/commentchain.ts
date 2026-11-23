import './commentchain.css';
import { actor, clamp1000, COLOR, defineSprite, h, pulse, randBtn, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// One link of the comment chain along the bottom: it fills in as replies are said.
defineSprite('commentchain-link', `
..kkkkkkkk..
.kLLLLLLAAk.
kLAkkkkkkAak
kAk......kak
kAk......kak
kAakkkkkkaak
.kaaaaaaaak.
..kkkkkkkk..`);

// The three neighbours on the balconies, left to right: red, green, blue.
const CAST = ['op', 'npc', 'lurker'] as const;
const PX = 0.36; // one art pixel in em: each neighbour is about 5.8em wide

// Simon, at speed. The chain is shown, you copy it, and every chain you get right comes
// back one reply longer. Each neighbour is a big pad in a button colour with a note of
// its own, so the chain can be seen and heard.
export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const stepMs = 240 - level * 15; // one flash, lit for about two thirds of it
  const firstLen = level >= 3 ? 3 : 2;
  const MAX = 8;
  // Replies copied correctly. Chains of 2, 3 and 4 are nine; a flawless round fits the chain of 5 too.
  const par = 11 + Math.floor(level * 0.75);
  // One long chain, dealt up front: round one shows the start of it, each win shows one more.
  const whole: Btn[] = [];
  while (whole.length < MAX) {
    const b = randBtn(rng);
    if (whole.length >= 2 && whole[whole.length - 1] === b && whole[whole.length - 2] === b) continue;
    whole.push(b);
  }
  let len = firstLen; // how much of the chain is in play
  let showFrom = 350; // when the chain starts flashing
  let input = -1; // index of the reply expected next, or -1 while watching
  let done = 0;
  let wrong = 0;
  let shown = -2; // the flash step on screen
  let lit = -1; // the pad lit by the show
  let reactUntil = 0;
  let reacting = false;

  // The scene: an apartment block on feed street. Each neighbour stands on a balcony that is
  // one big pad in a button colour; whoever is replying lights up.
  const wrap = h('div', 'g-commentchain scene-street');
  const banner = h('div', 'rule');
  const block = h('div', 'block');
  const spots = CAST.map((who, i) => {
    const spot = h('div', `spot c-${COLOR[i]}`);
    const who_ = actor(who, { px: PX });
    spot.append(h('i', 'glow'), who_.el, h('div', 'rail'));
    block.append(spot);
    return { spot, who: who_ };
  });
  const links = h('div', 'links');
  const linkEls = whole.map(() => sprite('commentchain-link', { tone: 'grey', px: 0.2 }, 'link'));
  links.append(...linkEls);
  const note = h('div', 'tally');
  wrap.append(banner, block, links, note);
  root.append(wrap);

  function faces(m: (i: number) => ActorMood) {
    spots.forEach((s, i) => s.who.mood(m(i)));
  }
  function react(t: number, m: (i: number) => ActorMood) {
    faces(m);
    reacting = true;
    reactUntil = t + 320;
  }
  /** Lights pad `b` for the show (or none), with its note. */
  function light(b: number) {
    if (b === lit) return;
    lit = b;
    spots.forEach((s, i) => s.spot.classList.toggle('lit', i === b));
    if (b >= 0) fx.note(b as Btn);
    if (!reacting) faces((i) => (i === b ? 'talk' : 'idle'));
  }
  function status() {
    wrap.classList.toggle('turn', input >= 0);
    banner.textContent = input >= 0 ? 'YOUR TURN!' : 'WATCH…';
    // The chain in play: bright up to where the show or the copying has got to.
    linkEls.forEach((l, i) => {
      l.classList.toggle('off', i >= len);
      l.classList.toggle('on', i < (input >= 0 ? input : shown + 1));
    });
    note.textContent = `chain of ${len} · ${done} ${done === 1 ? 'reply' : 'replies'} copied`;
  }
  function replay(t: number, pause: number) {
    input = -1;
    showFrom = t + pause;
    shown = -2;
    light(-1);
    status();
  }
  status();

  return {
    press(b, t) {
      // Quick players start the moment the last reply lights up. A correct first press there
      // counts, so being early never silently eats a press and breaks the chain.
      if (input < 0 && t >= showFrom + (len - 1) * stepMs && b === whole[0]) {
        input = 0;
        light(-1);
      }
      if (input < 0) {
        pulse(banner, 'bump'); // still watching: no penalty, but the press is acknowledged
        return;
      }
      pulse(spots[b].spot, 'flash');
      if (b === whole[input]) {
        done++;
        good(spots[b].spot);
        react(t, (i) => (i === b ? 'happy' : 'peep'));
        input++;
        if (input === len) {
          // Got it: the same chain comes back one longer.
          fx.pop(links, len >= MAX ? 'MAX CHAIN!' : 'CHAIN +1', 'gold');
          fx.burst(links, 'gold', 14);
          fx.sound('coin');
          react(t, () => 'happy');
          len = Math.min(MAX, len + 1);
          replay(t, 420);
          return;
        }
        status();
      } else {
        // Broke it: watch the same chain again.
        wrong++;
        bad(spots[b].spot, 'BROKE THE CHAIN');
        pulse(spots[b].spot, 'shake');
        react(t, (i) => (i === b ? 'angry' : 'shock'));
        replay(t, 500);
      }
    },
    tick(t) {
      if (reacting && t >= reactUntil) {
        reacting = false;
        faces((i) => (i === lit ? 'talk' : input >= 0 ? 'peep' : 'idle'));
      }
      if (input >= 0) return;
      const at = t - showFrom;
      const step = at < 0 ? -1 : Math.floor(at / stepMs);
      if (step >= len) {
        input = 0;
        light(-1);
        status();
        return;
      }
      // Each flash is lit for the first two thirds of its step, so two of the same colour
      // in a row read as two flashes.
      light(step >= 0 && at - step * stepMs < stepMs * 0.68 ? whole[step] : -1);
      if (step !== shown) {
        shown = step;
        status();
      }
    },
    score: () => clamp1000((1000 * (done - wrong)) / par),
    hint: () => (input >= 0 ? whole[input] : null),
  };
};
