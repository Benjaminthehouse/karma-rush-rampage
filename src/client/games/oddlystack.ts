import './oddlystack.css';
import { COLOR, h, pulse, randBtn, ratio, shuffled, type GameFactory } from './common';

const NICE = [
  'I could watch this all day',
  'my brain just exhaled',
  'the click. THE CLICK.',
  'sound on for this one',
  'finally, some good content',
  'unreasonably smooth',
  'saved, upvoted, framed',
  'this cured my Monday',
];
const UGH = [
  'slab three. I can’t unsee it',
  'belongs on the other sub',
  'my eye is twitching',
  'so close it hurts',
  'who stacked this?',
  'I need to lie down',
  'reported for crooked',
  'and it was going so well',
];
const FIRST = 300; // ms before the first slab starts to slide
const REST = 150; // ms a fresh slab waits at the edge
const KEEP = 0.6; // a slab hanging over by more than this share of its width falls off

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // All horizontal distances are a percentage of the yard's width.
  const W = 34 - level * 2; // slab width: narrower later
  const R = (100 - W) / 2; // the slab's centre swings this far either side of the tower
  const SNAP = W * 0.13; // closer than this clicks flush
  // Edge to edge in this many ms; every slab that lands makes the next one quicker.
  const sweep = (n: number) => (1100 - level * 60) * Math.max(0.8, 1 - n * 0.02);
  // More slabs than anyone can stack, never the same colour twice running.
  let prev = -1;
  const slabs = Array.from({ length: 60 }, () => {
    let c = randBtn(rng);
    while (c === prev) c = randBtn(rng);
    prev = c;
    return { c, side: rng() < 0.5 ? -1 : 1 };
  });
  // Par is two slabs short of a flawless run (every slab flush on its first pass).
  let flawless = 0;
  for (let at = FIRST; at + sweep(flawless) / 2 < duration; ) at += sweep(flawless++) / 2 + REST;
  const par = flawless - 2;
  const nice = shuffled(rng, NICE);
  const ugh = shuffled(rng, UGH);

  let idx = 0; // the slab that is sliding
  let from = FIRST; // when it starts to slide
  let landed = 0;
  let points = 0;
  let chain = 0;
  let said = 0;
  let lockedUntil = 0;

  const wrap = h('div', 'g-oddlystack');
  wrap.style.setProperty('--w', `${W}%`);
  const top = h('div', 'top');
  const streak = h('b', 'streak');
  const meter = h('div', 'meter big');
  const fill = h('i');
  meter.append(fill);
  top.append(streak, meter);
  const yard = h('div', 'yard');
  const mover = h('div', 'slab mover');
  const lost = h('div', 'slab lost');
  const stack = h('div', 'stack');
  yard.append(h('i', 'slot'), stack, lost, mover);
  const say = h('div', 'say', 'stacking slabs with zero gaps [OC]');
  wrap.append(top, yard, say);
  root.append(wrap);

  // The tower, newest row first. `x` is how far a row sits from the top slab, which is always centred.
  const rows: { el: HTMLElement; x: number }[] = [];
  function addRow(cls: string, x: number) {
    const el = h('div', cls);
    el.style.setProperty('--x', `${x}%`);
    stack.prepend(el);
    rows.unshift({ el, x });
    return el;
  }
  addRow('plinth', 0);
  addRow('slab base', 0);

  const cur = () => slabs[idx % slabs.length];
  /** Where the sliding slab's centre is, relative to the tower: it bounces edge to edge. */
  function offsetAt(t: number) {
    const u = (Math.max(0, t - from) / sweep(landed)) % 2;
    return cur().side * R * (1 - 2 * (u < 1 ? u : 2 - u));
  }
  const place = (t: number) => (mover.style.left = `${50 - W / 2 + offsetAt(t)}%`);

  function show() {
    mover.className = `slab mover c-${COLOR[cur().c]}`;
    streak.textContent = `FLUSH ×${chain}`;
    streak.classList.toggle('on', chain > 1);
    fill.style.width = `${Math.min(100, (points / par) * 100)}%`;
  }
  show();
  place(0);

  return {
    press(b, t) {
      if (t < lockedUntil) return;
      const c = cur().c;
      if (b !== c) {
        lockedUntil = t + 250;
        pulse(mover, 'shake');
        bad(mover, 'WRONG COLOUR');
        return;
      }
      const off = offsetAt(t);
      const flush = Math.abs(off) <= SNAP;
      const q = flush ? 1 : 1 - Math.abs(off) / (KEEP * W);
      if (q <= 0) {
        // Barely on the tower: it tips off the side.
        chain = 0;
        lost.className = `slab lost c-${COLOR[c]}`;
        lost.style.left = mover.style.left;
        pulse(lost, off < 0 ? 'g-oddlystack-tipl' : 'g-oddlystack-tipr');
        bad(lost, 'DROPPED IT');
        fx.sound('whoosh');
      } else {
        // It lands where it was dropped, then the view recentres on it: every row slides across.
        const d = flush ? 0 : off;
        const el = addRow(`slab c-${COLOR[c]}`, d);
        pulse(stack, 'g-oddlystack-settle');
        rows.forEach((r, i) => {
          r.x -= d;
          r.el.style.setProperty('--x', `${r.x}%`);
          r.el.style.setProperty('--i', String(Math.max(0, 6 - i))); // the sheen climbs from the bottom row
        });
        while (rows.length > 9) rows.pop()!.el.remove();
        points += q;
        landed++;
        stack.classList.remove('g-oddlystack-sheen');
        if (flush) {
          chain++;
          pulse(stack, 'g-oddlystack-sheen');
          good(el, chain > 1 ? `FLUSH ×${chain}` : 'FLUSH');
          say.textContent = nice[said++ % nice.length];
          if (chain % 5 === 0) {
            fx.pop(yard, 'ODDLY SATISFYING', 'gold');
            fx.burst(stack, 'gold', 30);
            fx.flash('gold');
            fx.sound('coin');
          } else fx.sound('ding');
        } else {
          chain = 0;
          bad(el, 'mildly infuriating');
          say.textContent = ugh[said++ % ugh.length];
          fx.sound('thud');
        }
      }
      idx++;
      from = t + REST;
      show();
      place(t);
      pulse(mover, 'pop-in');
    },
    tick(t) {
      place(t);
    },
    score: () => ratio(points, par),
    hint: (t) => (t >= lockedUntil && Math.abs(offsetAt(t)) <= SNAP * 0.9 ? cur().c : null),
  };
};
