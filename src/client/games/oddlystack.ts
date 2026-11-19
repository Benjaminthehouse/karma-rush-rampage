import './oddlystack.css';
import { COLOR, comment, dealer, h, padDots, person, pulse, randBtn, ratio, type Btn, type GameFactory } from './common';

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
const FANS = ['flush_enjoyer', 'gap_inspector', 'slab_dad', 'plumb_bob', 'zero_gap_zoe', 'level_headed'];
const FIRST = 300; // ms before the first slab starts to slide
const REST = 150; // ms a fresh slab waits at the edge
const KEEP = 0.6; // a slab hanging over by more than this share of its width falls off

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // All horizontal distances are a percentage of the yard's width.
  const W = 34 - level * 2; // slab width: narrower later
  const R = (100 - W) / 2; // the slab's centre swings this far either side of the tower
  // Closer than this clicks flush. Wide enough that a press about 40 ms late (screen and touch lag) still clicks on the last round.
  const SNAP = W * 0.16;
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
  const nice = dealer(rng, NICE);
  const ugh = dealer(rng, UGH);

  let idx = 0; // the slab that is sliding
  let from = FIRST; // when it starts to slide
  let landed = 0;
  let points = 0;
  let chain = 0;
  let lockedUntil = 0;

  // The scene: the comment thread under a stacking video. The slab slides along the top,
  // the tower hangs under it, and the top commenter watches every drop from below.
  const wrap = h('div', 'g-oddlystack scene-feed');
  wrap.style.setProperty('--w', `${W}%`);
  const top = h('div', 'top');
  const streak = h('b', 'streak');
  const bar = h('div', 'bar');
  const fill = h('i');
  bar.append(fill);
  top.append(streak, bar);
  const yard = h('div', 'yard');
  const mover = h('div');
  const lost = h('div', 'slab lost');
  const stack = h('div', 'stack');
  const seam = h('i', 'seam'); // where a slab touches down
  yard.append(h('i', 'slot'), stack, seam, lost, mover);
  const fan = person({ tone: 'teal', kind: 'cat', px: 0.25 });
  const reply = comment({ user: dealer(rng, FANS)(), text: 'go on then. zero gaps.', avatar: fan.el });
  wrap.append(top, yard, reply.el);
  root.append(wrap);

  /** Paints an element as a slab of one colour, tagged with which pad drops it. */
  function dress(el: HTMLElement, c: Btn, cls = '') {
    el.className = `slab c-${COLOR[c]} ${cls}`;
    el.replaceChildren(padDots(c));
    return el;
  }

  // The tower, newest row first. `x` is how far a row sits from the top slab, which is always centred.
  const rows: { el: HTMLElement; x: number }[] = [];
  function addRow(el: HTMLElement, x: number) {
    el.style.setProperty('--x', `${x}%`);
    stack.prepend(el);
    rows.unshift({ el, x });
    return el;
  }
  addRow(h('div', 'table'), 0);
  addRow(h('div', 'slab base'), 0);

  const cur = () => slabs[idx % slabs.length];
  /** Where the sliding slab's centre is, relative to the tower: it bounces edge to edge. */
  function offsetAt(t: number) {
    const u = (Math.max(0, t - from) / sweep(landed)) % 2;
    return cur().side * R * (1 - 2 * (u < 1 ? u : 2 - u));
  }
  const place = (t: number) => (mover.style.left = `${50 - W / 2 + offsetAt(t)}%`);

  function show() {
    dress(mover, cur().c, 'mover');
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
        lockedUntil = t + 350;
        fan.mood('sad');
        pulse(mover, 'shake');
        bad(mover, 'WRONG COLOUR');
        return;
      }
      const off = offsetAt(t);
      const flush = Math.abs(off) <= SNAP;
      const q = flush ? 1 : 1 - Math.abs(off) / (KEEP * W);
      stack.classList.remove('g-oddlystack-sheen');
      if (q <= 0) {
        // Barely on the tower: it tips off the side.
        chain = 0;
        dress(lost, c, 'lost');
        lost.style.left = mover.style.left;
        pulse(lost, off < 0 ? 'g-oddlystack-tipl' : 'g-oddlystack-tipr');
        fan.mood('shock');
        reply.text.textContent = ugh();
        fx.poof(lost);
        bad(lost, 'DROPPED IT');
        fx.sound('whoosh');
      } else {
        // It lands where it was dropped, then the view recentres on it: every row slides across.
        const d = flush ? 0 : off;
        const el = addRow(dress(h('div'), c), d);
        pulse(stack, 'g-oddlystack-settle');
        rows.forEach((r, i) => {
          r.x -= d;
          r.el.style.setProperty('--x', `${r.x}%`);
          r.el.style.setProperty('--i', String(Math.max(0, 6 - i))); // the sheen climbs from the bottom row
        });
        while (rows.length > 12) rows.pop()!.el.remove();
        points += q;
        landed++;
        fx.poof(seam);
        if (flush) {
          chain++;
          pulse(stack, 'g-oddlystack-sheen');
          fan.mood(chain > 2 ? 'cool' : 'happy');
          reply.text.textContent = nice();
          good(el, chain > 1 ? `FLUSH ×${chain}` : 'FLUSH');
          if (chain % 5 === 0) {
            fx.pop(reply.el, 'ODDLY SATISFYING', 'gold');
            fx.burst(el, 'gold', 30);
            fx.flash('gold');
            fx.sound('coin');
          } else fx.sound('ding');
        } else {
          chain = 0;
          fan.mood('angry');
          reply.text.textContent = ugh();
          bad(el, 'mildly infuriating');
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
