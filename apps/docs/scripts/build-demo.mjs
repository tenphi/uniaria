/**
 * Builds the scripts the site's live demos run: `demo/<page>.ts` becomes
 * `public/demo/<page>.js`, one classic script per page, which a `Preview`
 * inlines through its `scripts` prop. Each bundles its own copy of the
 * runtime, since a demo runs in a sandboxed frame of its own. Built from the
 * workspace sources (the `uniaria-source` export condition, as the tests
 * resolve them), so the site needs no package build. Pass page names to
 * rebuild only those (`node scripts/build-demo.mjs select combobox`).
 */

import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build, defaultClientConditions } from 'vite';

const app = fileURLToPath(new URL('..', import.meta.url));
const only = process.argv.slice(2);
const entries = (await readdir(new URL('../demo', import.meta.url)))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.slice(0, -'.ts'.length))
  .filter((page) => only.length === 0 || only.includes(page));

for (const [index, page] of entries.entries()) {
  await build({
    root: app,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    resolve: { conditions: ['uniaria-source', ...defaultClientConditions] },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: 'public/demo',
      emptyOutDir: index === 0 && only.length === 0,
      target: 'es2022',
      lib: {
        entry: `demo/${page}.ts`,
        formats: ['iife'],
        name: 'UniAriaDemo',
        fileName: () => `${page}.js`,
      },
    },
  });
}
