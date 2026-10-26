# @uniaria/testing

## 0.3.0

### Patch Changes

- [#25](https://github.com/tenphi/uniaria/pull/25) [`dc2d698`](https://github.com/tenphi/uniaria/commit/dc2d698ab8b3add2ae346183dbaae64384a5b4ef) Thanks [@tenphi](https://github.com/tenphi)! - The mount contract's `call()` takes the action's arguments and resolves with what the action returned, awaited, so scenarios can drive actions such as Form's `setValue(name, value)` and read `submit()`'s result.

- [#31](https://github.com/tenphi/uniaria/pull/31) [`7053007`](https://github.com/tenphi/uniaria/commit/70530070d2647d0395ce824ac920e5b1ccf8d7bb) Thanks [@tenphi](https://github.com/tenphi)! - A real screen reader's `press()` and `type()` wait after each key until it stops speaking, so `spoken()` holds everything the key made it say, a live region read after the key's own speech included. VoiceOver runs with its hints off, so it no longer adds instructions for using it to what a scenario hears.
- Updated dependencies [[`45b9d20`](https://github.com/tenphi/uniaria/commit/45b9d20448d0cdb62e7c2af227aa66b57d68cb74), [`92ded6e`](https://github.com/tenphi/uniaria/commit/92ded6ea5d6fa02a344cb3082f69dcd673a59043), [`3eed317`](https://github.com/tenphi/uniaria/commit/3eed31782896bc03de02a29e6f7080ccdf333122), [`d77fb10`](https://github.com/tenphi/uniaria/commit/d77fb10774fa40a29b80c565f3c4b6460929d1e9), [`f87986d`](https://github.com/tenphi/uniaria/commit/f87986d68f23ed0446849efd97c900eee56cfcaa), [`ed1ba69`](https://github.com/tenphi/uniaria/commit/ed1ba69507ca58eadf7797359b7f14fab1baafa1), [`33d5d06`](https://github.com/tenphi/uniaria/commit/33d5d069271c67f8330beb8db35ca1a35775a813), [`3eed317`](https://github.com/tenphi/uniaria/commit/3eed31782896bc03de02a29e6f7080ccdf333122), [`0233f8e`](https://github.com/tenphi/uniaria/commit/0233f8efc7d00202eef736d499f3066948132a91)]:
  - @uniaria/core@0.3.0

## 0.2.0

### Patch Changes

- [#7](https://github.com/tenphi/uniaria/pull/7) [`54f214f`](https://github.com/tenphi/uniaria/commit/54f214f7be1a71b000311bb63275e50d3e08e353) Thanks [@tenphi](https://github.com/tenphi)! - The package READMEs link to their pages on https://uniaria.tenphi.me.
- Updated dependencies [[`54f214f`](https://github.com/tenphi/uniaria/commit/54f214f7be1a71b000311bb63275e50d3e08e353)]:
  - @uniaria/core@0.2.0

## 0.1.0

### Minor Changes

- [`194afcd`](https://github.com/tenphi/uniaria/commit/194afcdf3b6bf3fab5c3ef6e9b3a3f64a5bcfb01) Thanks [@tenphi](https://github.com/tenphi)! - The first release: framework-agnostic headless behavior for Button,
  ToggleButton, Field, TextField, NumberField, Checkbox, CheckboxGroup,
  Switch, Radio, RadioGroup, Dialog, Popover, Tooltip, Listbox, Select and
  Combobox, with a React adapter, light-DOM custom elements, the conformance
  suites and testing tools both adapters pass, and optional default styles:
  prebuilt CSS, a CSS builder and Tasty style objects.

### Patch Changes

- Updated dependencies [[`194afcd`](https://github.com/tenphi/uniaria/commit/194afcdf3b6bf3fab5c3ef6e9b3a3f64a5bcfb01)]:
  - @uniaria/core@0.1.0
