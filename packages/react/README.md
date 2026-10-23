# @uniaria/react

The React adapter for UniAria: one generic hook, `useBehavior`, binds any
behavior definition from [`@uniaria/core`](https://www.npmjs.com/package/@uniaria/core)
to your elements. React 18 or 19.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/core @uniaria/react
```

## Use

Pass a definition and its props to `useBehavior`, then spread each part's
props onto your element:

```tsx
import { toggleSwitch } from '@uniaria/core/switch';
import { useBehavior } from '@uniaria/react';

export function WifiSwitch() {
  const wifi = useBehavior(toggleSwitch, {
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
value, select it with `useBehaviorState`.

## Documentation

[Getting started](https://uniaria.tenphi.me/guide/getting-started/), the
[React API](https://uniaria.tenphi.me/api/react/) and every component's page are on
[uniaria.tenphi.me](https://uniaria.tenphi.me).

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
