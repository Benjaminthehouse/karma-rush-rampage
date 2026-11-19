// Stand-alone page that hosts ONE mini-game for tools/game-check.mjs.
// `@game` and `@meta` are aliased to the game under test at bundle time, so a
// broken neighbour can never affect this game's check.
import '../../src/client/style.css';
import { create } from '@game';
import meta from '@meta';
import { createFx } from '../../src/client/fx';
import { mulberry32 } from '../../src/shared/rng';

type Btn = 0 | 1 | 2;
type Bot =
  | { kind: 'idle' }
  | { kind: 'oracle'; reaction: number; rate: number; perTap?: boolean }
  | { kind: 'random'; rate: number; seed: number }
  | { kind: 'spam'; btn: Btn; rate: number }
  | { kind: 'fuzz'; seed: number };

document.body.innerHTML = `
<div id="app"><main>
  <section id="play" class="screen">
    <header class="hud"><div id="pips"><i class="done"></i><i class="now"></i><i></i><i></i><i></i></div>
      <div id="hud-title"></div><div class="hud-right"><span id="combo"></span><span id="hud-score">1,000</span></div></header>
    <div id="timebar"><i></i></div>
    <div class="arena" id="arena"><div id="stage"></div><div id="card" class="ui" hidden></div><div id="fx" class="fx-layer"></div></div>
  </section></main>
  <footer id="pads">
    <button class="pad c-red"><kbd>A</kbd><span></span></button>
    <button class="pad c-green"><kbd>S</kbd><span></span></button>
    <button class="pad c-blue"><kbd>D</kbd><span></span></button>
  </footer></div>`;

const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
const pads = [...document.querySelectorAll<HTMLElement>('.pad')];
pads.forEach((p, i) => (p.querySelector('span')!.textContent = meta.labels[i]));
$('hud-title').textContent = meta.title;
document.body.classList.add('fx-low'); // steady frame for screenshots
const fx = createFx($('arena'), $('fx'));
const noFx = { burst() {}, pop() {}, flash() {}, shake() {}, sound() {} };

function validScore(v: unknown) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000;
}

/** Drives one bot against one game instance. `step(t)` must be called with increasing t. */
function driver(level: number, seed: number, bot: Bot, real: boolean) {
  const down = [false, false, false];
  const stats = { goods: 0, bads: 0, presses: 0, badScore: '' as string, lastHintAt: -1, maxAt: -1, error: '' };
  stage.replaceChildren();
  stage.className = '';
  const rng = mulberry32(seed);
  const inst = create({
    root: stage,
    rng,
    level,
    duration: meta.duration,
    down,
    good: (at, text) => {
      stats.goods++;
      if (real) {
        fx.burst(at ?? null, 'gold', 6);
        if (text) fx.pop(at ?? null, text, 'gold');
      }
    },
    bad: (at, text) => {
      stats.bads++;
      if (real && text) fx.pop(at ?? null, text, 'red');
    },
    fx: real ? { burst: fx.burst, pop: fx.pop, flash: fx.flash, shake: fx.shake, sound() {} } : noFx,
  });
  const startHtml = stage.innerHTML;
  const botRng = mulberry32(('seed' in bot ? bot.seed : 1) * 7919 + 13);
  const releases: { at: number; b: Btn }[] = [];
  let lastKey = 'null';
  let since = 0;
  let nextTap = 0;
  let holding: Btn[] = [];
  let top = 0;

  const press = (b: Btn, t: number) => {
    if (down[b]) return;
    down[b] = true;
    stats.presses++;
    if (real) pads[b].classList.add('down');
    inst.press(b, t);
  };
  const release = (b: Btn, t: number) => {
    if (!down[b]) return;
    down[b] = false;
    if (real) pads[b].classList.remove('down');
    inst.release?.(b, t);
  };
  const tap = (btns: Btn[], t: number, rate: number) => {
    btns.forEach((b) => press(b, t));
    btns.forEach((b) => releases.push({ at: t + Math.min(48, 500 / rate), b }));
    nextTap = t + 1000 / rate;
  };

  function step(t: number) {
    for (let i = releases.length - 1; i >= 0; i--) {
      if (releases[i].at <= t) {
        release(releases[i].b, t);
        releases.splice(i, 1);
      }
    }
    inst.tick(t);
    const s = inst.score();
    if (!validScore(s) && !stats.badScore) stats.badScore = `score() returned ${String(s)} at t=${t}`;
    if (validScore(s) && s > top) {
      top = s;
      stats.maxAt = t;
    }
    const hint = inst.hint(t);
    if (hint !== null) stats.lastHintAt = t;
    if (bot.kind === 'oracle') {
      const key = JSON.stringify(hint);
      if (key !== lastKey) {
        lastKey = key;
        since = t;
      }
      const ready = t - since >= bot.reaction;
      const isHold = hint !== null && typeof hint === 'object' && !Array.isArray(hint);
      if (isHold && ready) {
        const want = (hint as { hold: Btn[] }).hold;
        ([0, 1, 2] as Btn[]).forEach((b) => (want.includes(b) ? press(b, t) : holding.includes(b) && release(b, t)));
        holding = [...want];
      } else if (!isHold) {
        if (holding.length && ready) {
          holding.forEach((b) => release(b, t));
          holding = [];
        }
        if (hint !== null && ready && t >= nextTap && !releases.length) {
          tap(Array.isArray(hint) ? (hint as Btn[]) : [hint as Btn], t, bot.rate);
          // Decision games: every press answers a fresh prompt, even if the answer repeats.
          if (bot.perTap) since = t;
        }
      }
    } else if (bot.kind === 'random') {
      if (t >= nextTap) tap([Math.floor(botRng() * 3) as Btn], t, bot.rate);
    } else if (bot.kind === 'spam') {
      if (t >= nextTap) tap([bot.btn], t, bot.rate);
    } else if (bot.kind === 'fuzz') {
      // Chaos: random presses and releases, including chords and holds.
      for (let i = 0; i < 2; i++) {
        const b = Math.floor(botRng() * 3) as Btn;
        if (botRng() < 0.25) (down[b] ? release : press)(b, t);
      }
    }
  }

  function finish() {
    const t = meta.duration;
    ([0, 1, 2] as Btn[]).forEach((b) => release(b, t));
    const score = inst.score();
    if (!validScore(score) && !stats.badScore) stats.badScore = `final score() returned ${String(score)}`;
    // Input after the bell must not crash (the real engine never delivers it).
    ([0, 1, 2] as Btn[]).forEach((b) => {
      inst.press(b, t + 20);
      inst.release?.(b, t + 40);
    });
    inst.tick(t + 50);
    inst.score();
    return { score, ...stats, startHtml, duration: meta.duration };
  }

  return { step, finish, stats, score: () => inst.score() };
}

const live = { running: false, t: 0, error: '' };

(window as any).__h = {
  meta,
  /** Whole round in virtual time; returns in milliseconds. */
  simulate(level: number, seed: number, bot: Bot) {
    try {
      const d = driver(level, seed, bot, false);
      for (let t = 0; t <= meta.duration; t += 16) d.step(t);
      return d.finish();
    } catch (err) {
      return { error: String((err as Error)?.stack ?? err) };
    }
  },
  /** Real-time round with a casual oracle player, for screenshots and layout checks. */
  live(level: number, seed: number) {
    const d = driver(level, seed, { kind: 'oracle', reaction: meta.think ?? 380, rate: 6, perTap: meta.kind !== 'mash' }, true);
    const t0 = performance.now();
    const bar = $('timebar').firstElementChild as HTMLElement;
    live.running = true;
    live.error = '';
    const frame = () => {
      live.t = performance.now() - t0;
      if (live.t >= meta.duration) {
        live.running = false;
        return;
      }
      try {
        d.step(live.t);
      } catch (err) {
        live.error = String((err as Error)?.stack ?? err);
        live.running = false;
        return;
      }
      bar.style.width = `${(1 - live.t / meta.duration) * 100}%`;
      $('hud-score').textContent = String(d.score());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
  liveState: () => ({ ...live }),
  /** Layout problems visible right now. */
  layout() {
    const box = stage.getBoundingClientRect();
    const issues: string[] = [];
    const wrap = stage.firstElementChild as HTMLElement | null;
    if (!wrap || stage.childElementCount !== 1) issues.push(`stage must contain exactly one wrapper element, found ${stage.childElementCount}`);
    else if (!wrap.classList.contains(`g-${meta.id}`)) issues.push(`wrapper must have class g-${meta.id}`);
    let minFont = 99;
    const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const label = `"${node.textContent.trim().slice(0, 24)}"`;
      const fs = parseFloat(cs.fontSize);
      minFont = Math.min(minFont, fs);
      if (fs < 11) issues.push(`text ${label} is ${fs.toFixed(1)}px, below the 11px minimum`);
      const out = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
      if (out > 2) issues.push(`text ${label} sticks ${Math.round(out)}px outside the stage`);
      // Text clipped by its own box.
      if (cs.overflow !== 'visible' && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2))
        issues.push(`text ${label} is clipped by its container (${el.className || el.tagName})`);
    }
    const warn: string[] = [];
    if (wrap && (wrap.scrollWidth > wrap.clientWidth + 3 || wrap.scrollHeight > wrap.clientHeight + 3))
      warn.push(`wrapper content overflows by ${wrap.scrollWidth - wrap.clientWidth}x${wrap.scrollHeight - wrap.clientHeight}px; check nothing important is cut off`);
    return { issues: [...new Set(issues)], warn, minFont, stage: { w: Math.round(box.width), h: Math.round(box.height) } };
  },
};
