#!/usr/bin/env node
// Automated play-test for mini-games:  node tools/game-check.mjs <id> [<id> ...]   (or --all)
//
// For each game it lints the three files, type-checks them in isolation, bundles
// the game alone into a test page, then plays it with bots in virtual time
// (a perfect player, a casual player, an idle player, a random masher, a
// one-button spammer and a chaos monkey) and in real time at three screen sizes
// for layout checks and screenshots. Exit code 1 if any game fails.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { gameIds } from './gen-registry.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p);

const SEEDS = [11, 222, 3333];
const PERFECT = { kind: 'oracle', reaction: 0, rate: 10 };
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, level: 2, seed: 222 },
  { name: 'small', width: 360, height: 640, level: 4, seed: 3333 },
  { name: 'desktop', width: 1100, height: 700, level: 0, seed: 11 },
];

const FORBIDDEN = [
  [/\bMath\.random\b/, 'Math.random (use ctx.rng)'],
  [/\bDate\.now\b|\bnew Date\b|\bperformance\.now\b/, 'wall-clock time (use the t passed to press/tick)'],
  [/\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/, 'timers (drive everything from tick(t); animate with CSS)'],
  [/\bdocument\.(getElementById|querySelector|querySelectorAll|body|head)\b/, 'reaching outside ctx.root'],
  [/\bwindow\.|\blocalStorage\b|\bfetch\(/, 'window / storage / network access'],
  [/\bimport\s+[^'"]*['"](?!\.\/common['"]|\.\/[a-z]+\.css['"])/, 'imports other than ./common and its own css'],
];

function lintCss(css, id, fail) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const scope = `.g-${id}`;
  function parse(text) {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (/^@keyframes\s/.test(prelude)) {
        const name = prelude.split(/\s+/)[1] ?? '';
        if (!name.startsWith(`g-${id}-`)) fail(`css: @keyframes "${name}" must be named g-${id}-*`);
      } else if (/^@(media|container|supports)\b/.test(prelude)) parse(body);
      else if (prelude.startsWith('@')) fail(`css: at-rule not allowed: ${prelude.slice(0, 40)}`);
      else {
        for (const sel of prelude.split(',').map((s) => s.trim()).filter(Boolean)) {
          if (!(sel === scope || sel.startsWith(`${scope} `) || sel.startsWith(`${scope}.`) || sel.startsWith(`${scope}:`) || sel.startsWith(`${scope}>`) || sel.startsWith(`${scope}[`)))
            fail(`css: selector "${sel}" must start with ${scope}`);
        }
      }
      i = j;
    }
  }
  parse(src);
  if (/\b\d*\.?\d+rem\b/.test(src)) fail('css: use em, not rem, so the game scales with the stage');
  if (/position:\s*fixed/.test(src)) fail('css: position: fixed is not allowed');
}

async function loadMeta(file) {
  const out = await esbuild.build({ entryPoints: [file], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  const url = `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`;
  return (await import(url)).default;
}

function lintMeta(m, id, fail) {
  if (!m || typeof m !== 'object') return fail('meta: default export missing');
  if (m.id !== id) fail(`meta: id "${m.id}" must equal the file name "${id}"`);
  const words = String(m.shout ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) fail(`meta: shout must be 2-6 words, got ${words.length}`);
  if (m.shout !== String(m.shout).toUpperCase()) fail('meta: shout must be ALL CAPS');
  if (words.some((w) => w.length > 11)) fail('meta: a shout word is longer than 11 characters and will not fit on a phone');
  if (!m.title || m.title.length > 22) fail('meta: title must be 1-22 characters');
  if (!m.how || m.how.length > 90) fail('meta: how must be 1-90 characters');
  if (!Array.isArray(m.labels) || m.labels.length !== 3 || m.labels.some((l) => !l || l.length > 9)) fail('meta: labels must be three strings of 1-9 characters');
  if (!(m.duration >= 6000 && m.duration <= 8000)) fail('meta: duration must be 6000-8000');
  if (m.think !== undefined && !(m.think >= 0 && m.think <= 1500)) fail('meta: think must be 0-1500');
  if (!['mash', 'react', 'sort', 'memory', 'timing', 'brain'].includes(m.kind)) fail('meta: kind must be mash | react | sort | memory | timing | brain');
}

const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));

const ART = process.argv.includes('--art');

async function checkGame(id, browser) {
  const fails = [];
  const warns = [];
  const fail = (m) => fails.push(m);
  const warn = (m) => warns.push(m);
  const files = {
    meta: path.join(root, `src/shared/games/${id}.ts`),
    ts: path.join(root, `src/client/games/${id}.ts`),
    css: path.join(root, `src/client/games/${id}.css`),
  };
  const outDir = path.join(root, 'dist/check', id);
  fs.mkdirSync(outDir, { recursive: true });
  const report = { id, pass: false, fails, warns, scores: {}, shots: [] };
  for (const [k, f] of Object.entries(files)) if (!fs.existsSync(f)) fail(`missing file ${rel(f)} (${k})`);
  if (fails.length) return report;

  // ---- static checks
  const src = fs.readFileSync(files.ts, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [re, what] of FORBIDDEN) if (re.test(code)) fail(`code: must not use ${what}`);
  if (!code.includes(`import './${id}.css'`)) fail(`code: must import './${id}.css'`);
  if (!/export const create\b/.test(code)) fail('code: must `export const create: GameFactory`');
  if (!code.includes(`g-${id}`)) fail(`code: the wrapper element needs the class g-${id}`);
  for (const m of code.matchAll(/defineSprite\(\s*['"`]([^'"`]+)['"`]/g)) {
    if (!m[1].startsWith(`${id}-`)) fail(`code: sprite "${m[1]}" must be named ${id}-something so games never overwrite each other's art`);
  }
  const lines = src.split('\n').length;
  if (lines > 260) warn(`code: ${lines} lines; aim for under 200`);
  lintCss(fs.readFileSync(files.css, 'utf8'), id, fail);
  let meta = null;
  try {
    meta = await loadMeta(files.meta);
    lintMeta(meta, id, fail);
  } catch (err) {
    fail(`meta: cannot load (${String(err.message).split('\n')[0]})`);
  }

  // ---- type-check this game alone
  const tsconfig = path.join(outDir, 'tsconfig.json');
  fs.writeFileSync(
    tsconfig,
    JSON.stringify({
      extends: path.join(root, 'tsconfig.client.json'),
      include: [files.ts, files.meta, path.join(root, 'src/client/env.d.ts')],
    })
  );
  try {
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', tsconfig], { cwd: root, stdio: 'pipe' });
  } catch (err) {
    const text = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(0, 12).join('\n      ');
    fail(`types: tsc reported errors\n      ${text}`);
  }

  // ---- bundle the game alone
  try {
    await esbuild.build({
      entryPoints: [path.join(root, 'tools/harness/entry.ts')],
      outfile: path.join(outDir, 'h.js'),
      bundle: true,
      format: 'iife',
      target: 'es2020',
      alias: { '@game': files.ts, '@meta': files.meta },
      loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
      logLevel: 'silent',
    });
  } catch (err) {
    fail(`bundle: ${String(err.message).split('\n').slice(0, 6).join(' | ')}`);
    return report;
  }
  const html = path.join(outDir, 'index.html');
  fs.writeFileSync(
    html,
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="h.css"></head><body><script src="h.js"></script></body></html>'
  );

  // ---- virtual-time bots
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]));
  await page.goto(pathToFileURL(html).href);
  const sim = async (level, seed, bot) => {
    const r = await page.evaluate(([l, s, b]) => window.__h.simulate(l, s, b), [level, seed, bot]);
    if (r.error) fail(`crash (${bot.kind} bot, level ${level}, seed ${seed}): ${r.error.split('\n').slice(0, 3).join(' | ')}`);
    else if (r.badScore) fail(`score (${bot.kind} bot, level ${level}): ${r.badScore}`);
    return r.error ? { score: 0, goods: 0, bads: 0, lastHintAt: -1, maxAt: -1, startHtml: '', duration: 1 } : r;
  };
  const byLevel = async (bot) => {
    const out = {};
    for (const level of [0, 2, 4]) out[level] = avg(await Promise.all(SEEDS.map(async (s) => (await sim(level, s, bot)).score)));
    return out;
  };
  const think = Number.isFinite(meta?.think) ? meta.think : 380;
  // In a mash game the think time is paid only when the target changes; elsewhere on every press.
  const perTap = meta?.kind !== 'mash';
  const FAST = { kind: 'oracle', reaction: Math.round(think * 0.6), rate: 9, perTap };
  const CASUAL = { kind: 'oracle', reaction: think, rate: 6, perTap };
  const perfect = await byLevel(PERFECT);
  const fast = await byLevel(FAST);
  const casual = await byLevel(CASUAL);
  const idle = Math.max(...(await Promise.all([0, 4].flatMap((l) => SEEDS.slice(0, 2).map(async (s) => (await sim(l, s, { kind: 'idle' })).score)))));
  const random = avg(await Promise.all([1, 2, 3, 4].map(async (bs) => (await sim(2, 222, { kind: 'random', rate: 8, seed: bs })).score)));
  const spam = await Promise.all([0, 1, 2].map(async (btn) => (await sim(2, 222, { kind: 'spam', btn, rate: 8 })).score));
  for (const s of SEEDS) await sim(4, s, { kind: 'fuzz', seed: s });
  const a = await sim(2, 11, PERFECT);
  const b = await sim(2, 11, PERFECT);
  const starts = new Set((await Promise.all(SEEDS.map((s) => sim(2, s, PERFECT)))).map((r) => r.startHtml));
  const hard = await sim(4, 222, FAST);
  report.scores = { think, perfect, fast, casual, idle, random, spam, goods: a.goods, bads: (await sim(2, 222, { kind: 'random', rate: 8, seed: 9 })).bads };

  if (a.score !== b.score || a.startHtml !== b.startHtml) fail('determinism: the same seed gave a different round or score (is something not using ctx.rng?)');
  if (starts.size < 2) warn('variety: three different seeds produced the identical opening screen');
  if (perfect[0] < 950) fail(`winnable: a perfect player (10 presses/s, instant) scores ${perfect[0]} at level 0; must reach 950. Is hint() right, or is the par too high?`);
  if (perfect[4] < 900) fail(`winnable: a perfect player scores only ${perfect[4]} at level 4; must reach 900`);
  if (idle > 150) fail(`idle: doing nothing scores ${idle}; must be 150 or less`);
  if (!meta?.mashable) {
    if (random > 450) fail(`anti-mash: random mashing scores ${random}; must be 450 or less (penalise wrong presses, or set mashable: true only if mashing IS the game)`);
    if (Math.max(...spam) > 500) fail(`anti-mash: spamming one button scores ${Math.max(...spam)}; must be 500 or less`);
  }
  if (a.goods === 0) fail('juice: ctx.good() was never called during a perfect run');
  if (casual[0] < 550) warn(`balance: a casual player (think ${think}ms, 6 presses/s, never wrong) scores ${casual[0]} at level 0; first rounds should feel generous (aim 650-950)`);
  if (casual[0] > 990 && casual[4] > 990 && meta?.kind !== 'timing') warn(`balance: a casual player maxes out at every level (${casual[0]}/${casual[4]}); raise the par or shorten the windows so skill shows`);
  if (casual[4] < 300) warn(`balance: a casual player scores only ${casual[4]} at level 4; probably too punishing (aim 400-850)`);
  if (fast[4] < 800) warn(`balance: even a fast player (think ${Math.round(think * 0.6)}ms, 9 presses/s) only scores ${fast[4]} at level 4; a great run should be able to reach about 1000`);
  const dead = 1 - (hard.lastHintAt + 16) / hard.duration;
  if (dead > 0.22) warn(`pacing: a fast player has nothing left to do for the last ${Math.round(dead * 100)}% of the round at level 4. Generate more content than anyone can finish and score against a par.`);
  await page.close();

  // ---- real-time rounds at three screen sizes
  await Promise.all(
    VIEWPORTS.map(async (vp) => {
      const p = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      p.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]));
      await p.goto(pathToFileURL(html).href + (ART ? '?art=1' : ''));
      await p.evaluate(([l, s]) => window.__h.live(l, s), [vp.level, vp.seed]);
      for (const frac of [0.4, 0.8]) {
        await p.waitForFunction((f) => window.__h.liveState().t >= window.__h.meta.duration * f || !window.__h.liveState().running, frac, { timeout: 15000 });
        const lay = await p.evaluate(() => window.__h.layout());
        lay.issues.forEach((m) => fail(`layout (${vp.name} ${vp.width}x${vp.height}, stage ${lay.stage.w}x${lay.stage.h}): ${m}`));
        lay.warn.forEach((m) => warn(`layout (${vp.name}): ${m}`));
        if (frac === 0.4) {
          const shot = path.join(outDir, `${vp.name}.png`);
          await p.screenshot({ path: shot });
          report.shots.push(rel(shot));
        }
      }
      const st = await p.evaluate(() => window.__h.liveState());
      if (st.error) fail(`crash in real-time run (${vp.name}): ${st.error.split('\n').slice(0, 3).join(' | ')}`);
      await p.close();
    })
  );
  [...new Set(pageErrors)].forEach((e) => fail(`page error: ${e}`));

  report.fails = [...new Set(fails)];
  report.warns = [...new Set(warns)];
  report.pass = report.fails.length === 0;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

function print(r) {
  const s = r.scores;
  console.log(`\n== ${r.id} ==  ${r.pass ? 'PASS' : 'FAIL'}`);
  if (s.perfect) {
    console.log('  scores by level      L0    L2    L4');
    console.log(`    perfect player   ${[0, 2, 4].map((l) => String(s.perfect[l]).padStart(5)).join(' ')}   (10 presses/s, instant reactions)`);
    console.log(`    fast player      ${[0, 2, 4].map((l) => String(s.fast[l]).padStart(5)).join(' ')}   (9 presses/s, ${Math.round(s.think * 0.6)}ms to decide)`);
    console.log(`    casual player    ${[0, 2, 4].map((l) => String(s.casual[l]).padStart(5)).join(' ')}   (6 presses/s, ${s.think}ms to decide = meta.think)`);
    console.log(`    idle ${s.idle} | random mash ${s.random} | one-button spam ${s.spam.join('/')} | good() x${s.goods} in a perfect run, bad() x${s.bads} in a random run`);
  }
  r.fails.forEach((m) => console.log(`  FAIL ${m}`));
  r.warns.forEach((m) => console.log(`  WARN ${m}`));
  if (r.shots.length) console.log(`  screenshots: ${r.shots.join('  ')}`);
}

const args = process.argv.slice(2);
const ids = args.includes('--all') ? gameIds() : args.filter((a) => !a.startsWith('-'));
if (!ids.length) {
  console.error('usage: node tools/game-check.mjs <id> [<id> ...] | --all');
  process.exit(2);
}
const { chromium } = require('playwright');
const browser = await chromium.launch();
const reports = [];
for (const id of ids) {
  const r = await checkGame(id, browser);
  r.fails = [...new Set(r.fails)];
  r.pass = r.fails.length === 0;
  reports.push(r);
  print(r);
}
await browser.close();
const failed = reports.filter((r) => !r.pass);
console.log(`\n${reports.length - failed.length}/${reports.length} passed${failed.length ? `; failing: ${failed.map((r) => r.id).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
