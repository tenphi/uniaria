import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    browser: 'src/browser.ts',
    commands: 'src/commands.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    /^node:/,
    /^vitest/,
    /^@vitest\//,
    '@guidepup/virtual-screen-reader',
    '@guidepup/guidepup',
  ],
});
