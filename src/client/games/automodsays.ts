import './automodsays.css';
import { actor, COLOR, COLOR_NAME, clamp1000, defineSprite, h, padDots, pick, pulse, randBtn, setSprite, sprite, type GameFactory } from './common';

// The real AutoModerator is the shared cast's robot (kit/cast.ts). The impostors are
// costumes only this game needs.
// Impostor one: a troll in a cardboard-box AutoMod costume. The horns give it away.
defineSprite('automodsays-troll', `
.kk..........kk.
.krk........krk.
..krk......krk..
..kkkkkkkkkkkk..
.knnnnnnnnnnnnk.
.knnnnnnnnnnnnk.
.knnkknnnnkknnk.
.knnkknnnnkknnk.
.knnnnnnnnnnnnk.
.knnnkkkkkknnnk.
.knnnnnnnnnnnnk.
.kNnnnnnnnnnnNk.
..kkkkkkkkkkkk..
..kgggggggggGk..
..kggGggggGggk..
..kkkkkkkkkkkk..`);
// Impostor two: a regular user in a tin-foil antenna and a stuck-on moustache.
defineSprite('automodsays-stache', `
....kk....kk....
....kd....dk....
.....kd..dk.....
...kkkkkkkkkk...
..kssssssssssk..
.kssssssssssssk.
.ksskksssskksssk
.ksskksssskksssk
.kssssssssssssk.
.kskkkkkkkkkksk.
.kskk.kkkk.kksk.
.kssssssssssssk.
..kkkkkkkkkkkk..
..kpppppppppPk..
..kpPpppppPppk..
..kkkkkkkkkkkk..`);

const FAKES = ['AutoMaud', 'OttoMod', 'AutoMob', 'Aut0Mod', 'AutoModd', 'NotAMod', 'AutoToad', 'AutoMood'];
const LOOKS = ['automodsays-troll', 'automodsays-stache'] as const;
const PX = 0.56; // one art pixel, in em: the speaker is about 9em wide

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + level;
  const ignoreMs = 600 - level * 50; // how long an impostor lingers before leaving
  let lastFake = true;
  const prompts = Array.from({ length: 60 }, () => {
    // Never two impostors in a row, so the round keeps moving.
    const fake = !lastFake && rng() < 0.38;
    lastFake = fake;
    return { fake, btn: randBtn(rng), name: fake ? pick(rng, FAKES) : 'AutoModerator', look: pick(rng, LOOKS) };
  });
  let idx = 0;
  let shownAt = 0;
  let obeyed = 0;
  let wrong = 0;
  // An impostor that has just left still counts for a moment: nobody reads a new order
  // that fast, so a wrong press in this window was aimed at the impostor.
  let armedUntil = 0;
  let frame = '';

  // The scene: the mod office. Whoever is giving the order stands at the podium and
  // says it in a speech bubble; the nameplate on the podium says who they claim to be.
  const wrap = h('div', 'g-automodsays scene-office');
  const bubble = h('div', 'bubble');
  const order = h('div', 'order');
  const dots = h('span', 'which');
  bubble.append(order, dots);
  const stage = h('div', 'stage');
  // The speaker spot holds the real robot and a costume; one of them is shown.
  const speaker = h('div', 'speaker');
  const bot = actor('automod', { px: PX });
  const costume = sprite('automodsays-troll', { px: PX }, 'costume');
  speaker.append(bot.el, costume);
  const podium = h('div', 'podium');
  const plate = h('div', 'plate');
  const shield = sprite('shield', { tone: 'green', px: 0.16 }, 'badge');
  const name = h('span', 'name');
  plate.append(shield, name);
  podium.append(plate);
  // Verdicts float up from the speaker, clear of the next order.
  const stamp = h('i', 'stamp');
  stage.append(speaker, podium, stamp);
  const note = h('div', 'tally');
  wrap.append(bubble, stage, note);
  root.append(wrap);

  // The robot's mouth moves for the first moments of each order.
  const look = (p: (typeof prompts)[number], t: number) =>
    p.fake ? p.look : Math.floor(t / 140) % 2 && t - shownAt < 700 ? 'talk' : 'idle';

  function draw(t: number) {
    const p = prompts[idx % prompts.length];
    const f = look(p, t);
    if (f === frame) return;
    frame = f;
    if (p.fake) setSprite(costume, f, { px: PX });
    else bot.mood(f as 'talk' | 'idle');
  }

  function show(t: number) {
    const p = prompts[idx % prompts.length];
    shownAt = t;
    wrap.classList.toggle('fake', p.fake);
    speaker.classList.toggle('fake', p.fake);
    name.textContent = p.name;
    order.innerHTML = `Press <b class="t-${COLOR[p.btn]}">${COLOR_NAME[p.btn]}</b>`;
    dots.replaceChildren(padDots(p.btn));
    pulse(bubble, 'pop-in');
    pulse(speaker, 'bump');
    frame = '';
    draw(t);
    note.textContent = `${obeyed} obeyed`;
  }
  show(0);

  return {
    press(b, t) {
      const p = prompts[idx % prompts.length];
      const late = t < armedUntil;
      if (late) armedUntil = 0;
      if (late && b !== p.btn) {
        // Fell for the impostor a beat too late: say so, and keep the real order on screen.
        wrong++;
        bad(stamp, 'IMPOSTOR!');
        return;
      }
      if (p.fake) {
        wrong++;
        pulse(speaker, 'shake');
        bad(stamp, 'IMPOSTOR!');
      } else if (b === p.btn) {
        obeyed++;
        good(stamp);
      } else {
        wrong++;
        bad(stamp, 'WRONG COLOUR');
      }
      idx++;
      show(t);
    },
    tick(t) {
      if (armedUntil && t >= armedUntil) {
        armedUntil = 0;
        fx.pop(stamp, 'IGNORED', 'green');
      }
      if (prompts[idx % prompts.length].fake && t - shownAt >= ignoreMs) {
        // The impostor gives up and shuffles off.
        fx.poof(speaker);
        fx.sound('whoosh');
        armedUntil = t + 200;
        idx++;
        show(t);
      }
      draw(t);
    },
    score: () => clamp1000((1000 * (obeyed - wrong)) / par),
    hint() {
      const p = prompts[idx % prompts.length];
      return p.fake ? null : p.btn;
    },
  };
};
