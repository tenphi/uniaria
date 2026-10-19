---
title: Packages
description: The UniAria packages and their entry points.
---

UniAria is four packages. `@uniaria/core` holds every component's behavior;
the two adapters bind it to React and to custom elements; `@uniaria/testing`
checks an adapter or a component against real input and screen readers.

| Package             | What it is                                                                       | Install it when                                                      |
| ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `@uniaria/core`     | The runtime, the DOM layer, collections and one definition per component         | Always: the adapters depend on it                                    |
| `@uniaria/react`    | `useComponent`, `useComponentState` and `OwnerProvider`                          | You render with React                                                |
| `@uniaria/elements` | `defineElement` and one registering entry per component                          | You render HTML: plain pages, server templates, Vue, Svelte, Angular |
| `@uniaria/testing`  | The conformance runner, the mount contract, real input and screen-reader helpers | You write an adapter or test your own components                     |

## Entry points

Each package exposes only the entries below (its `package.json` `exports`).
Import from these paths, never from files inside a package.

| Entry                           | Exports                                                                                                                                                                  | Reference                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `@uniaria/core`                 | `defineComponent`, `prop`, `bindable`, `event`, `createInstance` and the runtime types                                                                                   | [Runtime](./core.md)                                 |
| `@uniaria/core/dom`             | `configure` for page-wide settings; interactions, focus, layers, positioning and the announcer for definition authors; the binder and part discovery for adapter authors | [DOM layer](./dom.md)                                |
| `@uniaria/core/collections`     | `createListCollection`, `createTypeahead`, `findByText`                                                                                                                  | [Collections](./collections.md)                      |
| `@uniaria/core/virtual`         | `virtualizer`, the engine a virtualized Listbox, Select or Combobox takes                                                                                                | [Collections](./collections.md#virtualization)       |
| `@uniaria/core/<component>`     | One definition, plus its `<Name>Props` and `<Name>State` types (table below)                                                                                             | The component's page                                 |
| `@uniaria/react`                | `useComponent`, `useComponentState`, `OwnerProvider`                                                                                                                     | [React](./react.md)                                  |
| `@uniaria/elements`             | `defineElement` and the element types                                                                                                                                    | [Custom elements](./elements.md)                     |
| `@uniaria/elements/<component>` | Registers `<uni-<component>>` on import, and exports its class and element type                                                                                          | [Custom elements](./elements.md#registering-entries) |
| `@uniaria/testing`              | `defineConformance`, the templates (`h`, `nested`, `rows`) and the mount contract types                                                                                  | [Testing](./testing.md)                              |
| `@uniaria/testing/browser`      | `runConformance`, real input and spoken output, for Vitest browser mode                                                                                                  | [Testing](./testing.md#running-suites)               |
| `@uniaria/testing/commands`     | `uniCommands` and `screenReaderCommands`, the Playwright commands for your Vitest config                                                                                 | [Testing](./testing.md#running-suites)               |

### Components

Every component has a subpath of `@uniaria/core` that exports its definition,
and a registering entry of the same name in `@uniaria/elements`.

| Subpath          | Definition      | Element                | Page                                              |
| ---------------- | --------------- | ---------------------- | ------------------------------------------------- |
| `button`         | `button`        | `<uni-button>`         | [Button](../components/button.mdx)                |
| `toggle-button`  | `toggleButton`  | `<uni-toggle-button>`  | [ToggleButton](../components/toggle-button.mdx)   |
| `field`          | `field`         | `<uni-field>`          | [Field](../components/field.mdx)                  |
| `text-field`     | `textField`     | `<uni-text-field>`     | [TextField](../components/text-field.mdx)         |
| `number-field`   | `numberField`   | `<uni-number-field>`   | [NumberField](../components/number-field.mdx)     |
| `checkbox`       | `checkbox`      | `<uni-checkbox>`       | [Checkbox](../components/checkbox.mdx)            |
| `checkbox-group` | `checkboxGroup` | `<uni-checkbox-group>` | [CheckboxGroup](../components/checkbox-group.mdx) |
| `switch`         | `toggleSwitch`  | `<uni-switch>`         | [Switch](../components/switch.mdx)                |
| `radio-group`    | `radioGroup`    | `<uni-radio-group>`    | [RadioGroup](../components/radio-group.mdx)       |
| `radio`          | `radio`         | `<uni-radio>`          | [RadioGroup](../components/radio-group.mdx)       |
| `dialog`         | `dialog`        | `<uni-dialog>`         | [Dialog](../components/dialog.mdx)                |
| `popover`        | `popover`       | `<uni-popover>`        | [Popover](../components/popover.mdx)              |
| `tooltip`        | `tooltip`       | `<uni-tooltip>`        | [Tooltip](../components/tooltip.mdx)              |
| `listbox`        | `listbox`       | `<uni-listbox>`        | [Listbox](../components/listbox.mdx)              |
| `select`         | `select`        | `<uni-select>`         | [Select](../components/select.mdx)                |
| `combobox`       | `combobox`      | `<uni-combobox>`       | [Combobox](../components/combobox.mdx)            |

Switch's definition is `toggleSwitch` because `switch` is a reserved word.
`@uniaria/core/tooltip` also exports `tooltipLink`, the key other components
take a tooltip through (see [links](./core.md#owners-and-links)).

```ts
import { checkbox } from '@uniaria/core/checkbox';
import type { CheckboxProps, CheckboxState } from '@uniaria/core/checkbox';
```

## Dependencies

| Package             | Dependencies                                       | Peer dependencies                                                                      |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@uniaria/core`     | `@internationalized/number` (NumberField)          | None                                                                                   |
| `@uniaria/react`    | `@uniaria/core`                                    | `react` `^18.0.0 \|\| ^19.0.0`                                                         |
| `@uniaria/elements` | `@uniaria/core`                                    | None                                                                                   |
| `@uniaria/testing`  | `@uniaria/core`, `@guidepup/virtual-screen-reader` | `vitest` `^5.0.0`; `@guidepup/guidepup` `^0.35.0`, optional (real screen readers only) |

`@uniaria/core/virtual` bundles one pinned version of
`@tanstack/virtual-core`, so there is nothing extra to install, and only code
that imports `@uniaria/core/virtual` loads it. `@uniaria/elements` needs no
framework. `@uniaria/react` needs `react` only; it doesn't import
`react-dom`.

## Format and versions

- **ES modules only.** Every entry is ESM compiled to ES2022, with `.d.ts`
  types and source maps. There is no CommonJS build. The packages require
  Node 22 or later wherever Node loads them.
- **Tree-shakable.** `@uniaria/core`, `@uniaria/react` and `@uniaria/testing`
  have no side effects. In `@uniaria/elements` only the registering entries
  do (they define an element), and they are listed in its `sideEffects`.
- **One version.** The four packages are released together under one version
  number. Install the same version of each.
- **Several copies on one page.** Page-wide state (the layer stack, focus
  scopes, the input-modality tracker, the live announcer, scroll lock and the
  [settings](./dom.md#settings)) is stored under `Symbol.for('@uniaria/…')`
  keys, so two copies of UniAria on one page share it instead of fighting.

UniAria is pre-alpha: nothing is on npm yet, and every package is at
`0.0.0`.

## Server rendering

Every entry imports in Node without a DOM: nothing touches `document` or
`window` when a module loads, and each entry has a test that imports it
without one.

- `@uniaria/react` renders complete HTML on the server: attributes, ids,
  ARIA state and the starting values of form controls. Effects never run
  there. See [React](./react.md#server-rendering) and
  [Server rendering](../guide/server-rendering.md).
- `@uniaria/elements` defines nothing on the server: `defineElement` returns
  `undefined` where there is no `customElements`, and so does each registering
  entry's class export. The markup you render on the server is the markup the
  element upgrades in the browser.
- `@uniaria/testing` is safe to import anywhere. `@uniaria/testing/browser`
  runs only in Vitest's browser mode and `@uniaria/testing/commands` only in
  Node, inside your Vitest config.
