import './commentchain.css';
import { actor, clamp1000, COLOR, defineSprite, h, pulse, randBtn, sprite, type ActorMood, type Btn, type GameFactory } from './common';

// What the thread is about, shown before the first reply of each chain.
const TOPICS = ['TIL cats sleep 16h a day', 'My cat made this', 'Is this a scam?', 'First post, be nice', 'What is your hot take?', 'Rate my desk setup', 'Found this in my attic', 'Unpopular opinion: socks'];
const REPLIES = ['this', '^ this', 'came here to say this', 'underrated comment', 'take my upvote', 'username checks out', 'and my axe', 'same', 'source?', 'r/angryupvote'];

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

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const stepMs = 400 - level * 35; // how long each reply lights up while you watch
  const firstLen = 3 + Math.floor(level / 2);
  // Replies played back correctly. Capped: late chains are long, so most of the round is spent
  // watching and 12 is all a quick player with a perfect memory has time to enter.
  const par = Math.min(12, 8 + level * 2);
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
  // A reaction (cheer, gasp) holds the neighbours' faces until this time.
  let reactUntil = 0;
  let reacting = false;

  // The scene: an apartment block on feed street. Each neighbour leans over a balcony in a
  // button colour; whoever is replying lights up and says it in the speech bubble above.
  const wrap = h('div', 'g-commentchain scene-street');
  const top = h('div', 'top');
  const banner = h('div', 'rule');
  const bubble = h('div', 'bubble');
  const said = h('div', 'said');
  bubble.append(said);
  top.append(banner, bubble);
  const block = h('div', 'block');
  // The upper floor: three shuttered windows, just scenery.
  const upper = h('div', 'upper');
  for (let i = 0; i < 3; i++) upper.append(h('i', 'win'));
  const balconies = h('div', 'balconies');
  block.append(upper, balconies);
  const spots = CAST.map((who, i) => {
    const spot = h('div', `spot c-${COLOR[i]}`);
    const glow = h('i', 'glow');
    const who_ = actor(who, { px: PX });
    const rail = h('div', 'rail');
    spot.append(glow, who_.el, rail);
    balconies.append(spot);
    return { spot, who: who_ };
  });
  const links = h('div', 'links');
  const note = h('div', 'tally');
  wrap.append(top, block, links, note);
  root.append(wrap);
  let linkEls: HTMLElement[] = [];
  const topics = chains.map(() => TOPICS[Math.floor(rng() * TOPICS.length)]);

  function build() {
    const seq = chains[chain % chains.length];
    linkEls = seq.map(() => sprite('commentchain-link', { tone: 'grey', px: 0.2 }, 'link'));
    links.replaceChildren(...linkEls);
  }
  build();

  function faces(m: (i: number) => ActorMood) {
    spots.forEach((s, i) => s.who.mood(m(i)));
  }

  function react(t: number, m: (i: number) => ActorMood) {
    faces(m);
    reacting = true;
    reactUntil = t + 380;
  }

  function paint(now: number) {
    if (now === lit) return;
    lit = now;
    const seq = chains[chain % chains.length];
    const speaker = input < 0 && now >= 0 && now < seq.length ? seq[now].b : -1;
    spots.forEach((s, i) => s.spot.classList.toggle('lit', i === speaker));
    if (!reacting) faces((i) => (i === speaker ? 'talk' : input >= 0 ? 'peep' : 'idle'));
    linkEls.forEach((l, i) => l.classList.toggle('on', input < 0 ? i <= now : i < input));
    wrap.classList.toggle('turn', input >= 0);
    if (input < 0) {
      banner.textContent = 'Watch the thread…';
      said.textContent = speaker >= 0 ? seq[now].text : now < 0 ? topics[chain % topics.length] : '…';
      bubble.dataset.at = String(speaker >= 0 ? speaker : 1);
      if (speaker >= 0) pulse(bubble, 'pop-in');
    } else {
      banner.textContent = 'Your turn!';
      said.textContent = input > 0 ? seq[input - 1].text : 'Repeat the chain';
      bubble.dataset.at = String(input > 0 ? seq[input - 1].b : 1);
    }
    note.textContent = `${done} ${done === 1 ? 'reply' : 'replies'} chained`;
  }

  function nextChain(t: number) {
    chain++;
    input = -1;
    showFrom = t + 350;
    lit = -2;
    build();
  }
  paint(-1);

  return {
    press(b, t) {
      const seq = chains[chain % chains.length];
      // Quick players start the moment the last reply lights up. A correct first press there
      // counts, so being early never silently eats a press and breaks the chain.
      if (input < 0 && t >= showFrom + (seq.length - 1) * stepMs && b === seq[0].b) input = 0;
      if (input < 0) {
        pulse(banner, 'bump'); // still watching: no penalty, but the press is acknowledged
        return;
      }
      if (b === seq[input].b) {
        done++;
        good(spots[b].spot);
        pulse(spots[b].spot, 'bump');
        react(t, (i) => (i === b ? 'happy' : 'peep'));
        input++;
        lit = -2;
        if (input === seq.length) {
          fx.pop(links, 'CHAIN COMPLETE!', 'gold');
          fx.burst(links, 'gold', 16);
          fx.sound('coin');
          react(t, () => 'happy');
          nextChain(t);
        }
      } else {
        wrong++;
        bad(spots[b].spot, 'BROKE THE CHAIN');
        pulse(spots[b].spot, 'shake');
        react(t, (i) => (i === b ? 'angry' : 'shock'));
        nextChain(t);
      }
    },
    tick(t) {
      if (reacting && t >= reactUntil) {
        reacting = false;
        lit = -2;
      }
      const seq = chains[chain % chains.length];
      if (input < 0) {
        const step = Math.floor((t - showFrom) / stepMs);
        if (step >= seq.length) {
          input = 0;
          lit = -2;
          fx.sound('ding');
        }
        paint(input < 0 ? step : -1);
      } else paint(-1);
    },
    score: () => clamp1000((1000 * (done - wrong * 2)) / par),
    hint: () => (input >= 0 ? chains[chain % chains.length][input].b : null),
  };
};
