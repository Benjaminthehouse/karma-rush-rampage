import './modmail.css';
import { COLOR, h, pick, pulse, ratio, shuffled, type Btn, type GameFactory } from './common';

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
  '2ND CHANCE?',
];
// Each sent appeal knocks the ban down a step.
const BAN = ['PERMANENT', '365 DAYS', '30 DAYS', '3 DAYS', '1 HOUR', 'UNBANNED'];
const REASONS = ['Banned: too many puns', 'Banned: said “first”', 'Banned: reposted a repost', 'Banned: broke rule 4'];
const REPLIES = [
  ['no', 'lol no', 'nope'],
  ['still no', 'new mail who dis', 'read the rules'],
  ['...', 'hmm', 'you again?'],
  ['ugh, maybe', 'stop being nice', 'one more and I fold'],
  ['FINE. Unbanned.', 'ok ok, unbanned', 'unbanned, now shh'],
];
const AFTER = ['ok you can stop', 'we get it', 'go touch grass', 'this is not a chat'];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const want = 8 + Math.round(level * 0.6); // letters per appeal: 8 at first, 10 by the last round
  const lines = shuffled(rng, APPEALS.filter((a) => Math.abs(a.length - want) <= 1)).slice(0, 12);
  const replies = REPLIES.map((r) => pick(rng, r));
  // Par is the five appeals that lift the ban; every letter and every send is one press.
  const par = lines.slice(0, replies.length).reduce((n, l) => n + l.length + 1, 0);
  let idx = 0;
  let typed = 0;
  let last = -1; // the typing key used last; either may start a line
  let banked = 0;
  let nagged = -1000;
  let shown = -1;

  const wrap = h('div', 'g-modmail');
  const ban = h('div', 'ban');
  const term = h('b', '', BAN[0]);
  const now = h('div', 'now');
  now.append(h('span', '', 'YOUR BAN'), term);
  const steps = h('div', 'steps');
  const pips = replies.map(() => {
    const p = h('i');
    steps.append(p);
    return p;
  });
  ban.append(now, steps);
  const reply = h('div', 'reply');
  const said = h('span', '', pick(rng, REASONS));
  reply.append(h('i', 'shield'), h('b', '', 'MOD'), said);
  const mail = h('div', 'mail');
  const line = h('div', 'line');
  mail.append(h('div', 'to', 'TO: THE MODS'), line);
  const row = h('div', 'keys');
  const keys = [0, 1, 2].map((i) => {
    const k = h('div', `key c-${COLOR[i]}`, i === 1 ? 'SEND' : '');
    row.append(k);
    return k;
  });
  wrap.append(ban, reply, mail, row);
  root.append(wrap);

  const text = () => lines[idx % lines.length];
  const nextKey = () => (last === 0 ? 2 : 0);
  const cap = (i: number) => (text()[i] === ' ' ? '_' : text()[i] ?? '');

  function show() {
    const done = typed >= text().length;
    if (shown !== idx) {
      shown = idx;
      line.replaceChildren(...[...text()].map((ch) => h('i', '', ch)));
      pulse(mail, 'pop-in');
    }
    [...line.children].forEach((c, i) => (c.className = i < typed ? 'on' : i === typed ? `next c-${COLOR[nextKey()]}` : ''));
    line.classList.toggle('done', done);
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

  return {
    press(b, t) {
      const done = typed >= text().length;
      if (b === 1 && done) {
        banked += typed + 1;
        idx++;
        typed = 0;
        last = -1;
        good(keys[1], 'SENT');
        fx.sound('whoosh');
        term.textContent = BAN[Math.min(idx, BAN.length - 1)];
        pulse(term, 'bump');
        pips.forEach((p, i) => p.classList.toggle('on', i < idx));
        said.textContent = replies[idx - 1] ?? AFTER[(idx - replies.length - 1) % AFTER.length];
        pulse(reply, 'pop-in');
        if (idx === replies.length) {
          ban.classList.add('free');
          fx.flash('gold');
          fx.burst(ban, 'gold', 30);
          fx.pop(ban, 'UNBANNED!', 'gold');
          fx.sound('power');
        } else fx.burst(ban, 'gold', 10);
      } else if (b === 1) {
        // Sending half an appeal throws the draft away.
        typed = 0;
        last = -1;
        pulse(mail, 'shake');
        bad(mail, 'NOT FINISHED!');
      } else if (done) {
        pulse(keys[1], 'bump');
        fx.sound('tick');
        if (nag(t)) fx.pop(keys[1], 'SEND IT!', 'green');
      } else if (b === last) {
        if (nag(t)) {
          pulse(row, 'shake');
          bad(keys[b], 'ALTERNATE!');
        }
      } else {
        last = b;
        typed++;
        good(line.children[typed - 1]);
        if (typed === text().length) fx.sound('ding');
      }
      show();
    },
    tick() {},
    score: () => ratio(banked + typed, par),
    hint: () => (typed >= text().length ? 1 : (nextKey() as Btn)),
  };
};
