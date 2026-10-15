import { defineConfig } from 'tsdown';

// Every entry here needs a matching `exports` entry in package.json and a line
// in src/ssr-safety.test.ts.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'dom/index': 'src/dom/index.ts',
    'collections/index': 'src/collections/index.ts',
    'button/index': 'src/components/button/index.ts',
    'toggle-button/index': 'src/components/toggle-button/index.ts',
    'field/index': 'src/components/field/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
