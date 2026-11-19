import './slashs.css';
import { COLOR, COLOR_NAME, clamp1000, dealer, defineSprite, h, person, pulse, randBtn, shuffled, sprite, type Btn, type GameFactory, type Tone } from './common';

// The joke, sailing over your head.
defineSprite('slashs-plane', `
kkk.............
kwwkkk..........
.kwwwwkkk.......
..kwwwwwwkkk....
...kwwwwwwwwkkk.
....kddddddddddk
.....kwwdkkkkkk.
......kwdk......
.......kkk......`);

// {c} becomes the colour word. Plain orders shout it on its own colour; dry ones make you read.
const PLAIN = ['Press {c}.', 'Hit {c}!', 'Smash {c}!', 'Go {c}. Trust me.', '{c}. Obviously.', 'It’s {c}. Easy.'];
const DRY = ['oh sure, press {c}', 'wow, {c}. genius.', 'yeah, totally {c}', '{c}, great idea', 'press {c}, big brain', 'clearly it’s {c}'];
const USERS = ['trust_me_bro', 'well_actually', 'SourceIMadeItUp', 'literally_larry', 'EditThanksKind', 'lurker_since_09', 'NotABot_4000', 'reply_guy_42', 'this_but_unironic', 'tone_tag_tina'];
const SKINS: Tone[] = ['gold', 'pink', 'teal', 'purple', 'orange'];
const KINDS = ['plain', 'cat', 'bear'] as const;
const AWARDS = ['BIG BRAIN', 'READ THE ROOM', 'SARCASM PHD', 'NOT A BOT', 'TOUCHED GRASS', 'TONE POLICE', 'GALAXY BRAIN', 'CERTIFIED LURKER'];
const PRIZES = ['star', 'coin', 'trophy', 'heart', 'crown'];

const GAP = 140; // ms an upvoted comment lingers before the next one
const LOCK = 400; // ms a misread costs

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Comments to read right for a full score: a decision about every 560 ms, tightening to 440 ms.
  const par = 10 + level / 2;
  const plain = dealer(rng, PLAIN);
  const dry = dealer(rng, DRY);
  const user = dealer(rng, USERS);
  const skin = dealer(rng, SKINS);
  let prev = -1;
  const cards = Array.from({ length: 80 }, (_, n) => {
    let btn = randBtn(rng);
    while (btn === prev) btn = randBtn(rng);
    prev = btn;
    // The opening comment is always a plain, sincere order: obey first, then the twist.
    const isDry = rng() < level * 0.2 && n > 0;
    const sarcasm = rng() < 0.4 && n > 0;
    return { btn, sarcasm, dry: isDry, line: (isDry ? dry : plain)(), user: user(), tone: skin(), kind: Math.floor(rng() * KINDS.length) };
  });
  const awards = shuffled(rng, AWARDS);
  let idx = 0;
  let right = 0;
  let wrong = 0;
  let streak = 0;
  let pinned = 0;
  let nextAt = -1; // when the answered card makes way for the next; -1 while a card is live

  // The scene: a comment thread. The rule is pinned up top, one loud comment fills the
  // middle, and the awards you earn for reading the room line up underneath.
  const wrap = h('div', 'g-slashs scene-feed');
  const rule = h('div', 'rule');
  rule.innerHTML = '<em>/s</em> = any <b>OTHER</b> colour';
  const card = h('div', 'card');
  const who = h('div', 'who');
  const faces = KINDS.map((kind) => person({ kind, px: 0.17 }));
  let face = faces[0];
  const name = h('span');
  who.append(face.el, name);
  const say = h('div', 'say');
  const text = h('span');
  say.append(text);
  const foot = h('div', 'foot');
  const up = sprite('up', { tone: 'orange', px: 0.17 }, 'up');
  const votes = h('b', 'votes', '0');
  foot.append(up, votes, h('span', 'act', 'Reply'), h('span', 'act', 'Share'));
  // Only shown when a /s is taken literally.
  const over = h('div', 'over');
  const you = person({ tone: 'gold', mood: 'shock', px: 0.2 });
  over.append(sprite('slashs-plane', { px: 0.28 }, 'plane'), you.el, h('b', '', 'WHOOSH'));
  card.append(who, say, foot, over);
  const me = h('div', 'me');
  const shelf = h('div', 'shelf');
  const slots = Array.from({ length: 5 }, () => h('i', 'slot'));
  shelf.append(...slots);
  const note = h('div', 'note', '3 IN A ROW PINS AN AWARD');
  me.append(shelf, note);
  wrap.append(rule, card, me);
  root.append(wrap);

  const now = () => cards[idx % cards.length];

  function show() {
    const c = now();
    card.className = 'card';
    if (faces[c.kind] !== face) {
      face.el.replaceWith(faces[c.kind].el);
      face = faces[c.kind];
    }
    face.tone(c.tone);
    // A sarcastic commenter cannot keep a straight face.
    face.mood(c.sarcasm ? 'wink' : 'idle');
    name.textContent = `u/${c.user}`;
    const word = c.dry ? `<b>${COLOR_NAME[c.btn].toLowerCase()}</b>` : `<b class="chip c-${COLOR[c.btn]}">${COLOR_NAME[c.btn]}</b>`;
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
      // Wrong is obeying a /s, or disobeying a sincere order.
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
          face.mood('angry');
          pulse(card, 'shake');
          bad(card, 'THEY MEANT IT');
        }
      } else {
        right++;
        streak++;
        nextAt = t + GAP;
        card.classList.add('ok');
        face.mood('happy');
        pulse(up, 'bump');
        good(up);
        if (c.sarcasm) fx.pop(card, 'GOT THE JOKE', 'gold');
        if (streak % 3 === 0) {
          const slot = slots[Math.min(pinned, slots.length - 1)];
          slot.replaceChildren(sprite(PRIZES[pinned % PRIZES.length], { px: 0.2 }));
          slot.classList.add('on');
          pulse(slot, 'pop-in');
          fx.poof(slot);
          fx.pop(shelf, awards[pinned % awards.length], 'gold');
          fx.burst(slot, 'gold', 14);
          fx.sound('coin');
          pinned++;
        }
      }
      votes.textContent = String(right - wrong);
      note.textContent = streak >= 2 ? `${streak} IN A ROW!` : '3 IN A ROW PINS AN AWARD';
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
