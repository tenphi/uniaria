# @uniaria/core

Framework-agnostic headless UI behavior: the runtime, the interactions and the
component definitions behind UniAria's adapters. Each component's state,
keyboard handling, focus management and ARIA are written here once, in plain
TypeScript, and an adapter binds them to your elements:

- [`@uniaria/react`](https://www.npmjs.com/package/@uniaria/react) for React
  18 and 19;
- [`@uniaria/elements`](https://www.npmjs.com/package/@uniaria/elements) for
  light-DOM custom elements, in plain HTML or any framework.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/core @uniaria/react
```

## Components

Each component's definition comes from its own subpath:

```ts
import { button } from '@uniaria/core/button';
import { useComponent } from '@uniaria/react';

export function SaveButton({ onSave }: { onSave(): void }) {
  const save = useComponent(button, { onPress: onSave });
  return <button {...save.parts.root}>Save</button>;
}
```

Button, ToggleButton, Field, TextField, NumberField, Checkbox, CheckboxGroup,
Switch, Radio, RadioGroup, Dialog, Popover, Tooltip, Listbox, Select and
Combobox, at `@uniaria/core/<name>` in kebab case (`@uniaria/core/text-field`).
`@uniaria/core/dom` has the page-wide settings, `@uniaria/core/collections`
the item model, and `@uniaria/core/virtual` the virtualizer for long lists.

UniAria writes ARIA and state attributes (`data-pressed`, `data-open`) on the
parts, and marks them (`data-uni` on the root, `data-element` on the others),
so your CSS can style every state. It ships no styles;
[`@uniaria/styles`](https://www.npmjs.com/package/@uniaria/styles) has
optional ones.

## Documentation

[Getting started](https://uniaria.tenphi.me/guide/getting-started/) and every component's page
are on [uniaria.tenphi.me](https://uniaria.tenphi.me).

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
