# @uniaria/core

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

- [#22](https://github.com/tenphi/uniaria/pull/22) [`3eed317`](https://github.com/tenphi/uniaria/commit/3eed31782896bc03de02a29e6f7080ccdf333122) Thanks [@tenphi](https://github.com/tenphi)! - Composition. TextInput (`@uniaria/core/text-input`) is a native input or
  textarea with TextField's value handling and no labelling, for definitions to
  compose; it has no element. Autocomplete (`@uniaria/core/autocomplete`,
  `<uni-autocomplete>`) is a text input that filters a list always shown below
  it and moves a highlight through it while focus stays in the input, with
  `showAll()` to show every option again. TextField and NumberField are now
  built on TextInput, and Combobox on Autocomplete and Popover: their APIs
  don't change, Combobox's `filter` gets the item as a third argument, and a
  press on Combobox's list or scroller outside an option keeps focus in the
  input. `ctx.use()` returns the composed definition's `actions` and passes
  links on with `links`; a composed part with no part to render on is left
  out, with a warning in development, and a composed bindable its composer
  controls leaves the form reset to the composer.

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

- [#16](https://github.com/tenphi/uniaria/pull/16) [`33d5d06`](https://github.com/tenphi/uniaria/commit/33d5d069271c67f8330beb8db35ca1a35775a813) Thanks [@tenphi](https://github.com/tenphi)! - Items. Button and ToggleButton take `label` and `description` parts, which
  name and describe the button while rendered, and a `frame` around the button
  with `extras` beside it: your buttons, badges and counts, with the button's
  states, and hover over the frame counted as the button's. Popover's and
  Dialog's triggers and Select's take the same parts, and a popup is placed
  against its trigger's frame. Listbox, Select and Combobox take an
  `optionExtras` item part and an `optionTooltip`: one Tooltip for all their
  options, following hover and focus. Tooltip opens only for cut-off text with
  `shouldOpenOnlyWhenTruncated`, takes `relation: 'none'`, and writes the text it
  shows into a `text` part; Select takes a `tooltip` too. `isTruncated()` in
  `@uniaria/core/dom` tells whether an element cuts its text off.

- [#22](https://github.com/tenphi/uniaria/pull/22) [`3eed317`](https://github.com/tenphi/uniaria/commit/3eed31782896bc03de02a29e6f7080ccdf333122) Thanks [@tenphi](https://github.com/tenphi)! - A press focuses a Checkbox, Switch or Radio in every browser: a pointer
  press on the input, or on a `label` that activates it, focuses the input,
  where Safari and Firefox on macOS left focus where it was. Focus from a
  pointer stays not visible, so rings drawn on `data-focus-visible` don't show.
  `createPressFocus` in `@uniaria/core/dom` does the same for a native control
  in your own definition.

### Patch Changes

- [#41](https://github.com/tenphi/uniaria/pull/41) [`45b9d20`](https://github.com/tenphi/uniaria/commit/45b9d20448d0cdb62e7c2af227aa66b57d68cb74) Thanks [@tenphi](https://github.com/tenphi)! - Autocomplete, inline: in Safari, a pointer resting over the list no longer highlights the option under it when the page scrolls, as when a key scrolls the highlighted option into view. Safari sends a resting pointer a move after a scroll; only the pointer's real moves highlight now, as in other browsers.

- [#39](https://github.com/tenphi/uniaria/pull/39) [`d77fb10`](https://github.com/tenphi/uniaria/commit/d77fb10774fa40a29b80c565f3c4b6460929d1e9) Thanks [@tenphi](https://github.com/tenphi)! - Definitions type-check in a project that turns on `exactOptionalPropertyTypes`. A definition without an owner or links (Popover, Dialog, Tooltip, Form) can be passed to `defineElement()`, `useBehavior()` and anything else that takes a definition, with no cast. Types only: nothing changes at runtime.

- [#30](https://github.com/tenphi/uniaria/pull/30) [`f87986d`](https://github.com/tenphi/uniaria/commit/f87986d68f23ed0446849efd97c900eee56cfcaa) Thanks [@tenphi](https://github.com/tenphi)! - Field around a `<select multiple>` now shows the value a form or a
  controlled `value` gives it: a reset, the form's `setValue()` or a new
  `value` selects the matching options. Before, only the user's own
  selection reached the form.

- [#24](https://github.com/tenphi/uniaria/pull/24) [`0233f8e`](https://github.com/tenphi/uniaria/commit/0233f8efc7d00202eef736d499f3066948132a91) Thanks [@tenphi](https://github.com/tenphi)! - Select: a form's validation no longer moves focus through every invalid select. Focus goes to a select's trigger only when the browser reports it as the form's first invalid control, and shows there, and `form.checkValidity()` moves none.

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
