import './jackpot.css';
import { actor, COLOR, clamp1000, defineSprite, h, pulse, setSprite, sprite, type Btn, type GameFactory, type Layer, type SpriteOpts } from './common';

// 0 is the gold award; the rest are duds.
const SYMBOLS = ['gold', 'silver', 'down', 'spam'];

// A silver coin: worth nothing here.
defineSprite('jackpot-silver', `
...kkkk...
..kwwwwk..
.kwWWwwdk.
kwWwwwwwdk
kwWwwdwwdk
kwwwwdwwdk
kwwwwwwwdk
.kwwwwddk.
..kddddk..
...kkkk...`);
// The lever: a red knob on a steel arm.
defineSprite('jackpot-lever', `
.kkkk.
krrrrk
kRrrRk
kRRRRk
.kkkk.
..kk..
..kd..
..kd..
..kd..
..kd..
..kd..
..kd..
..kd..
..kd..
.kkkk.
kddddk
kkkkkk`);

const ART: { name: Layer; opts: SpriteOpts }[] = [
  { name: 'star', opts: {} },
  { name: 'jackpot-silver', opts: {} },
  { name: 'up', opts: { tone: 'purple', flipY: true } },
  { name: 'bomb', opts: {} },
];
const NOW = 0.27; // px of the symbol on the payline
const NEXT = 0.14; // px of the one coming next

export const create: GameFactory = ({ root, rng, level, good, bad, fx }) => {
  const par = 14 + level * 2;
  // Each reel shows a long strip; gold comes round every three to five symbols.
  const strips = [0, 1, 2].map(() => {
    const s: number[] = [];
    while (s.length < 220) {
      const gap = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < gap; i++) s.push(1 + Math.floor(rng() * 3));
      s.push(0);
    }
    return s;
  });
  const period = [0, 1, 2].map((i) => 340 - level * 30 + i * 35);
  const stopped: (number | null)[] = [null, null, null];
  let spinFrom = 0; // reels are frozen for a beat after each payout
  const offset = [0, 40, 80];
  let points = 0;
  let misses = 0;
  let spins = 0;

  // The scene: a casino floor. A big slot machine with three reels and a lever;
  // the Ape stands at it and goes wild when the gold comes in.
  const wrap = h('div', 'g-jackpot scene-casino');
  const cabinet = h('div', 'cabinet');
  const marquee = h('div', 'marquee', 'KARMA JACKPOT');
  const machine = h('div', 'machine');
  const reels = [0, 1, 2].map((i) => {
    const reel = h('div', `reel c-${COLOR[i]}`);
    const next = sprite('star', { px: NEXT }, 'sym next');
    const now = sprite('star', { px: NOW }, 'sym now');
    reel.append(next, now, h('i', 'stripe'));
    machine.append(reel);
    return { reel, next, now, shown: -1 };
  });
  const tray = h('div', 'tray');
  const lever = sprite('jackpot-lever', { px: 0.3 }, 'lever');
  cabinet.append(marquee, machine, tray, lever);

  const floor = h('div', 'floor');
  const ape = actor('ape', { mood: 'cool', px: 0.4 });
  ape.el.classList.add('ape');
  const note = h('div', 'note', '0 gold');
  floor.append(note, ape.el);
  wrap.append(cabinet, floor);
  root.append(wrap);

  const pos = (i: number, t: number) => Math.max(0, Math.floor((t - spinFrom + offset[i]) / period[i]));
  const symAt = (i: number, t: number) => strips[i][(spins * 17 + pos(i, t)) % strips[i].length];
  const draw = (el: HTMLElement, sym: number, px: number) => setSprite(el, ART[sym].name, { ...ART[sym].opts, px });

  function paint(t: number) {
    reels.forEach((r, i) => {
      const p = stopped[i] === null ? pos(i, t) : -2 - spins;
      if (p === r.shown) return;
      r.shown = p;
      if (stopped[i] === null) {
        draw(r.now, symAt(i, t), NOW);
        draw(r.next, strips[i][(spins * 17 + pos(i, t) + 1) % strips[i].length], NEXT);
        // The symbol visibly drops from the preview slot, so the small one reads as "coming next".
        pulse(r.now, 'drop');
      }
    });
  }
  paint(0);

  function tally() {
    note.textContent = `${points} gold`;
  }

  return {
    press(b: Btn, t) {
      if (t < spinFrom || stopped[b] !== null) return;
      const sym = symAt(b, t);
      stopped[b] = sym;
      reels[b].reel.classList.add('stopped');
      draw(reels[b].now, sym, NOW);
      reels[b].next.classList.add('gone');
      pulse(reels[b].now, 'bump');
      if (sym === 0) {
        points++;
        ape.mood('happy');
        // A coin drops into the tray for every gold.
        if (tray.childElementCount < 18) tray.append(sprite('coin', { px: 0.12 }, 'coin'));
        good(reels[b].now);
      } else {
        misses++;
        ape.mood('sad');
        bad(reels[b].now, 'DUD');
      }
      if (stopped.includes(null)) {
        tally();
        return;
      }
      if (stopped.every((s) => s === 0)) {
        points += 2;
        ape.mood('cool');
        pulse(ape.el, 'g-jackpot-wild');
        pulse(marquee, 'g-jackpot-lit');
        fx.pop(machine, 'JACKPOT!', 'gold');
        fx.burst(machine, 'gold', 26);
        fx.flash('gold');
        fx.sound('coin');
      }
      tally();
      spins++;
      spinFrom = t + 380;
    },
    tick(t) {
      if (!stopped.includes(null) && t >= spinFrom) {
        stopped.forEach((_, i) => (stopped[i] = null));
        reels.forEach((r) => {
          r.reel.classList.remove('stopped');
          r.next.classList.remove('gone');
        });
        // The Ape hauls the lever and the reels spin again.
        pulse(lever, 'pull');
        pulse(ape.el, 'bump');
      }
      paint(t);
    },
    score: () => clamp1000((1000 * (points - misses / 2)) / par),
    hint(t) {
      if (t < spinFrom) return null;
      for (const i of [0, 1, 2] as Btn[]) if (stopped[i] === null && symAt(i, t) === 0) return i;
      return null;
    },
  };
};
