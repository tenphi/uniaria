import { defineConfig } from 'tsdown';

// Every entry here needs a matching `exports` entry in package.json and a line
// in src/ssr-safety.test.ts. Registering entries also go in `sideEffects`.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    button: 'src/button.ts',
    'toggle-button': 'src/toggle-button.ts',
    field: 'src/field.ts',
    'text-field': 'src/text-field.ts',
    checkbox: 'src/checkbox.ts',
    'checkbox-group': 'src/checkbox-group.ts',
    switch: 'src/switch.ts',
    radio: 'src/radio.ts',
    'radio-group': 'src/radio-group.ts',
    dialog: 'src/dialog.ts',
    popover: 'src/popover.ts',
    tooltip: 'src/tooltip.ts',
    'number-field': 'src/number-field.ts',
    listbox: 'src/listbox.ts',
    select: 'src/select.ts',
    autocomplete: 'src/autocomplete.ts',
    combobox: 'src/combobox.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
});
