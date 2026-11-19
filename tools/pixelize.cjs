// Turns a pixel-art SVG (every shape on a fixed grid) into a 1x PNG: one SVG grid cell
// becomes one PNG pixel. The game scales it back up with image-rendering: pixelated.
//   node tools/pixelize.cjs <in.svg> <out.png> [cell=8]
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [src, out, cellArg] = process.argv.slice(2);
  const cell = Number(cellArg ?? 8);
  const svg = fs.readFileSync(src, 'utf8');
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  const pw = Number(w) / cell, ph = Number(h) / cell;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: pw, height: ph } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${pw}px;height:${ph}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: pw, height: ph } });
  await browser.close();
  console.log(`${src} -> ${out}: ${pw}x${ph}, ${fs.statSync(out).size} bytes`);
})();
