# @uniaria/react

## 0.3.0

### Minor Changes

- [#19](https://github.com/tenphi/uniaria/pull/19) [`92ded6e`](https://github.com/tenphi/uniaria/commit/92ded6ea5d6fa02a344cb3082f69dcd673a59043) Thanks [@tenphi](https://github.com/tenphi)! - The functions that define and run a component's behavior are named for it:
  `defineComponent` is now `defineBehavior`, `useComponent` is `useBehavior`
  and `useComponentState` is `useBehaviorState`, in React and in Vue. Their
  types follow: `ComponentHandle` is `BehaviorHandle`, `ComponentConfig` is
  `BehaviorConfig`, and Vue's `ComponentProps` is `BehaviorProps`. A definition
  renders nothing, so the old names read like a framework component, and in Vue
  `defineComponent` clashed with Vue's own. Rename the imports; nothing else
  changes.

- [#27](https://github.com/tenphi/uniaria/pull/27) [`ed1ba69`](https://github.com/tenphi/uniaria/commit/ed1ba69507ca58eadf7797359b7f14fab1baafa1) Thanks [@tenphi](https://github.com/tenphi)! - Add Form (`@uniaria/core/form`, `<uni-form>` from `@uniaria/elements/form`):
  the behavior of a `<form>`. It holds the values of the fields bound to it by
  `name`, checks them (`isRequired`, the native constraints on a field's
  input, and a field's `validate`, sync or async) on each field's trigger,
  shows each field's first error, focuses the first invalid field after a
  failed submit, and submits through `handleSubmit` or, without one, posts
  natively once the checks pass. Every field binds to it: TextField,
  NumberField, Checkbox, Switch, CheckboxGroup, RadioGroup, Select, Combobox
  and Field around a control of your own.
  
  Fields take the form props (`name`, `form`, `validate`, `validationTrigger`,
  `validationDelay`, `validationMessages`, `dependsOn`, `isEqual`,
  `shouldPreserve`) and an `errorText` part inside their error part, which a
  form fills with the first error. `isInvalid` is now unset by default, so a
  field in a form shows the form's errors; `true` or `false` still wins. Field
  gains a `setValue` action, follows a native control's value, and reports its
  binding in its state.
  
  The runtime adds inherited links (`LinkKey.isInherited`), which resolve
  from the nearest provider across other UniAria hosts; `ctx.link(key,
  select)`, which follows only what `select` picks from the linked instance;
  `null` for no link; and `Bindable.bind()` and `getDefault()`. React's
  `OwnerProvider` and Vue's provides answer inherited links.

### Patch Changes

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
