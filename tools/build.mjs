// Builds the web view (Vite) and the server bundle (esbuild).
//   node tools/build.mjs            one-off build
//   node tools/build.mjs --watch    rebuild on change (used by `devvit playtest`)
//   MOCK=1 node tools/build.mjs     client talks to tools/mock-server.mjs, no Reddit needed
import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const mock = !!process.env.MOCK;

const client = {
  root: path.join(root, 'src/client'),
  base: './',
  logLevel: 'warn',
  resolve: {
    alias: mock ? { '@devvit/web/client': path.join(root, 'tools/mock-devvit-client.ts') } : {},
  },
  build: {
    outDir: path.join(root, mock ? 'dist/mock-client' : 'dist/client'),
    emptyOutDir: true,
    target: 'es2020',
    watch: watch ? {} : null,
    rollupOptions: {
      input: {
        splash: path.join(root, 'src/client/splash.html'),
        game: path.join(root, 'src/client/game.html'),
      },
    },
  },
};

const server = {
  entryPoints: [path.join(root, 'src/server/index.ts')],
  outfile: path.join(root, 'dist/server/index.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'warning',
};

await viteBuild(client);
if (mock) {
  await esbuild.build({
    ...server,
    entryPoints: [path.join(root, 'tools/mock-server.ts')],
    outfile: path.join(root, 'dist/mock-server.cjs'),
  });
} else {
  if (watch) await (await esbuild.context(server)).watch();
  else await esbuild.build(server);
}
console.log(`built ${mock ? 'mock client' : 'client + server'}${watch ? ' (watching)' : ''}`);
