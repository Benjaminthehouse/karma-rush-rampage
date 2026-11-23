import './cakeday.css';
import { actor, BEAT_SYNC, beatMs, COLOR, clamp1000, defineSprite, h, pulse, randBtn, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// A falling flame in the lane's colour (the sheet's flames are fixed orange).
defineSprite('cakeday-drop', `
....k.....
...kAk....
...kAAk...
..kAALAk..
.kAALLAk..
.kALLLAAk.
kAALWLLAk.
kALLWWLAAk
kALWWWLLAk
kALLWWLLAk
.kALLLLAk.
..kkkkkk..`);
// OP Cat's party hat: a striped cone with a pompom.
defineSprite('cakeday-hat', `
....kk....
...kwwk...
...kkkk...
...kAAk...
..kyyyyk..
..kAAAAk..
.kyyyyyyk.
.kAAAAAAk.
kyyyyyyyyk
kkkkkkkkkk`);
// Bunting flag for the banner string.
defineSprite('cakeday-flag', `
kkkkkkk
kAAAAAk
.kAAAk.
.kALAk.
..kAk..
...k...`);

const FALL = 1100; // ms a flame takes to reach the cake
// How far off the beat a tap may be. Wider after the beat than before it: a thumb lands
// a little after the ear hears the kick, and the phone reports it a little later still.
const EARLY = 150;
const LATE = 200;
const FLAGS = ['pink', 'gold', 'purple', 'teal', 'orange', 'pink', 'gold', 'purple', 'teal'] as const;

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // Same tempo as the round's music, so the flames land on the beat.
  const beat = beatMs(level);
  const notes: { at: number; lane: Btn; el: HTMLElement; state: 'fall' | 'hit' | 'miss'; y: string }[] = [];

  // The party stage: bunting across the top, a giant cake with three candles in the
  // middle, OP Cat in a party hat and two guests in front of it. Flames drop down
  // each candle's lane on the beat.
  const wrap = h('div', 'g-cakeday scene-stage');
  const bunting = h('div', 'bunting');
  for (const tone of FLAGS) bunting.append(sprite('cakeday-flag', { tone, px: 0.26 }, 'flag'));
  const banner = h('div', 'banner', 'HAPPY CAKE DAY');
  bunting.append(banner);
  const field = h('div', 'field');
  const cake = h('div', 'cake');
  cake.append(h('i', 'icing'), h('i', 'plate'));
  field.append(cake);
  const lanes = [0, 1, 2].map((i) => {
    const lane = h('div', `lane c-${COLOR[i]}`);
    const chute = h('div', 'chute');
    const ghost = sprite('cakeday-drop', { tone: 'grey', px: 0.22 }, 'ghost');
    const candle = h('div', 'candle');
    const lit = sprite('flame1', { px: 0.22 }, 'lit');
    candle.append(lit);
    lane.append(chute, ghost, candle);
    field.append(lane);
    return { lane, chute, candle };
  });
  const party = h('div', 'party');
  const left = actor('npc', { px: 0.26 });
  const right = actor('npc', { px: 0.26 });
  const cat = actor('op', { px: 0.42 });
  const star = h('div', 'star');
  star.append(sprite('cakeday-hat', { tone: 'pink', px: 0.24 }, 'hat'), cat.el);
  left.el.classList.add('guest');
  right.el.classList.add('guest');
  party.append(left.el, star, right.el);
  wrap.append(field, bunting, party);
  root.append(wrap);

  let prev = -1;
  // The music kicks on every multiple of `beat`, starting SYNC ms into the round.
  // Flames land on those kicks; the first one leaves room for a full fall.
  const first = Math.ceil((FALL + 200) / beat) * beat + BEAT_SYNC;
  for (let k = 0, at = first; at < duration - 200; k++, at += beat / 2) {
    // Early rounds play quarter notes; later rounds fill in the off-beats.
    const off = k % 2 === 1;
    if (off && rng() > level * 0.2) continue;
    let lane = randBtn(rng);
    if (off) while (lane === prev) lane = randBtn(rng);
    prev = lane;
    const el = h('div', 'drop');
    el.append(sprite('cakeday-drop', { tone: COLOR[lane], px: 0.22 }));
    el.style.display = 'none';
    lanes[lane].chute.append(el);
    notes.push({ at, lane, el, state: 'fall', y: '' });
  }
  let hits = 0;
  let stray = 0;
  let pulseAt = -1; // the last beat the cake bounced on

  // The crowd's faces: a mood holds for a moment, then they settle back.
  let moodUntil = 0;
  let mood: ActorMood = 'idle';
  function react(m: ActorMood, t: number, guests: ActorMood = m) {
    mood = m;
    moodUntil = t + 450;
    cat.mood(m);
    left.mood(guests);
    right.mood(guests);
  }
  let now = 0;

  return {
    press(b, t) {
      now = t;
      const n = notes.find((x) => x.state === 'fall' && x.lane === b && t >= x.at - EARLY && t <= x.at + LATE);
      if (!n) {
        stray++;
        react('shock', t, 'angry');
        bad(lanes[b].candle, 'OFF BEAT');
        return;
      }
      n.state = 'hit';
      n.el.style.display = 'none';
      hits++;
      lanes[b].candle.classList.add('lit');
      react('happy', t);
      pulse(star, 'bump');
      good(lanes[b].candle, Math.abs(t - n.at) < 60 ? 'PERFECT' : undefined);
      if (hits === notes.length) {
        fx.burst(cake, 'gold', 26);
        fx.pop(cake, 'WISH!', 'gold');
      }
    },
    tick(t) {
      now = t;
      // The cake bounces on every kick, so the beat can be seen as well as heard.
      const k = Math.floor((t - BEAT_SYNC) / beat);
      if (k !== pulseAt && t >= BEAT_SYNC) {
        pulseAt = k;
        pulse(cake, 'thump');
      }
      for (const n of notes) {
        if (n.state !== 'fall') continue;
        const p = (t - (n.at - FALL)) / FALL;
        if (p < 0) continue;
        if (t > n.at + LATE) {
          n.state = 'miss';
          n.el.style.display = 'none';
          lanes[n.lane].candle.classList.remove('lit');
          if (mood === 'idle') react('sad', t, 'sad');
          continue;
        }
        if (n.y === '') n.el.style.display = '';
        // The drop fills the chute with the flame at its bottom; sliding it up by the
        // chute height minus the flame lands the flame exactly on the wick at p = 1.
        const y = `translateY(calc((100% - 2.64em) * ${(Math.min(1, p) - 1).toFixed(3)}))`;
        if (y !== n.y) {
          n.y = y;
          n.el.style.transform = y;
        }
      }
      if (moodUntil && now >= moodUntil) {
        moodUntil = 0;
        react('idle', now);
        moodUntil = 0;
      }
    },
    score: () => clamp1000((1000 * (hits - stray / 3)) / notes.length),
    hint(t) {
      const n = notes.find((x) => x.state === 'fall' && t >= x.at - 20 && t <= x.at + LATE);
      return n ? n.lane : null;
    },
  };
};
