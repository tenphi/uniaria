import { defineConfig } from 'tsdown';

// Every entry here needs a matching `exports` entry in package.json and a line
// in src/ssr-safety.test.ts.
export default defineConfig({
  // `virtual/index` bundles `@tanstack/virtual-core` (a pinned dev
  // dependency) with its development checks compiled out: its dist reads
  // `process.env.NODE_ENV`, which throws on a page with no bundler. Only its
  // files: UniAria's own warnings keep reading the consumer's NODE_ENV.
  deps: { alwaysBundle: ['@tanstack/virtual-core'] },
  plugins: [
    {
      name: 'virtual-core-production',
      transform(code, id) {
        if (!id.includes('@tanstack/virtual-core')) return null;
        // Same length, so the source map stays exact.
        return {
          code: code.replaceAll(
            'process.env.NODE_ENV',
            '"production"'.padEnd(20),
          ),
          map: null,
        };
      },
    },
  ],
  entry: {
    index: 'src/index.ts',
    'dom/index': 'src/dom/index.ts',
    'collections/index': 'src/collections/index.ts',
    'button/index': 'src/components/button/index.ts',
    'toggle-button/index': 'src/components/toggle-button/index.ts',
    'field/index': 'src/components/field/index.ts',
    'text-input/index': 'src/components/text-input/index.ts',
    'text-field/index': 'src/components/text-field/index.ts',
    'checkbox/index': 'src/components/checkbox/index.ts',
    'checkbox-group/index': 'src/components/checkbox-group/index.ts',
    'switch/index': 'src/components/switch/index.ts',
    'radio/index': 'src/components/radio/index.ts',
    'dialog/index': 'src/components/dialog/index.ts',
    'popover/index': 'src/components/popover/index.ts',
    'tooltip/index': 'src/components/tooltip/index.ts',
    'radio-group/index': 'src/components/radio-group/index.ts',
    'number-field/index': 'src/components/number-field/index.ts',
    'listbox/index': 'src/components/listbox/index.ts',
    'select/index': 'src/components/select/index.ts',
    'combobox/index': 'src/components/combobox/index.ts',
    'virtual/index': 'src/virtual/index.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
