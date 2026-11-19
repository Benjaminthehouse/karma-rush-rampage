import './slashs.css';
import { COLOR, COLOR_NAME, arrow, clamp1000, h, pick, pulse, randBtn, shuffled, type Btn, type GameFactory } from './common';

// {c} becomes the colour word. Plain orders shout it in its own colour; dry ones make you read.
const PLAIN = ['Press {c}.', 'Hit {c}!', 'Smash {c}!', 'Go {c}. Trust me.', '{c}. Obviously.', 'It’s {c}. Easy.'];
const DRY = ['oh sure, press {c}', 'wow, {c}. genius.', 'yeah, totally {c}', '{c}, great idea', 'press {c}, big brain', 'clearly it’s {c}'];
const USERS = ['trust_me_bro', 'well_actually', 'SourceIMadeItUp', 'literally_larry', 'EditThanksKind', 'lurker_since_09', 'NotABot_4000', 'reply_guy_42', 'this_but_unironic', 'tone_tag_tina'];
const HUES = ['gold', 'pink', 'teal', 'purple'];
const AWARDS = ['BIG BRAIN', 'READ THE ROOM', 'SARCASM PHD', 'NOT A BOT', 'TOUCHED GRASS', 'TONE POLICE', 'GALAXY BRAIN', 'CERTIFIED LURKER'];
const PLANE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 10.5 22 3l-6.5 18-4-7.5z" fill="#f4f6ff" stroke="#0b1020" stroke-width="1.4" stroke-linejoin="round"/><path d="M22 3 11.5 13.5" stroke="#0b1020" stroke-width="1.4"/></svg>';

const GAP = 140; // ms an upvoted comment lingers before the next one
const LOCK = 400; // ms a misread costs

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + level;
  let prev = -1;
  const cards = Array.from({ length: 80 }, () => {
    let btn = randBtn(rng);
    while (btn === prev) btn = randBtn(rng);
    prev = btn;
    const dry = rng() < level * 0.2;
    return { btn, sarcasm: rng() < 0.4, dry, line: pick(rng, dry ? DRY : PLAIN), user: pick(rng, USERS), hue: pick(rng, HUES) };
  });
  const awards = shuffled(rng, AWARDS);
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let streak = 0;
  let pinned = 0;
  let nextAt = -1; // when the answered card makes way for the next; -1 while a card is live

  const wrap = h('div', 'g-slashs');
  const card = h('div', 'card');
  const who = h('div', 'who');
  const face = h('i', 'face');
  const name = h('span');
  who.append(face, name);
  const say = h('div', 'say');
  const text = h('span');
  say.append(text);
  const foot = h('div', 'foot');
  const up = arrow('up');
  const votes = h('span', 'votes', '0');
  foot.append(up, votes, h('span', 'act', 'Reply'), h('span', 'act', 'Share'));
  // The joke going over your head: only shown when a /s is taken literally.
  const whoosh = h('div', 'whoosh');
  const plane = h('i', 'plane');
  plane.innerHTML = PLANE;
  whoosh.append(plane, h('i', 'face'), h('b', '', 'WHOOSH'));
  card.append(who, say, foot, whoosh);
  const shelf = h('div', 'shelf');
  const slots = Array.from({ length: 5 }, () => h('i', 'slot'));
  shelf.append(...slots);
  const note = h('div', 'g-note', '3 in a row pins an award');
  wrap.append(card, shelf, note);
  root.append(wrap);

  const now = () => cards[idx % cards.length];

  function show() {
    const c = now();
    card.className = 'card';
    face.className = `face ${c.hue}`;
    name.textContent = `u/${c.user}`;
    const word = c.dry ? `<b>${COLOR_NAME[c.btn].toLowerCase()}</b>` : `<b class="t-${COLOR[c.btn]}">${COLOR_NAME[c.btn]}</b>`;
    text.innerHTML = c.line.replace('{c}', word) + (c.sarcasm ? ' <em>/s</em>' : '');
    pulse(card, 'pop-in');
  }
  show();

  function sync(t: number) {
    if (nextAt < 0 || t < nextAt) return;
    nextAt = -1;
    idx++;
    show();
  }

  return {
    press(b, t) {
      sync(t);
      if (nextAt >= 0) return;
      const c = now();
      if ((b === c.btn) === c.sarcasm) {
        wrong++;
        streak = 0;
        nextAt = t + LOCK;
        if (c.sarcasm) {
          card.classList.add('whoosh');
          fx.sound('whoosh');
          bad(card);
        } else {
          card.classList.add('miss');
          pulse(card, 'shake');
          bad(card, 'THEY MEANT IT');
        }
      } else {
        right++;
        streak++;
        nextAt = t + GAP;
        card.classList.add('ok');
        pulse(up, 'bump');
        good(up, c.sarcasm ? 'GOT THE JOKE' : undefined);
        if (streak % 3 === 0) {
          const slot = slots[Math.min(pinned, slots.length - 1)];
          slot.className = `slot on a-${pinned % slots.length}`;
          pulse(slot, 'pop-in');
          fx.pop(slot, awards[pinned % awards.length], 'gold');
          fx.burst(slot, 'gold', 14);
          fx.sound('coin');
          pinned++;
        }
      }
      votes.textContent = String(right - wrong);
      note.textContent = streak >= 2 ? `${streak} in a row!` : '3 in a row pins an award';
    },
    tick: sync,
    score: () => clamp1000((1000 * (right - wrong)) / par),
    hint() {
      if (nextAt >= 0) return null;
      const c = now();
      return c.sarcasm ? (((c.btn + 1) % 3) as Btn) : c.btn;
    },
  };
};
