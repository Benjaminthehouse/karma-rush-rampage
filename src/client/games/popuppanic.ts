import './popuppanic.css';
import { COLOR, h, pick, pulse, randBtn, ratio, type Btn, type GameFactory } from './common';

const ADS = [
  ['YOU ARE VISITOR 1,000,000', 'CLAIM'],
  ['DOWNLOAD MORE RAM', 'FREE'],
  ['YOUR PC HAS 37 VIRUSES', 'SCAN'],
  ['ACCEPT 4,812 COOKIES', 'YUM'],
  ['HOT SOUP IN YOUR AREA', 'SIP NOW'],
  ['SINGLE MODS NEAR YOU', 'MEET'],
  ['ONE WEIRD TRICK', 'LEARN'],
  ['SPIN THE PRIZE WHEEL', 'SPIN'],
  ['WAIT! DON’T GO YET', 'STAY'],
  ['FREE KARMA INSIDE', 'TRUST'],
  ['RATE US FIVE STARS', 'RATE'],
  ['ALLOW ALL ALERTS?', 'ALLOW'],
  ['YOU WON A BOAT', 'SAIL'],
  ['JOIN OUR MAILING LIST', 'JOIN'],
  ['TOOLBAR FOR YOUR TOOLBAR', 'ADD'],
] as const;
const SKINS = ['gold', 'pink', 'orange', 'lilac'] as const;
const SURE = ['ARE YOU SURE?', 'REALLY CLOSE?', 'LAST CHANCE!', 'BUT WHY?', 'PLEASE STAY', 'ONE MORE AD?'] as const;
const ESSAY_MS = 950; // an essay saves itself and leaves after this long

type Kind = 'ad' | 'sure' | 'essay';
type Spawn = { at: number; col: Btn; essay: boolean; nested: boolean; ad: readonly [string, string]; skin: string; sure: string; y: number; tilt: number };
type Col = { el: HTMLElement; poof: HTMLElement; kind: Kind | null; win: HTMLElement | null; from: Spawn | null };

export const create: GameFactory = ({ root, rng, level, duration, good, bad, fx }) => {
  // Pop-ups arrive on a schedule that speeds up. One fits per column: an ad aimed
  // at a column that is still covered is an ad you never got to close.
  const gapStart = 480 - level * 25;
  const gapEnd = 280 - level * 20;
  const spawns: Spawn[] = [];
  let prev = -1;
  for (let at = 0; at < duration - 250; at += gapStart + (gapEnd - gapStart) * (at / duration)) {
    let col = randBtn(rng);
    while (col === prev) col = randBtn(rng);
    prev = col;
    spawns.push({ at, col, essay: false, nested: rng() < 0.3 + level * 0.03, ad: pick(rng, ADS), skin: pick(rng, SKINS), sure: pick(rng, SURE), y: rng(), tilt: Math.round(rng() * 8 - 4) });
  }
  // The traps are spread through the round, never in the opening second.
  const essays = level < 2 ? 2 : 3;
  for (let k = 0; k < essays; k++) spawns[4 + Math.floor(((k + rng()) * (spawns.length - 5)) / essays)].essay = true;
  const ads = spawns.filter((s) => !s.essay);
  const par = Math.round(0.85 * (ads.length + ads.filter((s) => s.nested).length));

  let next = 0;
  let closed = 0;
  let misses = 0;
  let lost = 0;
  let streak = 0;

  const wrap = h('div', 'g-popuppanic');
  const hud = h('div', 'hud');
  const count = h('b', '', '0');
  const meter = h('div', 'meter');
  const fill = h('i');
  meter.append(fill);
  hud.append(h('span', '', 'ADS BLOCKED'), count, meter);
  const desk = h('div', 'desk');
  const cols: Col[] = [0, 1, 2].map((i) => {
    const el = h('div', `col c-${COLOR[i]}`);
    const poof = h('i', 'poof');
    el.append(poof);
    desk.append(el);
    return { el, poof, kind: null, win: null, from: null };
  });
  wrap.append(hud, desk);
  root.append(wrap);

  const score = () => ratio(closed - misses * 0.5 - lost * 3, par);

  function open(c: Col, kind: Kind, s: Spawn) {
    const win = h('div', `win ${kind} ${kind === 'ad' ? s.skin : ''}`);
    const bar = h('div', 'bar');
    const body = h('div', 'body');
    if (kind === 'essay') {
      bar.append(h('span', '', 'ESSAY.DOC'));
      body.append(h('b', 'head', 'MY ESSAY'), h('i', 'lines'), h('span', 'keep', 'DON’T CLOSE!'), h('i', 'save'));
    } else {
      bar.append(h('span', '', kind === 'ad' ? 'AD' : 'WAIT!'), h('b', 'x', '×'));
      if (kind === 'ad') body.append(h('i', 'star'), h('b', 'head', s.ad[0]), h('span', 'cta', s.ad[1]));
      else body.append(h('b', 'head', s.sure), h('span', 'cta', 'STAY'));
    }
    win.append(bar, body);
    c.el.style.setProperty('--y', String(s.y));
    c.el.style.setProperty('--tilt', `${s.tilt}deg`);
    c.el.append(win);
    Object.assign(c, { kind, win, from: s });
  }

  function shut(c: Col) {
    c.win?.remove();
    Object.assign(c, { kind: null, win: null, from: null });
  }

  function advance(t: number) {
    for (const c of cols) {
      if (c.kind === 'essay' && t >= c.from!.at + ESSAY_MS) {
        fx.pop(c.win, 'SAVED', 'white');
        fx.sound('ding');
        shut(c);
      }
    }
    while (next < spawns.length && t >= spawns[next].at) {
      const s = spawns[next++];
      if (!cols[s.col].kind) open(cols[s.col], s.essay ? 'essay' : 'ad', s);
    }
  }
  advance(0);

  return {
    press(b) {
      const c = cols[b];
      const { kind, win, from } = c;
      if (!kind || !from) {
        misses++;
        streak = 0;
        pulse(c.el, 'shake');
        bad(c.el, 'NOTHING THERE');
      } else if (kind === 'essay') {
        lost++;
        streak = 0;
        bad(win, 'ESSAY DELETED!');
        fx.flash('red');
        fx.sound('thud');
        shut(c);
      } else {
        closed++;
        streak++;
        good(win);
        fx.burst(win, COLOR[b], kind === 'sure' ? 18 : 8);
        shut(c);
        pulse(c.poof, 'go');
        if (kind === 'sure') {
          fx.pop(c.poof, 'CHAIN x2', COLOR[b]);
          fx.sound('coin');
        } else if (from.nested) {
          open(c, 'sure', from);
          fx.sound('boing');
        }
        if (streak % 10 === 0) {
          fx.flash('gold');
          fx.pop(desk, 'AD-FREE!', 'gold');
          fx.sound('power');
        }
        count.textContent = String(closed);
        pulse(count, 'bump');
      }
      fill.style.width = `${score() / 10}%`;
    },
    tick(t) {
      advance(t);
    },
    score,
    // Oldest pop-up first; an ARE YOU SURE keeps its ad's place in the queue.
    hint() {
      let best: Btn | null = null;
      for (const b of [0, 1, 2] as Btn[]) {
        const s = cols[b].kind === 'essay' ? null : cols[b].from;
        if (s && (best === null || s.at < cols[best].from!.at)) best = b;
      }
      return best;
    },
  };
};
