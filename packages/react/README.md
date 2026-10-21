# @uniaria/react

The React adapter for UniAria: one generic hook, `useComponent`, binds any
component definition from [`@uniaria/core`](https://www.npmjs.com/package/@uniaria/core)
to your elements. React 18 or 19.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/core @uniaria/react
```

## Use

Pass a definition and its props to `useComponent`, then spread each part's
props onto your element:

```tsx
import { toggleSwitch } from '@uniaria/core/switch';
import { useComponent } from '@uniaria/react';

export function WifiSwitch() {
  const wifi = useComponent(toggleSwitch, {
    defaultSelected: true,
    labelElementType: 'span',
  });
  return (
    <label {...wifi.parts.root}>
      <input {...wifi.parts.input} name="wifi" />
      <span {...wifi.parts.indicator} />
      <span {...wifi.parts.label}>Wi-Fi</span>
    </label>
  );
}
```

Hovering, pressing or toggling doesn't render your component again: UniAria
writes the new state straight to the elements. When your render needs a
value, select it with `useComponentState`.

## Documentation

[Getting started](https://github.com/tenphi/uniaria/blob/main/docs/guide/getting-started.mdx)
and every component's page are in the repository's
[`docs`](https://github.com/tenphi/uniaria/tree/main/docs) folder.

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
