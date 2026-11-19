import './modmail.css';
import { COLOR, comment, h, person, pick, pulse, ratio, shuffled, sprite, type Btn, type GameFactory, type Mood } from './common';

const APPEALS = [
  'MY BAD!',
  'PLEASE?',
  'UNBAN ME',
  'MODS PLS',
  'WHY THO?',
  'NOT FAIR',
  'I REPENT',
  'OOPS LOL',
  'SORRY :(',
  'PLS UNBAN',
  'I CHANGED',
  'WRONG GUY',
  'MERCY PLS',
  'I’M SORRY',
  'IT WAS LAG',
  'MY CAT DID',
  'MY BROTHER',
  'GOT HACKED',
  'WAS SATIRE',
  'JUST A PUN',
  'NEW ME NOW',
  'ASK MY MOM',
  'I LOVE MODS',
  'PLS PLS PLS',
  'AUTOCORRECT',
  'I WAS TIRED',
  'I’LL BEHAVE',
  'PRETTY PLS?',
];
// Each sent appeal knocks the ban down a step.
const BAN = ['PERMANENT', '1 YEAR', '1 MONTH', '1 WEEK', '1 HOUR', 'UNBANNED'];
const REASONS = ['Banned: too many puns', 'Banned: said “first”', 'Banned: reposted a repost', 'Banned: broke rule 4'];
const REPLIES = [
  ['no', 'lol no', 'nope'],
  ['still no', 'new mail who dis', 'read the rules'],
  ['...', 'hmm', 'you again?'],
  ['ugh, maybe', 'stop being nice', 'one more and I fold'],
  ['FINE. Unbanned.', 'ok ok, unbanned', 'unbanned, now shh'],
];
const AFTER = ['ok you can stop', 'we get it', 'go touch grass', 'this is not a chat'];
// The mod's face before any mail, after each of the five replies, and once you will not stop writing.
const MOODS: Mood[] = ['angry', 'cool', 'angry', 'idle', 'sad', 'happy', 'dead'];
const TOGETHER = 200; // ms: SEND this soon before the last letter was meant to land after it

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const want = 8 + Math.round(level * 0.6); // letters per appeal: 8 at first, 10 by the last round
  // A dozen appeals is more than anyone can send in one round.
  const lines = shuffled(rng, APPEALS.filter((a) => Math.abs(a.length - want) <= 1)).slice(0, 12);
  const replies = REPLIES.map((r) => pick(rng, r));
  // Par is the five appeals that lift the ban; every letter and every send is one press.
  const par = lines.slice(0, replies.length).reduce((n, l) => n + l.length + 1, 0);
  let idx = 0;
  let typed = 0;
  let last = -1; // the key that typed the previous letter of this appeal; either may start one
  let hand: Btn = 2; // the typing key pressed most recently, so the lit key follows your rhythm into the next appeal
  let banked = 0;
  let nagged = -1000;
  let early = -1000;
  let shown = -1;

  // The scene: the mod behind the counter of the mod office, your ban on the board
  // above, and on your side of the counter the appeal you are hammering out.
  const wrap = h('div', 'g-modmail scene-office');
  const office = h('div', 'office');
  const ban = h('div', 'ban');
  const term = h('b', '', BAN[0]);
  const now = h('div', 'now');
  now.append(sprite('lock', { px: 0.14 }), h('span', '', 'YOUR BAN'), term);
  const steps = h('div', 'steps');
  const pips = replies.map(() => {
    const p = h('i');
    steps.append(p);
    return p;
  });
  ban.append(now, steps);
  const counter = h('div', 'counter');
  const mod = person({ tone: 'brown', kind: 'bear', hat: 'mod', mood: MOODS[0], px: 0.28 });
  const reply = comment({ user: 'the_mod', text: pick(rng, REASONS), mod: true });
  counter.append(mod.el, reply.el);
  office.append(ban, counter);
  const inbox = h('div', 'inbox');
  const mail = h('div', 'mail');
  const to = h('div', 'to');
  to.append(sprite('envelope', { px: 0.09 }), h('span', '', 'TO: THE MODS'));
  const line = h('div', 'line');
  mail.append(to, line);
  const fly = sprite('envelope', { px: 0.24 }, 'fly');
  const row = h('div', 'keys');
  const keys = [0, 1, 2].map((i) => {
    const k = h('div', `key c-${COLOR[i]}`, i === 1 ? 'SEND' : '');
    row.append(k);
    return k;
  });
  inbox.append(mail, row, fly);
  wrap.append(office, inbox);
  root.append(wrap);

  const text = () => lines[idx % lines.length];
  const nextKey = (): Btn => ((last < 0 ? hand : last) === 0 ? 2 : 0);
  const cap = (i: number) => (text()[i] === ' ' ? '_' : text()[i] ?? '');

  function show() {
    const done = typed >= text().length;
    if (shown !== idx) {
      shown = idx;
      line.replaceChildren(...[...text()].map((ch) => h('i', '', ch)));
      pulse(mail, 'pop-in');
    }
    [...line.children].forEach((c, i) => (c.className = i < typed ? 'on' : i === typed ? `next c-${COLOR[nextKey()]}` : ''));
    mail.classList.toggle('ready', done);
    // The lit key is the pad to press; a typing key shows the letter it will type.
    keys.forEach((k, i) => k.classList.toggle('lit', i === (done ? 1 : nextKey())));
    keys[nextKey()].textContent = cap(typed);
    keys[2 - nextKey()].textContent = cap(typed + 1);
  }
  show();

  function nag(t: number) {
    if (t - nagged < 400) return false;
    nagged = t;
    return true;
  }

  function send() {
    banked += typed + 1;
    idx++;
    typed = 0;
    last = -1;
    pulse(fly, 'go');
    fx.poof(mail);
    good(keys[1], 'SENT');
    fx.sound('whoosh');
    term.textContent = BAN[Math.min(idx, BAN.length - 1)];
    pulse(term, 'drop');
    pips.forEach((p, i) => p.classList.toggle('on', i < idx));
    reply.text.textContent = replies[idx - 1] ?? AFTER[(idx - replies.length - 1) % AFTER.length];
    pulse(reply.el, 'pop-in');
    mod.mood(MOODS[Math.min(idx, MOODS.length - 1)]);
    pulse(mod.el, 'bump');
    if (idx === replies.length) {
      ban.classList.add('free');
      fx.flash('gold');
      fx.burst(ban, 'gold', 30);
      fx.burst(mod.el, 'green', 16);
      fx.pop(counter, 'FREE AT LAST!', 'gold');
      fx.sound('power');
    } else fx.burst(ban, 'gold', 10);
  }

  return {
    press(b, t) {
      const len = text().length;
      const done = typed >= len;
      if (b === 1 && done) send();
      else if (b === 1 && typed === len - 1) {
        // SEND a hair before the last letter: two thumbs landing together. Wait for the letter.
        early = t;
        fx.sound('tick');
        pulse(keys[1], 'shake');
        if (nag(t)) fx.pop(keys[1], 'ONE MORE!', 'green');
      } else if (b === 1) {
        // Sending half an appeal throws the draft away.
        typed = 0;
        last = -1;
        pulse(mail, 'shake');
        bad(mail, 'NOT FINISHED!');
      } else {
        hand = b;
        if (done) {
          // Typing past the end costs nothing but time.
          fx.sound('thud');
          pulse(keys[b], 'shake');
          if (nag(t)) fx.pop(keys[1], 'SEND IT!', 'green');
        } else if (b === last) {
          fx.sound('thud');
          pulse(keys[b], 'shake');
          if (nag(t)) bad(keys[b], 'ALTERNATE!');
        } else {
          last = b;
          typed++;
          good(line.children[typed - 1]);
          fx.sound(typed === len ? 'ding' : 'tick');
          if (typed === len && t - early < TOGETHER) send();
        }
      }
      show();
    },
    tick() {},
    score: () => ratio(banked + typed, par),
    hint: () => (typed >= text().length ? 1 : nextKey()),
  };
};
