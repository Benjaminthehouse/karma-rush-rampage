import './popuppanic.css';
import { COLOR, dealer, h, person, pulse, ratio, sprite, type Btn, type GameFactory, type Mood } from './common';

// The headline, the button begging to be clicked, and the clip art.
const ADS = [
  ['YOU ARE VISITOR 1,000,000', 'CLAIM', 'trophy'],
  ['DOWNLOAD MORE RAM', 'FREE', 'server'],
  ['YOUR PC HAS 47 VIRUSES', 'SCAN', 'bug'],
  ['ACCEPT 9,999 COOKIES', 'YUM', 'cookie'],
  ['HOT SOUP IN YOUR AREA', 'SIP NOW', 'flame1'],
  ['SINGLE MODS NEAR YOU', 'MEET', 'heart'],
  ['ONE WEIRD TRICK', 'LEARN', 'eye'],
  ['SPIN THE PRIZE WHEEL', 'SPIN', 'coin'],
  ['YOUR CART MISSES YOU', 'RETURN', 'gift'],
  ['FREE KARMA INSIDE', 'TRUST', 'up'],
  ['RATE US FIVE STARS', 'RATE', 'star'],
  ['ALLOW ALL ALERTS?', 'ALLOW', 'bell'],
  ['YOU WON A BOAT', 'SAIL', 'trophy'],
  ['JOIN OUR MAILING LIST', 'JOIN', 'envelope'],
  ['TOOLBAR FOR YOUR TOOLBAR', 'ADD', 'window'],
] as const;
const SKINS = ['gold', 'pink', 'orange', 'lilac'] as const;
const SURE = ['ARE YOU SURE?', 'REALLY CLOSE?', 'LAST CHANCE!', 'BUT WHY?', 'PLEASE STAY', 'ONE MORE AD?'] as const;
const ESSAY_MS = 950; // an essay saves itself and leaves after this long
const BLINK = 200; // nobody reacts faster than this: a press that soon after an essay opened was aimed at the empty lane
const ARRIVES = { ad: 'pop', sure: 'boing', essay: 'whoosh' } as const;

type Kind = 'ad' | 'sure' | 'essay';
type Spawn = { at: number; col: Btn; essay: boolean; nested: boolean; ad: (typeof ADS)[number]; skin: string; sure: string; y: number; tilt: number };
type Col = { el: HTMLElement; ring: HTMLElement; pop: { win: HTMLElement; kind: Kind; from: Spawn; since: number } | null };

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // Pop-ups arrive on a schedule that speeds up. One fits per lane: an ad aimed
  // at a lane that is still covered is an ad you never got to close.
  const gapStart = 480 - level * 25;
  const gapEnd = 280 - level * 20;
  // The traps are spread through the round, never in the opening second.
  const essays = level < 2 ? 2 : 3;
  const essayDue = Array.from({ length: essays }, (_, k) => 1200 + ((k + rng() * 0.5) * (duration - 2000)) / essays);
  const ad = dealer(rng, ADS);
  const skin = dealer(rng, SKINS);
  const sure = dealer(rng, SURE);
  const spawns: Spawn[] = [];
  let prev = -1;
  let trap = { col: -1, until: 0 };
  for (let at = 0; at < duration - 250; at += gapStart + (gapEnd - gapStart) * (at / duration)) {
    const essay = at >= trap.until && at >= (essayDue[0] ?? duration);
    if (essay) essayDue.shift();
    // Never the lane just used, and never one where an essay is still saving.
    const lanes = ([0, 1, 2] as Btn[]).filter((c) => c !== prev && (c !== trap.col || at >= trap.until));
    const col = lanes[Math.floor(rng() * lanes.length)];
    if (essay) trap = { col, until: at + ESSAY_MS };
    prev = col;
    spawns.push({ at, col, essay, nested: rng() < 0.3 + level * 0.03, ad: ad(), skin: skin(), sure: sure(), y: rng(), tilt: Math.round(rng() * 4 - 2) });
  }
  // Par is 90% of everything there is to close: each ad, plus each ARE YOU SURE behind one.
  const ads = spawns.filter((s) => !s.essay);
  const par = Math.round(0.9 * (ads.length + ads.filter((s) => s.nested).length));

  let next = 0;
  let closed = 0;
  let misses = 0;
  let lost = 0;
  let streak = 0;
  let sore: Mood | null = null; // how the last mistake left you, until the next clean close

  // The scene: your desktop, wallpaper and all, with you up in the title bar
  // watching three lanes of it disappear under pop-ups.
  const wrap = h('div', 'g-popuppanic scene-grass');
  const hud = h('div', 'hud');
  const you = person({ tone: 'gold', mood: 'idle', px: 0.15 });
  const count = h('b', '', '0');
  const gauge = h('div', 'gauge');
  const fill = h('i');
  gauge.append(fill);
  const free = h('div', 'free', 'AD-FREE!');
  hud.append(you.el, h('span', '', 'ADS BLOCKED'), count, gauge, free);
  const desk = h('div', 'desk');
  const cols: Col[] = [0, 1, 2].map((i) => {
    const el = h('div', `col c-${COLOR[i]}`);
    const ring = h('i', 'ring');
    el.append(ring);
    desk.append(el);
    return { el, ring, pop: null };
  });
  wrap.append(hud, desk);
  root.append(wrap);

  const score = () => ratio(closed - misses - lost * 3, par);

  function open(c: Col, kind: Kind, s: Spawn, t: number) {
    const win = h('div', `win ${kind} ${kind === 'essay' ? '' : s.skin}`);
    const bar = h('div', 'bar');
    const body = h('div', 'body');
    if (kind === 'essay') {
      // The trap: calm white paper, a padlock where the X would be.
      bar.append(h('span', '', 'UNSAVED'), sprite('lock', { px: 0.085 }));
      body.append(h('b', 'head', 'MY ESSAY'), h('i', 'lines'), h('b', 'keep', 'DON’T CLOSE!'), h('i', 'save'));
    } else {
      bar.append(h('span', '', kind === 'ad' ? 'AD' : 'WAIT!'), h('b', 'x', 'X'));
      if (kind === 'ad') body.append(sprite(s.ad[2], { px: 0.2, tone: 'ink' }, 'art'), h('b', 'head', s.ad[0]), h('span', 'cta', s.ad[1]));
      else body.append(h('b', 'head', s.sure), h('span', 'cta', 'STAY'));
    }
    win.append(bar, body);
    c.el.style.setProperty('--y', String(s.y));
    c.el.style.setProperty('--tilt', `${s.tilt}deg`);
    c.el.append(win);
    c.pop = { win, kind, from: s, since: t };
    fx.sound(ARRIVES[kind]);
  }

  function shut(c: Col) {
    c.pop?.win.remove();
    c.pop = null;
  }

  // Your face: calmer the clearer the desktop, and it remembers the last mistake.
  function face() {
    const up = cols.filter((c) => c.pop && c.pop.kind !== 'essay').length;
    you.mood(sore ?? (up === 3 ? 'angry' : up === 2 ? 'shock' : streak >= 5 ? 'cool' : up ? 'idle' : 'happy'));
  }

  function advance(t: number) {
    for (const c of cols) {
      if (c.pop?.kind === 'essay' && t >= c.pop.from.at + ESSAY_MS) {
        fx.pop(c.pop.win, 'SAVED', 'white');
        fx.sound('ding');
        shut(c);
      }
    }
    while (next < spawns.length && t >= spawns[next].at) {
      const s = spawns[next++];
      if (!cols[s.col].pop) open(cols[s.col], s.essay ? 'essay' : 'ad', s, t);
    }
    face();
  }
  advance(0);

  return {
    press(b, t) {
      const c = cols[b];
      const p = c.pop;
      if (!p || (p.kind === 'essay' && t - p.since < BLINK)) {
        misses++;
        streak = 0;
        sore = 'sad';
        pulse(c.el, 'shake');
        bad(c.ring, p ? 'CAREFUL!' : 'EMPTY!');
      } else if (p.kind === 'essay') {
        lost++;
        streak = 0;
        sore = 'dead';
        fx.poof(p.win);
        bad(c.ring, 'DELETED!');
        fx.flash('red');
        fx.sound('thud');
        shut(c);
      } else {
        closed++;
        streak++;
        sore = null;
        fx.poof(p.win);
        good(p.win);
        fx.burst(p.win, COLOR[b], p.kind === 'sure' ? 18 : 8);
        shut(c);
        pulse(c.ring, 'go');
        if (p.kind === 'sure') {
          fx.pop(c.ring, 'DOUBLE!', COLOR[b]);
          fx.sound('coin');
        } else if (p.from.nested) open(c, 'sure', p.from, t);
        // Ten clean closes in a row: the title bar goes gold, on top of the engine's combo flash.
        if (streak % 10 === 0) {
          pulse(free, 'go');
          fx.sound('power');
        }
        count.textContent = String(closed);
        pulse(count, 'bump');
      }
      fill.style.width = `${score() / 10}%`;
      face();
    },
    tick(t) {
      advance(t);
    },
    score,
    // Oldest pop-up first; an ARE YOU SURE keeps its ad's place in the queue.
    hint() {
      let best: Btn | null = null;
      for (const b of [0, 1, 2] as Btn[]) {
        const p = cols[b].pop;
        if (p && p.kind !== 'essay' && (best === null || p.from.at < cols[best].pop!.from.at)) best = b;
      }
      return best;
    },
  };
};
