import './firstcomment.css';
import { actor, COLOR, COLOR_NAME, clamp1000, h, padDots, pick, postCard, pulse, randBtn, randInt, type Actor, type ActorMood, type Btn, type GameFactory } from './common';

const POSTS = [
  'Cat sits in a box',
  'I baked a suspicious pie',
  'Sunset, but orange',
  'My first marathon!',
  'This cloud looks like a dog',
  'Found a cool stick',
  'New keyboard day',
  'We adopted a goat',
];
const LIVE = 900; // ms a post stays open for the first comment
const SUBS = ['r/aww', 'r/pics', 'r/mildlyinteresting', 'r/food', 'r/DIY', 'r/CozyPlaces'];

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  const fullMarks = 300 - level * 15; // reaction time that still earns the whole drop
  const drops: { at: number; btn: Btn; text: string; sub: string }[] = [];
  let at = 900;
  while (at + 450 < duration) {
    drops.push({ at, btn: randBtn(rng), text: pick(rng, POSTS), sub: pick(rng, SUBS) });
    at += LIVE + 250 + randInt(rng, 450, 1250) - level * 110;
  }
  let idx = 0; // the next (or current) drop
  let state: 'wait' | 'live' | 'done' = 'wait';
  let earned = 0;
  let firsts = 0;
  // A stray tap at the bell, or a late answer to a post that just timed out, is not a false start.
  let quiet = 250;
  let waitAt = 0; // when the blocks reset after somebody else won

  // The race track: the post board hangs over the finish, three commenters crouch on
  // their blocks below it. The post dropping is the starter's gun.
  const wrap = h('div', 'g-firstcomment scene-stage');
  const board = h('div', 'board');
  const card = postCard({ sub: 'r/all', title: '', votes: 1, tone: 'grey', big: true });
  const call = h('div', 'call');
  // Verdicts and reaction times float up from just above the card, clear of its text.
  const stamp = h('i', 'stamp');
  board.append(card.el, call, stamp);
  const track = h('div', 'track');
  const lanes = h('div', 'lanes');
  const racers: { a: Actor; el: HTMLElement }[] = [
    actor('npc', { px: 0.26 }),
    actor('op', { px: 0.44 }),
    actor('lurker', { px: 0.26 }),
  ].map((a, i) => {
    const el = h('div', `racer${i === 1 ? ' you' : ''}`);
    el.append(a.el, h('i', 'block'));
    lanes.append(el);
    return { a, el };
  });
  const you = racers[1];
  const note = h('div', 'g-note');
  track.append(lanes, note);
  wrap.append(board, track);
  root.append(wrap);

  /** Who bursts off the blocks (or nobody), and everyone's face. */
  function race(go: number, moods: [ActorMood, ActorMood, ActorMood]) {
    racers.forEach((r, i) => {
      r.el.classList.toggle('go', i === go);
      r.a.mood(moods[i]);
    });
  }

  function waiting() {
    state = 'wait';
    wrap.classList.remove('live', 'done');
    card.tone('grey');
    card.set({ sub: drops[idx] ? drops[idx].sub : 'r/all', title: 'loading…' });
    card.votes(1);
    call.className = 'call';
    call.textContent = 'ON YOUR MARKS…';
    race(-1, ['idle', 'angry', 'peep']);
    note.textContent = `${firsts} first comment${firsts === 1 ? '' : 's'}`;
  }
  waiting();

  function close(text: string) {
    state = 'done';
    wrap.classList.remove('live');
    wrap.classList.add('done');
    call.className = 'call closed';
    call.textContent = text;
  }

  return {
    press(b, t) {
      const d = drops[idx];
      if (state === 'done') return;
      if (state === 'wait') {
        if (t < quiet) return;
        // Jumping the gun forfeits the upcoming post.
        pulse(you.el, 'shake');
        race(-1, ['happy', 'shock', 'happy']);
        bad(stamp, 'FALSE START');
        close('Removed: commenting on nothing');
        return;
      }
      if (!d) return;
      if (b !== d.btn) {
        race(-1, ['happy', 'sad', 'happy']);
        bad(stamp, 'WRONG COLOUR');
        close('You commented on the wrong post');
        return;
      }
      const ms = t - d.at;
      const share = Math.max(0.25, Math.min(1, 1 - (ms - fullMarks) / 600));
      earned += share;
      firsts++;
      race(1, ['shock', 'happy', 'shock']);
      card.votes(2);
      good(stamp, `${Math.round(ms)} ms`);
      if (share >= 1) fx.burst(card.el, COLOR[d.btn], 14);
      close('FIRST!');
      call.classList.add('win');
    },
    tick(t) {
      const d = drops[idx];
      if (!d) return;
      if (state === 'done' && t >= d.at + LIVE) {
        // After the last post the feed keeps "loading" until the bell, so the end is never a frozen card.
        idx++;
        waiting();
        return;
      }
      if (state === 'wait' && t >= d.at) {
        state = 'live';
        wrap.classList.add('live');
        card.tone(COLOR[d.btn]);
        card.set({ title: d.text });
        pulse(card.el, 'pop-in');
        call.className = `call live c-${COLOR[d.btn]}`;
        call.textContent = `Hit ${COLOR_NAME[d.btn]}!`;
        call.append(padDots(d.btn));
        race(-1, ['shock', 'shock', 'shock']);
        fx.sound('ding');
      } else if (state === 'live' && t >= d.at + LIVE) {
        // Somebody else got there first.
        race(idx % 2 ? 0 : 2, ['happy', 'sad', 'happy']);
        bad(stamp, 'SECOND.');
        quiet = t + 250;
        idx++;
        state = 'wait';
        call.className = 'call closed';
        call.textContent = 'Beaten to it';
        // The winner gets a moment before the blocks reset.
        waitAt = t + 300;
      }
      if (waitAt && t >= waitAt) {
        waitAt = 0;
        if (state === 'wait') waiting();
      }
    },
    score: () => clamp1000((1000 * earned) / drops.length),
    hint: () => (state === 'live' && drops[idx] ? drops[idx].btn : null),
  };
};
