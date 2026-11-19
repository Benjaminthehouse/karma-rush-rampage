// Builds a self-contained static demo of the game (no server: it runs in
// offline mode) laid out for publishing as a single page plus asset files.
//   node tools/build-artifact.mjs   →  dist/artifact/page.html + dist/artifact/assets/*
import { build as viteBuild } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist/artifact');
const ids = generate();

await viteBuild({
  root: path.join(root, 'src/client'),
  base: './',
  logLevel: 'warn',
  resolve: { alias: { '@devvit/web/client': path.join(root, 'tools/mock-devvit-client.ts') } },
  build: {
    outDir: out,
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: { game: path.join(root, 'src/client/game.html') },
      // Stable names, so republishing replaces files instead of piling up hashed copies.
      output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
    },
  },
});

// The host wraps the page in its own document, so keep only what goes inside it.
const html = fs.readFileSync(path.join(out, 'game.html'), 'utf8');
const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
const body = /<body>([\s\S]*?)<\/body>/.exec(html)[1];
const tags = [...head.matchAll(/<(?:link|script)\b[^>]*(?:rel="(?:stylesheet|modulepreload)"|type="module")[^>]*>(?:<\/script>)?/g)].map((m) => m[0]);
const page = `<title>Karma Rush Rampage</title>
<meta name="claude:viewport-fit-sides" content="cover">
${tags.filter((t) => t.startsWith('<link')).join('\n')}
<style>
  /* One-screen app inside the host page: fill it, and keep the side gutters clear. */
  html, body { height: 100%; }
  #app { height: 100%; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
</style>
${body.trim()}
${tags.filter((t) => t.startsWith('<script')).join('\n')}
`;
fs.writeFileSync(path.join(out, 'page.html'), page);
fs.rmSync(path.join(out, 'game.html'));
const files = fs.readdirSync(path.join(out, 'assets'));
console.log(`artifact: ${ids.length} games, page.html + ${files.length} asset files (${Math.round(files.reduce((n, f) => n + fs.statSync(path.join(out, 'assets', f)).size, 0) / 1024)} KB)`);
