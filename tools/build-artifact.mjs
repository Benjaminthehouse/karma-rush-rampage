// Builds a self-contained static demo of the game (no server: it runs in
// offline mode) laid out for publishing as a single page plus asset files.
//   node tools/build-artifact.mjs   →  dist/artifact/page.html (one file, everything inlined)
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

// The host wraps the page in its own document, so keep only what goes inside it,
// and inline everything (styles, fonts, script) so the page is one file with no
// companions: the most widely supported form.
const html = fs.readFileSync(path.join(out, 'game.html'), 'utf8');
const body = /<body>([\s\S]*?)<\/body>/.exec(html)[1].replace(/<script\b[^>]*><\/script>/g, '');
const asset = (name) => path.join(out, 'assets', name);
const css = fs.readFileSync(asset('game.css'), 'utf8').replace(/url\((['"]?)\.\/([^'")]+\.woff2?)\1\)/g, (_, _q, file) => {
  const type = file.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
  return `url(data:${type};base64,${fs.readFileSync(asset(file)).toString('base64')})`;
});
const js = fs.readFileSync(asset('game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const page = `<title>Karma Rush Rampage</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
  /* One-screen app inside the host page: fill it, and keep the side gutters clear. */
  html, body { height: 100%; }
  #app { height: 100%; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
</style>
${body.trim()}
<script type="module">
${js}
</script>
`;
fs.writeFileSync(path.join(out, 'page.html'), page);
fs.rmSync(path.join(out, 'game.html'));
fs.rmSync(path.join(out, 'assets'), { recursive: true });
console.log(`artifact: ${ids.length} games in one file, ${Math.round(page.length / 1024)} KB`);
