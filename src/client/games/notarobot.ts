import './notarobot.css';
import { COLOR, clamp1000, defineSprite, h, person, pick, pulse, setSprite, shuffled, sprite, type Btn, type GameFactory } from './common';

// Sprites are drawn side by side: on every line, the nth block of pixels belongs to the nth name.
function draw(names: string[], art: string) {
  const lines = art.trim().split('\n').map((line) => line.trim().split(/\s+/));
  names.forEach((name, i) => defineSprite(`notarobot-${name}`, lines.map((line) => line[i])));
}
// Street furniture stands 12 pixels wide and 20 tall; the bus and the crossing lie 14 wide and 12 tall.
draw(['light', 'icecream', 'domino', 'menu'], `
..kkkkkkkk.. ....kkkk.... .kkkkkkkkkk. ............
.kxxxxxxxxk. ...krrrrk... kwwwwwwwwwwk ....kkkk....
.kxxrrrrxxk. ..krrWrrrk.. kwwwwwwwwwwk ...kDDDDk...
.kxrrWrrrxk. ..krrrrrrk.. kwwwwkkwwwwk ...kDDDDk...
.kxrrrrrrxk. ..kkrrrrkk.. kwwwwkkwwwwk ...kDDDDk...
.kxxrrrrxxk. .kyyyyyyyyk. kwwwwwwwwwwk ....kkkk....
.kxxxxxxxxk. .kyyyWyyyyk. kwwwwwwwwwdk ............
.kxxyyyyxxk. .kyyyyyyyyk. kwwwwwwwwwdk ....kkkk....
.kxyyWyyyxk. .kkyyyyyykk. kwwwwwwwwddk ...kDDDDk...
.kxyyyyyyxk. .kggggggggk. kkkkkkkkkkkk ...kDDDDk...
.kxxyyyyxxk. .kggggWgggk. kwwwwwwwwwwk ...kDDDDk...
.kxxxxxxxxk. .kggggggggk. kwwkkwwwwwwk ....kkkk....
.kxxggggxxk. ..kggggggk.. kwwkkwwwwwwk ............
.kxggWgggxk. ..kkkkkkkk.. kwwwwwwwwwwk ....kkkk....
.kxggggggxk. ..knNnnNnk.. kwwwwwwwwwwk ...kDDDDk...
.kxxggggxxk. ...knnNnk... kwwwwwwkkwwk ...kDDDDk...
.kxxxxxxxxk. ...knNnnk... kwwwwwwkkwdk ...kDDDDk...
..kkkkkkkk.. ....knnk.... kwwwwwwwwwdk ....kkkk....
....kDDk.... ....knNk.... kwwwwwwwdddk ............
....kDDk.... .....kk..... .kkkkkkkkkk. ............`);
draw(['hydrant', 'tree', 'cone', 'sign'], `
............ ....kkkk.... ............ ...kkkkkk...
............ ..kkggggkk.. ............ ..krrrrrrk..
....kkkk.... .kggggggggk. .....kk..... .krrrrrrrrk.
...krrrrk... .kgggggggGk. ....kook.... krrrrrrrrrrk
..kkrrrrkk.. kggggggggGGk ....kook.... krwwwwwwwwrk
..krrrrrrk.. kggggggggGGk ...koooOk... krwwwwwwwwrk
.kkkkkkkkkk. kgggggggGGGk ...koooOk... krrrrrrrrrrk
.kRRRRRRRRk. kggggggGGGGk ...kwwwdk... .krrrrrrRRk.
.kkkkkkkkkk. .kggggGGGGk. ..kwwwwwdk.. ..krrrrRRk..
..krrrrrrk.. .kkGGGGGGkk. ..kooooOOk.. ...kkkkkk...
kkkrWWrrrkkk ...kkkkkk... ..kooooOOk.. ....kddk....
kRkrWrrrRkRk ....knNk.... .koooooOOOk. ....kdDk....
kRkrWrrrRkRk ....knNk.... .kwwwwwwwdk. ....kdDk....
kkkrrrrRRkkk ....knNk.... .kwwwwwwwdk. ....kdDk....
..krrrrrRk.. ....knNk.... .kooooooOOk. ....kdDk....
..krrrrrRk.. ....knNk.... kooooooOOOOk ....kdDk....
..krrrrrRk.. ....knNk.... kooooooOOOOk ....kdDk....
.kkkkkkkkkk. ....knNk.... kkkkkkkkkkkk ....kdDk....
.kRRRRRRRRk. ...kknNkk... kOOOOOOOOOOk ....kdDk....
.kkkkkkkkkk. ...kkkkkk... kkkkkkkkkkkk ...kkkkkk...`);
draw(['bus', 'crossing'], `
.kkkkkkkkkkkk. ..............
kooooooooooook ..............
kokcckcckcckok ..............
kokcckcckcckok ..............
kokkkkkkkkkkok kkkkkkkkkkkkkk
kooooooooooook DDDDDDDDDDDDDD
kOOOOOOOOOOOOk DwwDwwDwwDwwDD
kooooooooooyok DwwDwwDwwDwwDD
kooooooooooook DwwDwwDwwDwwDD
kkxxxxkkxxxxkk DwwDwwDwwDwwDD
.kxddxkkxddxk. DDDDDDDDDDDDDD
..kkkk..kkkk.. kkkkkkkkkkkkkk`);
draw(['tick'], `
........kk
.......kAk
......kAak
.kk..kAak.
kAAkkAak..
kAAAaak...
.kAaak....
..kak.....
...k......`);

// What the checker calls each thing when you press it by mistake.
const NAMES: Record<string, string> = { bus: 'A BUS', sign: 'A ROAD SIGN', crossing: 'A CROSSWALK', hydrant: 'A HYDRANT', tree: 'A TREE', cone: 'A CONE', icecream: 'ICE CREAM', domino: 'A DOMINO', menu: 'A MENU BUTTON' };
const DECOYS = ['bus', 'sign', 'crossing', 'hydrant', 'tree', 'cone'];
const FAKES = ['icecream', 'domino', 'menu'];
const CHEERS = ['SO HUMAN!', 'NICE EYES!', 'ORGANIC!', 'FLESH CONFIRMED!', 'HAS A PULSE!', 'PAYS TAXES!'];
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
// Nobody reacts to a picture this fast: a press this soon after a new row was aimed at the old one.
const GRACE = 120;
const PX = 0.32; // one pixel of a tile picture, in em

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  // Rows to clear for full marks: one every 500 ms in round one, every 420 ms in round five.
  const par = 16 + level * 0.75;
  // More rows than anyone can clear, never the same columns twice running.
  let lights = 0;
  const rows = Array.from({ length: 40 }, () => {
    const prev = lights;
    while (lights === prev) lights = pick(rng, LIGHTS);
    const decoys = shuffled(rng, DECOYS);
    // Later rounds swap honest decoys for things that only look like a traffic light,
    // and the camera gets sloppier: pictures sit off-centre and float off the road.
    return BTNS.map((b) => ({
      kind: (lights >> b) & 1 ? 'light' : rng() < level * 0.14 ? pick(rng, FAKES) : decoys[b],
      dx: (rng() - 0.5) * (0.3 + level * 0.14),
      dy: rng() * (0.3 + level * 0.3),
      flip: rng() < 0.5,
    }));
  });
  const quips = shuffled(rng, QUIPS);
  let idx = 0;
  let ticked = [false, false, false];
  let verified = 0;
  let failed = 0;
  // Rows of credit: +1 for a passed check, -0.5 for a failed one. Never below zero, so early
  // fumbles leave no hidden debt and the first passed check always moves the meter.
  let tally = 0;
  // After a wrong press: when the crossed-out row makes way for the next one. 0 while playable.
  let lockedUntil = 0;
  let dealtAt = 0;
  let proven = false;

  // The scene: a checkpoint robot up top, and under it the verification window it guards.
  const wrap = h('div', 'g-notarobot scene-mint');
  const guard = h('div', 'guard');
  const bot = person({ kind: 'bot', tone: 'grey', mood: 'idle', px: 0.25 });
  const bubble = h('div', 'bubble', 'Prove you are human.');
  guard.append(bot.el, bubble);
  const panel = h('div', 'panel');
  const head = h('div', 'head');
  const ask = h('div', 'ask');
  ask.append(h('span', '', 'Select every tile with'), h('b', '', 'TRAFFIC LIGHTS'));
  head.append(ask, sprite('notarobot-light', { px: 0.13 }, 'sample'));
  const strip = h('div', 'strip');
  const tiles = BTNS.map((b) => {
    const el = h('div', `tile c-${COLOR[b]}`);
    const pic = sprite('notarobot-light', { px: PX }, 'pic');
    el.append(pic, sprite('notarobot-tick', { tone: 'gold', px: 0.16 }, 'tick'), sprite('cross', { px: 0.3 }, 'cross'));
    strip.append(el);
    return { el, pic };
  });
  const foot = h('div', 'foot');
  const box = h('i', 'box');
  box.append(sprite('notarobot-tick', { tone: 'gold', px: 0.16 }, 'tick'));
  const who = h('div', 'who');
  const pct = h('span', 'pct');
  const bar = h('div', 'bar');
  const fill = h('i');
  bar.append(fill);
  who.append(pct, bar);
  foot.append(box, who);
  panel.append(head, strip, foot);
  wrap.append(guard, panel);
  root.append(wrap);

  const row = () => rows[idx % rows.length];
  const todo = () => BTNS.filter((b) => row()[b].kind === 'light' && !ticked[b]);
  const score = () => clamp1000((1000 * tally) / par);

  function deal(t: number) {
    dealtAt = t;
    ticked = [false, false, false];
    tiles.forEach((tile, b) => {
      const { kind, dx, dy, flip } = row()[b];
      tile.el.className = `tile c-${COLOR[b]}`;
      setSprite(tile.pic, `notarobot-${kind}`, { px: PX, flip });
      tile.pic.style.setProperty('--dx', `${dx}em`);
      tile.pic.style.setProperty('--dy', `${-dy}em`);
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
    bubble.textContent = 'Welcome, fellow human.';
    fx.flash('gold');
    fx.burst(foot, 'gold', 30);
    fx.sound('power');
  }
  deal(0);
  gauge();

  return {
    press(b, t) {
      if (lockedUntil || t - dealtAt < GRACE) return;
      const tile = tiles[b].el;
      const { kind } = row()[b];
      if (kind !== 'light') {
        failed++;
        tally = Math.max(0, tally - 0.5);
        lockedUntil = t + 450;
        tile.classList.add('no');
        // The alarm goes off: red backdrop, angry robot, a robot joke at your expense.
        wrap.classList.replace('scene-mint', 'scene-danger');
        bot.mood('angry');
        bubble.textContent = quips[failed % quips.length];
        pulse(panel, 'shake');
        fx.poof(tile);
        bad(head, `THAT IS ${NAMES[kind]}`);
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
      tally++;
      idx++;
      bot.mood(score() >= 1000 ? 'wink' : 'happy');
      pulse(bot.el, 'bump');
      good(box);
      pulse(box, 'blip');
      // A cheer every third check, up by the robot where it hides nothing.
      if (verified % 3 === 0 && score() < 1000) {
        const cheer = CHEERS[(verified / 3 - 1) % CHEERS.length];
        bubble.textContent = cheer;
        fx.pop(guard, cheer, 'gold');
      }
      gauge();
      deal(t);
    },
    tick(t) {
      if (!lockedUntil || t < lockedUntil) return;
      lockedUntil = 0;
      idx++;
      wrap.classList.replace('scene-danger', 'scene-mint');
      bot.mood(score() >= 1000 ? 'wink' : 'idle');
      deal(t);
    },
    score,
    hint: () => (lockedUntil ? null : todo()),
  };
};
