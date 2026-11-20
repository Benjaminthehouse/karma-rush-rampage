import './maincharacter.css';
import { actor, h, padDots, pick, pulse, ratio, shuffled, type Actor, type ActorMood, type GameFactory } from './common';

const SPOTS = [0, 1, 2, 3, 4];
// OP Cat's body under its big head, on a 40x36 grid: the neck is at (20, 0) and the head
// sits above y = 0, so raised arms bend out past the head (elbows beyond x 6..34).
const TORSO = 'M15 3H25V18H15Z';
const STAND = 'M20 4L10 9L8 17M20 4L30 9L32 17M20 17L14 34M20 17L26 34';
const STRIDE = [
  'M20 4L11 10L9 17M20 4L29 8L34 13M20 17L10 33M20 17L27 34',
  'M20 4L29 10L31 17M20 4L11 8L6 13M20 17L30 33M20 17L13 34',
];
const SLUMP = 'M20 5L15 12L14 20M20 5L25 12L26 20M20 17L17 34M20 17L23 34';
const POSES = [
  { name: 'STARFISH!', limbs: 'M20 4L5 -2M20 4L35 -2M20 17L5 34M20 17L35 34' },
  { name: 'FLEX!', limbs: 'M20 5L5 5L5 -7M20 5L35 5L35 -7M20 17L13 34M20 17L27 34' },
  { name: 'T-POSE!', limbs: 'M0 5H40M20 17L17 34M20 17L23 34' },
  { name: 'DISCO!', limbs: 'M20 4L34 2L39 -12M20 4L9 10L15 16M20 17L9 33M20 17L24 34' },
  { name: 'JAZZ HANDS!', limbs: 'M20 5L6 9L2 -2M20 5L34 9L38 -2M20 17L11 25L14 34M20 17L29 25L26 34' },
  { name: 'HIGH KICK!', limbs: 'M20 4L4 0M20 4L36 0M20 17L39 7M20 17L18 34' },
  { name: 'POWER STANCE!', limbs: 'M20 5L8 10L15 15M20 5L32 10L25 15M20 17L7 34M20 17L33 34' },
  { name: 'DAB!', limbs: 'M20 4L38 -8M20 4L30 -3L12 -10M20 17L13 34M20 17L27 34' },
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
const GRACE = 250; // ms after the light walks off in which a pose is late, not cringe
const ENCORE = 160; // ms after a lit pose in which a second tap is the same pose, not a new one
const HEAD = 0.29; // one art pixel of OP Cat's head, in em (4.6em wide)

/** OP Cat with a body: the cast's head on an outlined stick body that strikes poses. */
function figure(cls: string, mood: ActorMood) {
  // `track` is one lane wide and slides a lane at a time; `fig` is the cat standing in it.
  const track = h('div', `track ${cls}`);
  const fig = h('div', 'fig');
  const head = actor('op', { px: HEAD, mood });
  const body = h('div', 'body');
  body.innerHTML =
    `<svg viewBox="0 0 40 36" aria-hidden="true"><path class="cape"/><path class="out"/><path class="shirt" d="${TORSO}"/><path class="limbs"/></svg>`;
  const [cape, out, , limbs] = body.firstElementChild!.children;
  fig.append(head.el, body);
  track.append(fig);
  return {
    track,
    fig,
    head,
    cape,
    draw: (d: string) => {
      out.setAttribute('d', d);
      limbs.setAttribute('d', d);
    },
  };
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
  let encoreUntil = 0;
  let leftSpot = -1; // where the light last walked off from, and when
  let leftAt = 0;
  let life = '';
  let crowdUntil = 0;

  // The party stage: a lighting rig with five lamps, one spot lit on the boards, OP Cat
  // walking between them, and a row of NPCs at the front with their phones out.
  const wrap = h('div', 'g-maincharacter scene-stage');
  const top = h('div', 'top');
  const aura = h('div', 'aura');
  const points = h('b', '', '0');
  aura.append('AURA ', points);
  const note = h('div', 'g-note', 'Find the light. Strike a pose.');
  top.append(aura, note);
  const scene = h('div', 'scene');
  const rig = h('i', 'rig');
  const floor = h('div', 'floor');
  const lanes = SPOTS.map(() => {
    const lane = h('div', 'lane');
    lane.append(h('i', 'lamp'), h('i', 'cone'), h('i', 'spot'));
    floor.append(lane);
    return lane;
  });
  const ghost = figure('ghost', 'happy');
  const hero = figure('hero', 'idle');
  hero.draw(STAND);
  // Green means pose: the cue only shows while the hero is standing in the light.
  const cue = h('b', 'cue', 'POSE!');
  cue.append(padDots(1));
  hero.fig.append(cue);
  floor.append(ghost.track, hero.track);
  const marquee = h('i', 'marquee');
  const crowd = h('div', 'crowd');
  const fans: Actor[] = [0, 1, 2, 3, 4].map(() => actor('npc', { px: 0.22 }));
  for (const f of fans) crowd.append(f.el);
  scene.append(rig, floor, marquee, crowd);
  wrap.append(top, scene);
  root.append(wrap);

  const light = () => lights[idx % lights.length];

  function face() {
    const lit = pos === light();
    hero.head.mood(frozen ? 'shock' : hero.track.classList.contains('posing') ? 'happy' : lit ? 'cool' : 'idle');
  }
  function cheer(m: ActorMood, t: number) {
    for (const f of fans) f.mood(m);
    crowdUntil = t + 500;
  }
  function place() {
    hero.track.style.transform = `translateX(${pos * 100}%)`;
    hero.track.classList.toggle('lit', pos === light());
    face();
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
    pulse(points, 'pop-in');
    // The cape grows with every clean pose in a row.
    const s = Math.min(streak, 5);
    hero.cape.setAttribute('d', s ? `M15 3H25L${25 + s * 2} ${16 + s * 3}H${15 - s * 2}Z` : '');
  }
  function thaw() {
    frozen = false;
    hero.track.classList.remove('cringe');
    hero.draw(STAND);
    face();
  }
  shine(0);

  return {
    press(b, t) {
      if (t < frozenUntil) return;
      // A press can land before the frame that ends the freeze; stand up first so it is not drawn over.
      if (frozen) thaw();
      if (b !== 1) {
        const to = pos + b - 1;
        if (to < 0 || to > 4) {
          pulse(hero.fig, 'shake');
          fx.sound('boing');
          return;
        }
        pos = to;
        hero.track.classList.remove('posing');
        hero.draw(STRIDE[strides++ % 2]);
        place();
        fx.sound('tick');
        return;
      }
      if (t < encoreUntil) return;
      if (pos !== light()) {
        if (pos === leftSpot && t - leftAt < GRACE) {
          // A beat too slow: the pose is wasted but not also fined (once per light).
          leftSpot = -1;
          pulse(hero.fig, 'shake');
          bad(marquee, 'TOO LATE!');
          return;
        }
        cringes++;
        streak = 0;
        frozen = true;
        frozenUntil = t + 400;
        hero.track.classList.remove('posing');
        hero.track.classList.add('cringe');
        hero.draw(SLUMP);
        face();
        cheer('shock', t);
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
      encoreUntil = t + ENCORE;
      hero.track.classList.add('posing');
      hero.draw(pose.limbs);
      // The freeze-frame lingers where the pose was struck.
      ghost.draw(pose.limbs);
      ghost.track.style.transform = `translateX(${pos * 100}%)`;
      pulse(ghost.fig, 'snap');
      pulse(crowd, 'flash');
      cheer('happy', t);
      note.textContent = hype[posed % hype.length];
      // The aura floats up off the hero; popped from the counter it left the top of a short stage.
      good(hero.fig, '+100');
      fx.pop(marquee, pose.name, 'gold');
      if (streak % 3 === 0) {
        fx.burst(hero.fig, 'gold', 22);
        fx.flash('gold');
        fx.sound('coin');
      }
      tally();
      idx++;
      shine(t);
    },
    tick(t) {
      if (frozen && t >= frozenUntil) thaw();
      if (crowdUntil && t >= crowdUntil) {
        crowdUntil = 0;
        for (const f of fans) f.mood('idle');
      }
      const patience = stay + missed * 400;
      if (t - litAt >= patience) {
        note.textContent = SLOW[idx % SLOW.length];
        fx.sound('whoosh');
        leftSpot = light();
        leftAt = t;
        missed++;
        idx++;
        shine(t);
        cheer('sleep', t);
      }
      // The cone narrows as the light loses patience, then flickers before it leaves.
      const l = (1 - (t - litAt) / patience).toFixed(2);
      if (l !== life) {
        life = l;
        scene.style.setProperty('--life', l);
        scene.classList.toggle('going', +l < 0.3);
      }
    },
    score: () => ratio(posed - cringes / 2, par),
    hint(t) {
      if (t < frozenUntil) return null;
      return pos === light() ? 1 : pos > light() ? 0 : 2;
    },
  };
};
