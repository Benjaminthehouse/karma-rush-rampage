#!/usr/bin/env node
// End-to-end smoke test: every registered mini-game is played inside the real
// app (mock server, practice mode, auto-play bot), five per run.
//   npm run smoke            all games
//   npm run smoke -- a b c   only these
// Fails on any page error, console error, or a game the bot cannot score in.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameIds } from './gen-registry.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 5300 + Math.floor(Math.random() * 400);
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ids = wanted.length ? wanted : gameIds();
const shots = process.argv.includes('--shots');

const server = spawn(process.execPath, [path.join(root, 'dist/mock-server.cjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const { chromium } = require('playwright');
// Background pages must keep their full frame rate, or timing games fail for no real reason.
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const chunks = [];
for (let i = 0; i < ids.length; i += 5) chunks.push(ids.slice(i, i + 5));
const problems = [];
const scores = {};

async function run(chunk, n) {
  // Pad short chunks so the lineup is exactly the games under test.
  const games = [...chunk, ...ids].slice(0, 5);
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await page.goto(`http://localhost:${port}/game.html?u=smoke${n}&autoplay=1&games=${games.join(',')}`);
  await page.waitForTimeout(400);
  await page.keyboard.press('a'); // PRACTICE
  if (shots) {
    // One mid-round screenshot per game, taken as each round is under way.
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction((title) => document.getElementById('card')?.hidden && document.getElementById('hud-title')?.textContent === title, metaTitles[games[i]] ?? '', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3200);
      await page.screenshot({ path: path.join(root, 'dist', `smoke-${games[i]}.png`) });
    }
  }
  await page.waitForSelector('#final:not([hidden])', { timeout: 90000 }).catch(() => errs.push('run never reached the final screen'));
  const rows = await page.$$eval('#final-rounds li', (lis) => lis.map((li) => [li.querySelector('span')?.textContent, Number((li.querySelector('b')?.textContent ?? '0').replace(/,/g, ''))]));
  rows.forEach(([title, score], i) => {
    if (i >= chunk.length) return;
    scores[games[i]] = score;
    if (!(score > 0)) problems.push(`${games[i]} (${title}): the demo bot scored ${score} in the real engine`);
  });
  errs.forEach((e) => problems.push(`[${games.join(',')}] ${e}`));
  await page.close();
}

const metaTitles = {};
{
  const esbuild = await import('esbuild');
  const out = await esbuild.build({ entryPoints: [path.join(root, 'src/shared/catalog.gen.ts')], bundle: true, format: 'esm', write: false, logLevel: 'silent' });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
  for (const m of mod.CATALOG) metaTitles[m.id] = m.title;
}

// Three runs at a time keeps frame rates honest on a small machine.
for (let i = 0; i < chunks.length; i += 3) await Promise.all(chunks.slice(i, i + 3).map((c, k) => run(c, i + k)));

await browser.close();
server.kill();
const list = Object.entries(scores).map(([id, s]) => `${id}:${s}`).join('  ');
console.log(list);
console.log(problems.length ? `\nPROBLEMS\n${problems.map((p) => ` - ${p}`).join('\n')}` : `\nsmoke: ${ids.length} games played end to end, no errors`);
process.exit(problems.length ? 1 : 0);
