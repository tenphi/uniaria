# @uniaria/styles

## 0.3.0

### Minor Changes

- [#22](https://github.com/tenphi/uniaria/pull/22) [`3eed317`](https://github.com/tenphi/uniaria/commit/3eed31782896bc03de02a29e6f7080ccdf333122) Thanks [@tenphi](https://github.com/tenphi)! - Autocomplete's look (`@uniaria/styles/autocomplete`): the input drawn as a
  field's, with the list under it, and the empty text inside the list's box.

- [#16](https://github.com/tenphi/uniaria/pull/16) [`33d5d06`](https://github.com/tenphi/uniaria/commit/33d5d069271c67f8330beb8db35ca1a35775a813) Thanks [@tenphi](https://github.com/tenphi)! - The item look: a button or trigger with a label part, and an option with an
  `optionLabel`, lays out its icon, label, description and hint on a grid, one
  line each with an ellipsis; a frame holds its extras over the button's end.
  Options without a label part cut their text to one line too. Quiet buttons
  take the text color around them and mix their hover and press fills from it
  (`--uni-quiet-hover` and `--uni-quiet-pressed`), so they read on any fill.

### Patch Changes

- [#28](https://github.com/tenphi/uniaria/pull/28) [`f76495e`](https://github.com/tenphi/uniaria/commit/f76495e703b6cb1575144c9041f254674f470c9f) Thanks [@tenphi](https://github.com/tenphi)! - A checkbox no longer moves down a pixel or two as it is checked or
  mixed: its check and dash are out of the flow, so they don't set the
  row's baseline.

- [#40](https://github.com/tenphi/uniaria/pull/40) [`e7d3224`](https://github.com/tenphi/uniaria/commit/e7d3224efe53b5c4cd4711845097f99968267b56) Thanks [@tenphi](https://github.com/tenphi)! - Checkbox, Switch and Radio hang from the top of their line instead of sitting on the font's baseline, so a group's items are 8 pixels apart in custom elements too, whatever the page's font. The line under a custom element's host used to make each row taller than its 24 pixels.

## 0.2.0

### Patch Changes

- [#7](https://github.com/tenphi/uniaria/pull/7) [`54f214f`](https://github.com/tenphi/uniaria/commit/54f214f7be1a71b000311bb63275e50d3e08e353) Thanks [@tenphi](https://github.com/tenphi)! - The package READMEs link to their pages on https://uniaria.tenphi.me.

## 0.1.0

### Minor Changes

- [`194afcd`](https://github.com/tenphi/uniaria/commit/194afcdf3b6bf3fab5c3ef6e9b3a3f64a5bcfb01) Thanks [@tenphi](https://github.com/tenphi)! - The first release: framework-agnostic headless behavior for Button,
  ToggleButton, Field, TextField, NumberField, Checkbox, CheckboxGroup,
  Switch, Radio, RadioGroup, Dialog, Popover, Tooltip, Listbox, Select and
  Combobox, with a React adapter, light-DOM custom elements, the conformance
  suites and testing tools both adapters pass, and optional default styles:
  prebuilt CSS, a CSS builder and Tasty style objects.
