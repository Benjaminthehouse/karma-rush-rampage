import './firstcomment.css';
import { COLOR, COLOR_NAME, clamp1000, h, pick, pulse, randBtn, randInt, type Btn, type GameFactory } from './common';

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

  const wrap = h('div', 'g-firstcomment');
  const post = h('div', 'post');
  const title = h('div', 'title');
  const box = h('div', 'box');
  post.append(title, box);
  const note = h('div', 'g-note');
  wrap.append(post, note);
  root.append(wrap);

  function waiting() {
    state = 'wait';
    post.className = 'post loading';
    title.textContent = `${drops[idx] ? drops[idx].sub : 'r/all'} is loading`;
    box.textContent = 'wait for it…';
    note.textContent = `${firsts} first comment${firsts === 1 ? '' : 's'}`;
  }
  waiting();

  function close(text: string) {
    state = 'done';
    post.className = 'post closed';
    box.textContent = text;
  }

  return {
    press(b, t) {
      const d = drops[idx];
      if (state === 'done') return;
      if (state === 'wait') {
        if (t < quiet) return;
        // Jumping the gun forfeits the upcoming post.
        pulse(post, 'shake');
        bad(post, 'TOO SOON');
        close('Removed: commenting on nothing');
        return;
      }
      if (!d) return;
      if (b !== d.btn) {
        bad(post, 'WRONG COLOUR');
        close('You commented on the wrong post');
        return;
      }
      const ms = t - d.at;
      const share = Math.max(0.25, Math.min(1, 1 - (ms - fullMarks) / 600));
      earned += share;
      firsts++;
      good(box, `${Math.round(ms)} ms`);
      if (share >= 1) fx.burst(post, COLOR[d.btn], 14);
      close('FIRST!');
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
        post.className = `post live c-${COLOR[d.btn]}`;
        title.textContent = d.text;
        box.textContent = `Hit ${COLOR_NAME[d.btn]}!`;
        fx.sound('ding');
      } else if (state === 'live' && t >= d.at + LIVE) {
        bad(post, 'SECOND.');
        quiet = t + 250;
        idx++;
        waiting();
      }
    },
    score: () => clamp1000((1000 * earned) / drops.length),
    hint: () => (state === 'live' && drops[idx] ? drops[idx].btn : null),
  };
};
