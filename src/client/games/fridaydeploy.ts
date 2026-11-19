import './fridaydeploy.css';
import { COLOR, dealer, h, padDots, person, pulse, randBtn, ratio, sprite, type GameFactory } from './common';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const GO = [
  'tests are green (mostly)',
  'LGTM, did not read',
  'works on my machine',
  'vibecoded, zero bugs',
  'approved by the intern',
  'rollback plan: vibes',
  'CI passed on retry 4',
  '1 file changed, +9,412',
  'reviewer is on holiday',
];
const BAIT = [
  'one-line change, 4:59 PM',
  'it is just a config tweak',
  'what could go wrong?',
  'nobody will even notice',
  'last fix before the weekend',
  'guess who is on call? you',
  'everyone else went home',
  'the AI said it is fine',
];
const FEELS = ['(feels like a Friday)', '(basically Friday)', '(Friday eve!)'];
const HOTFIX = ['(it is only a hotfix)', '(hotfix, totally safe)', '(the boss says ship it)'];
const SAFE = ['LOG OFF. TOUCH GRASS.', 'IT CAN WAIT.', 'MONDAY PROBLEM.', 'LAPTOP CLOSED.', 'WEEKEND SAVED.'];
const OUTAGE = ['enjoy your weekend', 'the pager knows where you live', 'the rollback failed too', 'status page: also down', 'see you on Saturday'];
const DOWN = 650; // ms prod stays down (and your hands stay off) after a Friday deploy

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.round(level / 2);
  // A Friday page tempts for longer than a reflex takes, then leaves on its own.
  const linger = 650 - level * 15;
  const weekday = dealer(rng, DAYS);
  const go = dealer(rng, GO);
  const bait = dealer(rng, BAIT);
  const feels = dealer(rng, FEELS);
  const hotfix = dealer(rng, HOTFIX);
  let lastFriday = true;
  const pages = Array.from({ length: 80 }, () => {
    // Never two Fridays in a row, so the round keeps moving.
    const friday = !lastFriday && rng() < (level >= 3 ? 0.4 : 0.3);
    lastFriday = friday;
    // From level 2 the sparkle stops being a tell: a calm Friday hotfix, a tempting Thursday.
    const decoy = level >= 2 && rng() < 0.3;
    const day = friday ? 'FRIDAY' : decoy ? 'THURSDAY' : weekday();
    const cap = (decoy ? (friday ? hotfix : feels) : friday ? bait : go)();
    return { friday, btn: randBtn(rng), day, cap, shiny: friday !== decoy };
  });
  let idx = -1; // flip() turns to the next page
  let shownAt = 0;
  let downUntil = 0;
  let deploys = 0;
  let dodged = 0;
  let outages = 0;

  // The scene: a tear-off calendar on the office wall. On the desk under it sit you,
  // the rockets you have shipped, and the prod server.
  const wrap = h('div', 'g-fridaydeploy scene-office');
  const cal = h('div', 'cal');
  const sheet = h('div', 'sheet');
  const day = h('div', 'day');
  const word = h('b');
  day.append(word);
  const cap = h('div', 'cap');
  const btn = h('div', 'btn');
  const which = h('span', 'which');
  btn.append(sprite('rocket', { px: 0.12 }), h('span', '', 'DEPLOY'), which, sprite('spark', { px: 0.26 }, 'glint'), sprite('spark', { px: 0.26 }, 'glint'));
  sheet.append(h('div', 'head', 'TODAY IS'), day, cap, btn);
  const rocket = sprite('rocket', { px: 0.26 }, 'rocket');
  const outage = h('div', 'outage');
  const lost = h('em');
  const sorry = h('span');
  const pager = h('div', 'pager');
  pager.append(sprite('phone', { px: 0.13 }), h('span', '', 'bzzt! bzzt!'));
  outage.append(h('b', '', 'PROD IS DOWN'), lost, sorry, pager);
  const puff = h('i', 'puff');
  cal.append(sheet, rocket, puff, outage);
  const desk = h('div', 'desk');
  const dev = person({ tone: 'purple', px: 0.26 });
  const shipped = h('div', 'shipped');
  const pile = h('div', 'pile');
  const note = h('div', 'note');
  shipped.append(pile, note);
  const server = h('div', 'server');
  server.append(sprite('flame1', { px: 0.26 }, 'fire'), sprite('server', { px: 0.3 }));
  desk.append(dev.el, shipped, server);
  wrap.append(cal, desk);
  root.append(wrap);

  const page = () => pages[idx % pages.length];

  function tally() {
    // One little rocket on the desk for every deploy that is still live.
    while (pile.childElementCount < Math.min(deploys, 20)) pile.append(sprite('rocket', { px: 0.11 }));
    while (pile.childElementCount > deploys) pile.lastElementChild?.remove();
    note.textContent = `${deploys} shipped`;
  }

  function flip(t: number) {
    idx++;
    shownAt = t;
    const p = page();
    wrap.className = 'g-fridaydeploy scene-office';
    word.textContent = p.day;
    word.style.setProperty('--n', String(p.day.length));
    cap.textContent = p.cap;
    btn.className = `btn c-${COLOR[p.btn]}${p.shiny ? ' shiny' : ''}`;
    which.replaceChildren(padDots(p.btn));
    pulse(sheet, 'pop-in');
    tally();
  }
  flip(0);

  return {
    press(b, t) {
      if (downUntil) return;
      const p = page();
      if (p.friday) {
        lost.textContent = deploys ? `-${Math.min(2, deploys)} ROLLED BACK` : 'NOTHING LEFT TO ROLL BACK';
        deploys = Math.max(0, deploys - 2);
        downUntil = t + DOWN;
        sorry.textContent = OUTAGE[outages++ % OUTAGE.length];
        wrap.className = 'g-fridaydeploy scene-danger';
        dev.mood('dead');
        fx.poof(pile);
        tally();
        bad(pile);
        fx.flash('red');
        fx.sound('power');
        return;
      }
      if (b !== p.btn) {
        deploys = Math.max(0, deploys - 1);
        dev.mood('shock');
        tally();
        pulse(cal, 'shake');
        bad(btn, 'WRONG BUTTON');
        return;
      }
      deploys++;
      dev.mood('happy');
      pulse(rocket, 'fly');
      fx.poof(puff);
      good(btn);
      fx.sound('whoosh');
      if (deploys % 5 === 0) {
        fx.pop(note, `${deploys} SHIPPED!`, 'gold');
        fx.burst(pile, 'gold', 16);
        fx.sound('coin');
      }
      flip(t);
    },
    tick(t) {
      if (downUntil) {
        if (t < downUntil) return;
        downUntil = 0;
        flip(t);
      } else if (page().friday && t - shownAt >= linger) {
        dev.mood('cool');
        fx.pop(note, SAFE[dodged++ % SAFE.length], 'green');
        fx.sound('ding');
        flip(t);
      }
    },
    score: () => ratio(deploys, par),
    hint: () => (downUntil || page().friday ? null : page().btn),
  };
};
