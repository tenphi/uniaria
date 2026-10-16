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
    'text-field/index': 'src/components/text-field/index.ts',
    'checkbox/index': 'src/components/checkbox/index.ts',
    'checkbox-group/index': 'src/components/checkbox-group/index.ts',
    'switch/index': 'src/components/switch/index.ts',
    'radio/index': 'src/components/radio/index.ts',
    'dialog/index': 'src/components/dialog/index.ts',
    'popover/index': 'src/components/popover/index.ts',
    'radio-group/index': 'src/components/radio-group/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
