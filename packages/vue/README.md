# @uniaria/vue

The Vue adapter for UniAria: one generic composable, `useBehavior`, binds any
behavior definition from [`@uniaria/core`](https://www.npmjs.com/package/@uniaria/core)
to your elements. Vue 3.5 or later.

> **Pre-release.** The API can change in any 0.x version.

## Install

```sh
pnpm add @uniaria/core @uniaria/vue
```

## Use

Pass a definition and its props to `useBehavior`, then bind each part's
props onto your element with `v-bind`:

```vue
<script setup lang="ts">
import { toggleSwitch } from '@uniaria/core/switch';
import { useBehavior } from '@uniaria/vue';

const wifi = useBehavior(toggleSwitch, {
  defaultSelected: true,
  labelElementType: 'span',
});
</script>

<template>
  <label v-bind="wifi.parts.root">
    <input v-bind="wifi.parts.input" name="wifi" />
    <span v-bind="wifi.parts.indicator" />
    <span v-bind="wifi.parts.label">Wi-Fi</span>
  </label>
</template>
```

Hovering, pressing or toggling doesn't render your component again: UniAria
writes the new state straight to the elements. When your render needs a
value, select it with `useBehaviorState`.

## Documentation

[Getting started](https://uniaria.tenphi.me/guide/getting-started/), the
[Vue API](https://uniaria.tenphi.me/api/vue/) and every component's page are on
[uniaria.tenphi.me](https://uniaria.tenphi.me).

## License

[MIT](https://github.com/tenphi/uniaria/blob/main/LICENSE)
