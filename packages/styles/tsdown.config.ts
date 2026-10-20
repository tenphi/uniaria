import { defineConfig } from 'tsdown';

import type { generate as Generate } from './src/generate';

// Every entry here but `generate` needs a matching `exports` entry in
// package.json.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    button: 'src/components/button.ts',
    'toggle-button': 'src/components/toggle-button.ts',
    checkbox: 'src/components/checkbox.ts',
    switch: 'src/components/switch.ts',
    radio: 'src/components/radio.ts',
    'checkbox-group': 'src/components/checkbox-group.ts',
    'radio-group': 'src/components/radio-group.ts',
    field: 'src/components/field.ts',
    build: 'src/build.ts',
    // Internal: the hook below runs it.
    generate: 'src/generate.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  // `build` and `generate` run in Node.
  deps: { neverBundle: [/^node:/] },
  hooks: {
    // The prebuilt CSS, from the same source (spec: Build). Built first:
    // Node loads this config, and can't import the sources' extensionless
    // paths.
    async 'build:done'() {
      // Not a literal: typechecking runs before the build too.
      const entry = './dist/generate.js';
      const { generate } = (await import(entry)) as {
        generate: typeof Generate;
      };
      generate('dist/css');
    },
  },
});
