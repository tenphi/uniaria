import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  // Hooks and a context, so client-only: the directive lets a React Server
  // Component import from here and render `OwnerProvider`. A banner, as
  // Rolldown recommends; it warns about a directive in the source.
  outputOptions: { banner: "'use client';" },
});
