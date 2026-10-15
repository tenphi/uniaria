import { defineConfig } from 'tsdown';

// Every entry here needs a matching `exports` entry in package.json and a line
// in src/ssr-safety.test.ts. Registering entries also go in `sideEffects`.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    button: 'src/button.ts',
    'toggle-button': 'src/toggle-button.ts',
    field: 'src/field.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
