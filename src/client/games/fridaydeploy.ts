import './fridaydeploy.css';
import { COLOR, h, pick, pulse, randBtn, ratio, type GameFactory } from './common';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const GO = [
  'tests are green (mostly)',
  'LGTM, did not read',
  'works on my machine',
  'vibecoded, zero bugs',
  'approved by the intern',
  'rollback plan: vibes',
  'CI passed on retry 4',
  '1 file changed, +9,412 lines',
  'the reviewer is on holiday',
];
const BAIT = [
  'tiny one-line change, 4:59 PM',
  'it is just a config tweak',
  'what could possibly go wrong?',
  'nobody will even notice',
  'quick fix before the weekend',
  'you are on call, by the way',
  'everyone else already left',
  'the AI said it is fine',
];
const FEELS = ['(feels like a Friday)', '(basically Friday)', '(Friday eve!)'];
const HOTFIX = ['(but it is only a hotfix)', '(hotfix, totally safe)', '(the boss says ship it)'];
const SAFE = ['LOG OFF. TOUCH GRASS.', 'IT CAN WAIT.', 'MONDAY PROBLEM.', 'LAPTOP CLOSED.', 'WEEKEND SAVED.'];
const OUTAGE = ['enjoy your weekend', 'the pager knows where you live', 'the rollback failed too', 'status page: also down', 'see you on Saturday'];
const ROCKET =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 15h5L12 23z" fill="#ffcf3f"/><path d="M7.5 11 4 17l4.5-1.5zM16.5 11 20 17l-4.5-1.5z" fill="currentColor"/><path d="M12 1c4 3 5.5 8.5 4.5 14h-9C6.5 9.5 8 4 12 1z" fill="#f4f6ff" stroke="#0b1020" stroke-width="1.2"/><circle cx="12" cy="8.5" r="2" fill="#0b1020"/></svg>';

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 12 + Math.round(level / 2);
  // A Friday page tempts for longer than a reflex takes, then leaves on its own.
  const linger = 650 - level * 15;
  let lastFriday = true;
  const pages = Array.from({ length: 80 }, () => {
    // Never two Fridays in a row, so the round keeps moving.
    const friday = !lastFriday && rng() < (level >= 3 ? 0.4 : 0.3);
    lastFriday = friday;
    // From level 2 the sparkle stops being a tell: a calm Friday hotfix, a tempting Thursday.
    const decoy = level >= 2 && rng() < 0.3;
    const day = friday ? 'FRIDAY' : decoy ? 'THURSDAY' : pick(rng, DAYS);
    const cap = pick(rng, decoy ? (friday ? HOTFIX : FEELS) : friday ? BAIT : GO);
    return { friday, btn: randBtn(rng), day, cap, shiny: friday !== decoy };
  });
  let idx = -1; // flip() turns to the next page
  let shownAt = 0;
  let lockedUntil = 0; // prod is down until then
  let deploys = 0;
  let dodged = 0;
  let outages = 0;

  const wrap = h('div', 'g-fridaydeploy');
  const cal = h('div', 'cal');
  const sheet = h('div', 'sheet');
  const day = h('div', 'day');
  const word = h('b');
  day.append(word);
  const cap = h('div', 'cap');
  const btn = h('div', 'btn');
  btn.innerHTML = `${ROCKET}<span>DEPLOY</span>`;
  sheet.append(h('div', 'head', 'TODAY IS'), day, cap, btn);
  const rocket = h('i', 'rocket');
  rocket.innerHTML = ROCKET;
  const outage = h('div', 'outage');
  const sorry = h('span');
  outage.append(h('b', '', 'PROD IS DOWN'), sorry, h('i', 'pager', 'BZZT BZZT'));
  cal.append(sheet, rocket, outage);
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  const note = h('div', 'g-note');
  wrap.append(cal, meter, note);
  root.append(wrap);

  const page = () => pages[idx % pages.length];

  function tally() {
    fill.style.width = `${Math.min(100, (deploys / par) * 100)}%`;
    note.textContent = `${deploys} shipped to prod`;
  }

  function flip(t: number) {
    idx++;
    shownAt = t;
    const p = page();
    cal.className = 'cal';
    word.textContent = p.day;
    word.style.setProperty('--n', String(p.day.length));
    cap.textContent = p.cap;
    btn.className = `btn c-${COLOR[p.btn]}${p.shiny ? ' shiny' : ''}`;
    pulse(sheet, 'flip');
    tally();
  }
  flip(0);

  return {
    press(b, t) {
      if (lockedUntil) return;
      const p = page();
      if (p.friday) {
        deploys = Math.max(0, deploys - 2);
        lockedUntil = t + 650;
        sorry.textContent = OUTAGE[outages++ % OUTAGE.length];
        cal.className = 'cal down';
        tally();
        bad(meter, '-2 ROLLED BACK');
        fx.flash('red');
        fx.sound('power');
        return;
      }
      if (b !== p.btn) {
        deploys = Math.max(0, deploys - 1);
        tally();
        pulse(cal, 'shake');
        bad(btn, 'WRONG BUTTON');
        return;
      }
      deploys++;
      rocket.className = `rocket c-${COLOR[p.btn]}`;
      pulse(rocket, 'fly');
      good(btn);
      fx.sound('whoosh');
      if (deploys % 5 === 0) {
        fx.pop(meter, `${deploys} SHIPPED!`, 'gold');
        fx.burst(meter, 'gold', 16);
        fx.sound('coin');
      }
      flip(t);
    },
    tick(t) {
      if (lockedUntil) {
        if (t < lockedUntil) return;
        lockedUntil = 0;
        flip(t);
      } else if (page().friday && t - shownAt >= linger) {
        fx.pop(note, SAFE[dodged++ % SAFE.length], 'green');
        fx.sound('ding');
        flip(t);
      }
    },
    score: () => ratio(deploys, par),
    hint: () => (lockedUntil || page().friday ? null : page().btn),
  };
};
