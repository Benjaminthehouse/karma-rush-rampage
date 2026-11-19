import './maincharacter.css';
import { h, pick, pulse, ratio, shuffled, type GameFactory } from './common';

const SPOTS = [0, 1, 2, 3, 4];
// Stick-figure arms and legs on a 40x56 grid; the head and torso never move.
const TORSO = 'M20 16V36';
const STAND = 'M20 21L13 33M20 21L27 33M20 36L15 53M20 36L25 53';
const STRIDE = [
  'M20 21L14 32M20 21L27 31M20 36L11 52M20 36L27 53',
  'M20 21L26 32M20 21L13 31M20 36L29 52M20 36L13 53',
];
const SLUMP = 'M20 21L17 35M20 21L23 35M20 36L17 53M20 36L23 53';
const POSES = [
  { name: 'STARFISH!', limbs: 'M20 21L5 8M20 21L35 8M20 36L6 53M20 36L34 53' },
  { name: 'FLEX!', limbs: 'M20 22H9V10M20 22H31V10M20 36L13 53M20 36L27 53' },
  { name: 'T-POSE!', limbs: 'M3 22H37M20 36L17 53M20 36L23 53' },
  { name: 'DISCO!', limbs: 'M20 21L35 5M20 21L11 26L18 32M20 36L10 52M20 36L24 53' },
  { name: 'JAZZ HANDS!', limbs: 'M20 21L10 26L4 16M20 21L30 26L36 16M20 36L11 44L14 53M20 36L29 44L26 53' },
  { name: 'HIGH KICK!', limbs: 'M20 21L7 14M20 21L33 14M20 36L37 24M20 36L18 53' },
  { name: 'POWER STANCE!', limbs: 'M20 21L10 27L18 33M20 21L30 27L22 33M20 36L9 53M20 36L31 53' },
  { name: 'DAB!', limbs: 'M20 21L36 8M20 21L28 15L14 9M20 36L13 53M20 36L27 53' },
];
const HYPE = [
  'The crowd goes feral.',
  'The fancam edit is already up.',
  'Chat is spamming W.',
  'Background characters could never.',
  'Protagonist behaviour.',
  'Straight to the front page.',
  'Absolute cinema.',
  'Everyone else is an extra.',
];
const CRINGE = [
  'Posed in the dark. Crickets.',
  'Nobody saw that. Probably.',
  'The crowd checked their phones.',
  'One for the cringe compilation.',
  'Aura: in shambles.',
  'Somebody clipped that.',
];
const SLOW = ['The spotlight got bored and left.', 'Too slow. The moment passed.', 'The light found a new main character.'];

function figure(cls: string) {
  const el = h('div', cls);
  el.innerHTML =
    '<svg viewBox="0 0 40 56" aria-hidden="true"><path class="cape"/><path class="limbs"/><circle cx="20" cy="9" r="6.5"/></svg>';
  const [cape, limbs] = el.firstElementChild!.children;
  return { el, cape, draw: (d: string) => limbs.setAttribute('d', TORSO + d) };
}

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 10 + level * 0.75; // lit poses for a full score
  const stay = 2400 - level * 250; // ms the light waits before it wanders off
  // Every light lands at least two steps from the last one, so there is always a walk.
  const lights: number[] = [];
  let at = 2;
  while (lights.length < 64) {
    const from = at;
    at = pick(rng, SPOTS.filter((s) => Math.abs(s - from) >= 2));
    lights.push(at);
  }
  const poses = shuffled(rng, POSES);
  const hype = shuffled(rng, HYPE);
  const cringe = shuffled(rng, CRINGE);

  let pos = 2;
  let idx = 0; // which light is on
  let litAt = 0;
  let posed = 0;
  let cringes = 0;
  let missed = 0; // lights in a row that left without a pose; each makes the next one more patient
  let streak = 0;
  let strides = 0;
  let frozen = false;
  let frozenUntil = 0;

  const wrap = h('div', 'g-maincharacter');
  const aura = h('div', 'aura');
  const points = h('b', '', '0');
  aura.append('AURA ', points);
  const scene = h('div', 'scene');
  const floor = h('div', 'floor');
  const lanes = SPOTS.map(() => {
    const lane = h('div', 'lane');
    lane.append(h('i', 'lamp'), h('i', 'cone'), h('i', 'spot'));
    floor.append(lane);
    return lane;
  });
  const ghost = figure('ghost');
  const hero = figure('hero');
  hero.draw(STAND);
  floor.append(ghost.el, hero.el);
  const marquee = h('i', 'marquee');
  const crowd = h('div', 'crowd');
  scene.append(floor, marquee, crowd);
  const note = h('div', 'g-note', 'Find the light. Strike a pose.');
  wrap.append(aura, scene, note);
  root.append(wrap);

  const light = () => lights[idx % lights.length];

  function place() {
    hero.el.style.left = `${pos * 20 + 10}%`;
    hero.el.classList.toggle('lit', pos === light());
  }
  function shine(t: number) {
    litAt = t;
    lanes.forEach((lane, i) => lane.classList.toggle('lit', i === light()));
    place();
  }
  function tally() {
    const total = posed * 100 - cringes * 1000;
    points.textContent = total > 0 ? `+${total}` : String(total);
    aura.classList.toggle('neg', total < 0);
    pulse(points, 'bump');
    // The cape grows with every clean pose in a row.
    const s = Math.min(streak, 5);
    hero.cape.setAttribute('d', s ? `M15 19H25L${25 + s * 2} ${27 + s * 5}H${15 - s * 2}Z` : '');
  }
  shine(0);

  return {
    press(b, t) {
      if (t < frozenUntil) return;
      if (b !== 1) {
        const to = pos + b - 1;
        if (to < 0 || to > 4) {
          pulse(hero.el, 'shake');
          return;
        }
        pos = to;
        hero.el.classList.remove('posing');
        hero.draw(STRIDE[strides++ % 2]);
        place();
        fx.sound('tick');
        return;
      }
      if (pos !== light()) {
        cringes++;
        streak = 0;
        frozen = true;
        frozenUntil = t + 400;
        hero.el.classList.remove('posing');
        hero.el.classList.add('cringe');
        hero.draw(SLUMP);
        note.textContent = cringe[cringes % cringe.length];
        bad(marquee, '-1000 AURA');
        fx.sound('thud');
        tally();
        return;
      }
      const pose = poses[posed % poses.length];
      posed++;
      streak++;
      missed = 0;
      hero.el.classList.add('posing');
      hero.draw(pose.limbs);
      // The freeze-frame lingers where the pose was struck.
      ghost.draw(pose.limbs);
      ghost.el.style.left = `${pos * 20 + 10}%`;
      pulse(ghost.el, 'snap');
      pulse(crowd, 'flash');
      note.textContent = hype[posed % hype.length];
      good(hero.el);
      fx.pop(marquee, pose.name, 'gold');
      fx.pop(aura, '+100', 'gold');
      if (streak % 3 === 0) {
        fx.burst(hero.el, 'gold', 22);
        fx.flash('gold');
        fx.sound('coin');
      }
      tally();
      idx++;
      shine(t);
    },
    tick(t) {
      if (frozen && t >= frozenUntil) {
        frozen = false;
        hero.el.classList.remove('cringe');
        hero.draw(STAND);
      }
      const patience = stay + missed * 400;
      if (t - litAt >= patience) {
        note.textContent = SLOW[idx % SLOW.length];
        fx.sound('whoosh');
        missed++;
        idx++;
        shine(t);
      }
      // The cone narrows as the light loses patience, then flickers before it leaves.
      const life = 1 - (t - litAt) / patience;
      scene.style.setProperty('--life', life.toFixed(2));
      scene.classList.toggle('going', life < 0.3);
    },
    score: () => ratio(posed - cringes / 2, par),
    hint(t) {
      if (t < frozenUntil) return null;
      return pos === light() ? 1 : pos > light() ? 0 : 2;
    },
  };
};
