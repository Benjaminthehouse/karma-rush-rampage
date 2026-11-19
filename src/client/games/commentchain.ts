import './commentchain.css';
import { COLOR, clamp1000, h, randBtn, type Btn, type GameFactory } from './common';

const REPLIES = ['this', '^ this', 'came here to say this', 'underrated comment', 'take my upvote', 'username checks out', 'and my axe', 'same', 'source?', 'r/angryupvote'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const stepMs = 400 - level * 35; // how long each reply lights up while you watch
  const firstLen = 3 + Math.floor(level / 2);
  const par = 8 + level * 2; // replies played back correctly
  const chains = Array.from({ length: 12 }, (_, i) => {
    const len = Math.min(6, firstLen + Math.floor(i / 2));
    const seq: Btn[] = [];
    while (seq.length < len) {
      const b = randBtn(rng);
      if (seq.length >= 2 && seq[seq.length - 1] === b && seq[seq.length - 2] === b) continue;
      seq.push(b);
    }
    return seq.map((b) => ({ b, text: REPLIES[Math.floor(rng() * REPLIES.length)] }));
  });
  let chain = 0;
  let showFrom = 300; // when the current chain starts lighting up
  let input = -1; // index of the reply expected next, or -1 while watching
  let done = 0;
  let wrong = 0;
  let lit = -2;

  const wrap = h('div', 'g-commentchain');
  const banner = h('div', 'rule');
  const thread = h('div', 'thread');
  const note = h('div', 'g-note');
  wrap.append(banner, thread, note);
  root.append(wrap);
  let rows: HTMLElement[] = [];

  function build() {
    rows = chains[chain % chains.length].map((c, i) => {
      const row = h('div', `reply c-${COLOR[c.b]}`, c.text);
      row.style.marginLeft = `${i * 0.7}em`;
      thread.append(row);
      return row;
    });
    thread.replaceChildren(...rows);
  }
  build();

  function paint(now: number) {
    if (now === lit) return;
    lit = now;
    rows.forEach((r, i) => {
      r.classList.toggle('lit', input < 0 && i === now);
      r.classList.toggle('done', input >= 0 && i < input);
      r.classList.toggle('hidden', input >= 0 && i >= input);
    });
    banner.innerHTML = input < 0 ? 'Watch…' : '<b>Your turn!</b>';
    note.textContent = `${done} replies chained`;
  }

  function nextChain(t: number) {
    chain++;
    input = -1;
    showFrom = t + 350;
    lit = -2;
    build();
  }

  return {
    press(b, t) {
      if (input < 0) return;
      const seq = chains[chain % chains.length];
      if (b === seq[input].b) {
        done++;
        good(rows[input]);
        input++;
        lit = -2;
        if (input === seq.length) {
          fx.pop(thread, 'CHAIN COMPLETE!', 'gold');
          fx.burst(thread, 'gold', 16);
          fx.sound('coin');
          nextChain(t);
        }
      } else {
        wrong++;
        bad(rows[input], 'BROKE THE CHAIN');
        nextChain(t);
      }
    },
    tick(t) {
      const seq = chains[chain % chains.length];
      if (input < 0) {
        const step = Math.floor((t - showFrom) / stepMs);
        if (step >= seq.length) {
          input = 0;
          lit = -2;
          fx.sound('ding');
        }
        paint(step);
      } else paint(-1);
    },
    score: () => clamp1000((1000 * (done - wrong * 2)) / par),
    hint: () => (input >= 0 ? chains[chain % chains.length][input].b : null),
  };
};
