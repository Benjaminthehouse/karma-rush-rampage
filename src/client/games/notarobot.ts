import './notarobot.css';
import { COLOR, clamp1000, h, pick, pulse, shuffled, type Btn, type GameFactory } from './common';

// Drawings stand on the bottom edge of their tile; most are tall, a few need a square canvas.
const svg = (shapes: string, box = '9 0 30 48') => `<svg viewBox="${box}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${shapes}</svg>`;
const WIDE = '0 0 48 48';
// Everything a tile can show: [what the checker calls it, its drawing].
const THINGS: Record<string, [string, string]> = {
  light: ['A TRAFFIC LIGHT', svg('<rect x="21.5" y="38" width="5" height="10" fill="#4a5270"/><rect x="13" y="2" width="22" height="38" rx="6" fill="#1b2136"/><circle cx="24" cy="10" r="5" fill="#ff4b55"/><circle cx="24" cy="21" r="5" fill="#ffcf3f"/><circle cx="24" cy="32" r="5" fill="#2fd66f"/>')],
  bus: ['A BUS', svg('<rect x="3" y="11" width="42" height="26" rx="6" fill="#ff9a3d"/><rect x="3" y="28" width="42" height="3" fill="#d9741c"/><rect x="7" y="16" width="9" height="9" rx="2" fill="#e6f4ff"/><rect x="19" y="16" width="9" height="9" rx="2" fill="#e6f4ff"/><rect x="31" y="16" width="10" height="9" rx="2" fill="#e6f4ff"/><circle cx="14" cy="38" r="5.5" fill="#1b2136"/><circle cx="34" cy="38" r="5.5" fill="#1b2136"/><circle cx="14" cy="38" r="2" fill="#9aa5cf"/><circle cx="34" cy="38" r="2" fill="#9aa5cf"/>', WIDE)],
  bike: ['A BIKE', svg('<g fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="36" r="8" stroke="#1b2136"/><circle cx="37" cy="36" r="8" stroke="#1b2136"/><path d="M11 36 19 21H33L37 36M19 21l6 15 8-15M11 36h14M33 21l-1-5h5M15 20h8" stroke="#e23a4a"/></g>', WIDE)],
  crossing: ['A CROSSWALK', svg('<rect x="2" y="16" width="44" height="30" rx="3" fill="#3d4563"/><path d="M9 20v22M19 20v22M29 20v22M39 20v22" stroke="#f4f6ff" stroke-width="6"/>', WIDE)],
  hydrant: ['A HYDRANT', svg('<path d="M17 41V18a7 8 0 0 1 14 0v23z" fill="#ff4b55"/><g fill="#b8202e"><rect x="13" y="40" width="22" height="6" rx="2"/><rect x="15" y="16.5" width="18" height="3.5" rx="1.7"/><rect x="22" y="5.5" width="4" height="5" rx="1.5"/><rect x="11" y="24" width="6" height="8" rx="2"/><rect x="31" y="24" width="6" height="8" rx="2"/><circle cx="24" cy="28" r="3.2"/></g>')],
  tree: ['A TREE', svg('<rect x="21" y="27" width="6" height="20" rx="2" fill="#8a5a2b"/><g fill="#2fbf62"><circle cx="24" cy="15" r="11"/><circle cx="17" cy="24" r="7.5"/><circle cx="31" cy="24" r="7.5"/></g>')],
  cone: ['A CONE', svg('<rect x="10" y="40" width="28" height="6" rx="2" fill="#d9741c"/><path d="M21 6h6l7.5 34h-21z" fill="#ff9a3d"/><path d="M18.6 17h10.8l1.8 8H16.8z" fill="#f4f6ff"/>')],
  icecream: ['ICE CREAM', svg('<path d="M15 29h18l-9 18z" fill="#d9a55b"/><circle cx="24" cy="27" r="8" fill="#2fd66f"/><circle cx="24" cy="17" r="7.2" fill="#ffcf3f"/><circle cx="24" cy="8.5" r="6.2" fill="#ff4b55"/>')],
  domino: ['A DOMINO', svg('<rect x="13" y="4" width="22" height="42" rx="5" fill="#f4f1e6" stroke="#1b2136" stroke-width="2.5"/><path d="M15 25h18" stroke="#1b2136" stroke-width="2"/><g fill="#1b2136"><circle cx="24" cy="14.5" r="3.4"/><circle cx="19.5" cy="31" r="3.2"/><circle cx="28.5" cy="39.5" r="3.2"/></g>')],
  menu: ['A MENU BUTTON', svg('<g fill="#4a5270"><circle cx="24" cy="9" r="5.5"/><circle cx="24" cy="24" r="5.5"/><circle cx="24" cy="39" r="5.5"/></g>')],
};
const DECOYS = ['bus', 'bike', 'crossing', 'hydrant', 'tree', 'cone'];
const FAKES = ['icecream', 'domino', 'menu'];
const CHEERS = ['SO HUMAN', 'NICE EYES', 'ORGANIC!', 'FLESH CONFIRMED', 'HAS A PULSE', 'PAYS TAXES'];
const QUIPS = [
  'Beep boop detected.',
  'Very robot of you.',
  'A human would know.',
  'Are you a toaster?',
  'Hmm. Suspicious.',
  'Nice try, bot.',
  'Have you tried having eyes?',
  'Robots love pressing that one.',
];
// Which columns hold a light, one bit each: singles and pairs are common, all three is a treat.
const LIGHTS = [1, 2, 4, 1, 2, 4, 3, 5, 6, 3, 5, 6, 7];
const BTNS: Btn[] = [0, 1, 2];

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 16 + level * 1.25;
  // More rows than anyone can clear, never the same columns twice running.
  let lights = 0;
  const rows = Array.from({ length: 40 }, () => {
    const prev = lights;
    while (lights === prev) lights = pick(rng, LIGHTS);
    const decoys = shuffled(rng, DECOYS);
    // Later rounds swap honest decoys for things that only look like a traffic light.
    return BTNS.map((b) => ({
      kind: (lights >> b) & 1 ? 'light' : rng() < level * 0.14 ? pick(rng, FAKES) : decoys[b],
      tilt: (rng() - 0.5) * (6 + level * 5),
    }));
  });
  const quips = shuffled(rng, QUIPS);
  let idx = 0;
  let ticked = [false, false, false];
  let verified = 0;
  let failed = 0;
  // After a wrong press: when the crossed-out row makes way for the next one. 0 while playable.
  let lockedUntil = 0;
  let proven = false;

  const wrap = h('div', 'g-notarobot');
  const panel = h('div', 'panel');
  const head = h('div', 'head');
  const ask = h('div', 'ask');
  ask.append(h('span', '', 'Select every tile with'), h('b', '', 'TRAFFIC LIGHTS'));
  const sample = h('i', 'sample');
  sample.innerHTML = THINGS.light[1];
  head.append(ask, sample);
  const strip = h('div', 'strip');
  const tiles = BTNS.map((b) => {
    const el = h('div', `tile c-${COLOR[b]}`);
    const pic = h('i', 'pic');
    el.append(pic, h('b', 'mark'));
    strip.append(el);
    return { el, pic };
  });
  const foot = h('div', 'foot');
  const box = h('i', 'box');
  box.append(h('b', 'mark'));
  const who = h('div', 'who');
  const pct = h('span', 'pct');
  const meter = h('div', 'meter');
  const fill = h('i');
  meter.append(fill);
  who.append(pct, meter);
  foot.append(box, who);
  panel.append(head, strip, foot);
  const note = h('div', 'g-note', 'Prove you are human.');
  wrap.append(panel, note);
  root.append(wrap);

  const row = () => rows[idx % rows.length];
  const todo = () => BTNS.filter((b) => row()[b].kind === 'light' && !ticked[b]);
  const score = () => clamp1000((1000 * (verified - 0.5 * failed)) / par);

  function deal() {
    ticked = [false, false, false];
    tiles.forEach((tile, b) => {
      tile.el.className = `tile c-${COLOR[b]}`;
      tile.pic.innerHTML = THINGS[row()[b].kind][1];
      tile.pic.style.setProperty('--tilt', `${row()[b].tilt}deg`);
    });
    pulse(strip, 'deal');
  }

  function gauge() {
    const s = score();
    fill.style.width = `${s / 10}%`;
    box.classList.toggle('on', s >= 1000);
    pct.textContent = s >= 1000 ? 'VERIFIED HUMAN (PROBABLY)' : `HUMAN ${Math.floor(s / 10)}%`;
    // Every failed check makes the pictures a little grainier.
    panel.style.setProperty('--grain', String(Math.min(0.34, 0.05 + level * 0.03 + failed * 0.05)));
    if (s < 1000 || proven) return;
    proven = true;
    fx.flash('gold');
    fx.burst(foot, 'gold', 30);
    fx.sound('power');
  }
  deal();
  gauge();

  return {
    press(b, t) {
      if (lockedUntil) return;
      const tile = tiles[b].el;
      const { kind } = row()[b];
      if (kind !== 'light') {
        failed++;
        lockedUntil = t + 450;
        tile.classList.add('no');
        pulse(panel, 'shake');
        bad(head, `THAT IS ${THINGS[kind][0]}`);
        note.textContent = quips[failed % quips.length];
        gauge();
        return;
      }
      if (ticked[b]) return fx.sound('tick');
      ticked[b] = true;
      tile.classList.add('ok');
      if (todo().length) {
        fx.burst(tile, 'gold', 5);
        fx.sound('tick');
        return;
      }
      verified++;
      idx++;
      good(box);
      pulse(box, 'blip');
      // A cheer every third check, up on the header where it hides nothing.
      if (verified % 3 === 0) fx.pop(head, CHEERS[(verified / 3 - 1) % CHEERS.length], 'gold');
      note.textContent = `${verified} check${verified === 1 ? '' : 's'} passed`;
      gauge();
      deal();
    },
    tick(t) {
      if (!lockedUntil || t < lockedUntil) return;
      lockedUntil = 0;
      idx++;
      deal();
    },
    score,
    hint: () => (lockedUntil ? null : todo()),
  };
};
