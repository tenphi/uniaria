---
title: Collections
description: Items as data, keys, selection, typeahead and virtualization in Listbox, Select and Combobox.
---

[Listbox](../components/listbox.mdx), [Select](../components/select.mdx) and
[Combobox](../components/combobox.mdx) show a collection of options. They
share one implementation: Select is a listbox in a popover with a trigger,
and Combobox is a listbox in a popover with a text input.

## Items are data

In React, you pass the options as data and render each one yourself:

```tsx
import { listbox } from '@uniaria/core/listbox';
import { useBehavior } from '@uniaria/react';

const fruits = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry', isDisabled: true },
];

function FruitList() {
  const list = useBehavior(listbox, { items: fruits });
  return (
    <div {...list.parts.root}>
      <span {...list.parts.label}>Fruit</span>
      <div {...list.parts.list}>
        {fruits.map((fruit) => (
          <div key={fruit.key} {...list.getItemProps('option', fruit.key)}>
            {fruit.textValue}
          </div>
        ))}
      </div>
    </div>
  );
}
```

`getItemProps(part, key)` gives an option its props. When focus or selection
moves, UniAria rewrites only the options that changed, and the component that
renders the list renders again zero times.

In Vue, the same with `v-for`:

```vue
<script setup lang="ts">
import { listbox } from '@uniaria/core/listbox';
import { useBehavior } from '@uniaria/vue';

const fruits = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry', isDisabled: true },
];

const list = useBehavior(listbox, { items: fruits });
</script>

<template>
  <div v-bind="list.parts.root">
    <span v-bind="list.parts.label">Fruit</span>
    <div v-bind="list.parts.list">
      <div
        v-for="fruit in fruits"
        :key="fruit.key"
        v-bind="list.getItemProps('option', fruit.key)"
      >
        {{ fruit.textValue }}
      </div>
    </div>
  </div>
</template>
```

UniAria compares items by identity, so when they change, pass a new array
rather than changing the one you passed.

Your items can have any shape. Tell UniAria how to read them:

| Prop             | Default                    | Reads                                   |
| ---------------- | -------------------------- | --------------------------------------- |
| `getKey`         | `item.key`                 | A unique string key.                    |
| `getTextValue`   | `item.textValue`           | The text typeahead and filtering match. |
| `isItemDisabled` | `item.isDisabled === true` | Whether the option is disabled.         |
| `getChildren`    | `item.items`               | A group's options. Groups don't nest.   |

`disabledKeys` disables options by key too. A disabled option can't be
focused or selected, and the arrow keys skip it.

### From markup, on custom elements

A custom element reads its items from its markup when you don't set the
`items` property: every `data-element="Option"` with a `data-key`, in order,
and every `data-element="Group"` around them.

```html
<uni-listbox>
  <span data-element="Label">Fruit</span>
  <div data-element="List">
    <div data-element="Option" data-key="apple">Apple</div>
    <div data-element="Option" data-key="banana">Banana</div>
  </div>
</uni-listbox>
```

Add or remove options in the markup and the element follows.

## Keys and selection

Keys are strings, and they also build each option's `id`, so they stay stable
when the list changes order. The selection is `value`, an array of keys in the
order they were selected, with `selectionMode` `'single'` (the default) or
`'multiple'`. Like any [bindable value](./state.md#values-the-user-changes),
pass `defaultValue` or control it with `value` and `onValueChange`.

Keys without an item stay in the value, so a selection survives while items
load.

## Keyboard and typeahead

The arrow keys move focus between options (or a highlight, in a combo box),
Home and End jump to the ends, and Page Up and Page Down move by a page.
Typing a few letters moves to the next option whose text starts with them.
`shouldFocusWrap` makes the arrows wrap around. In multiple mode, Shift with
the arrows or a click selects a range, and Ctrl+A (Cmd+A on Apple platforms)
selects all. Each component page has the full table.

## Virtualization

A list of thousands of options renders only the rows in view when you pass a
`virtualizer`. The engine lives in its own entry, `@uniaria/core/virtual`, so
lists that don't virtualize don't load it.

```tsx
import { virtualizer } from '@uniaria/core/virtual';

function Users({ users }: { users: readonly User[] }) {
  const list = useBehavior(listbox, {
    items: users,
    virtualizer,
    itemSize: 32,
  });
  return (
    <div {...list.parts.root}>
      <span {...list.parts.label}>Users</span>
      <div {...list.parts.scroller}>
        <div {...list.parts.list}>
          <UserRows list={list} />
        </div>
      </div>
    </div>
  );
}

function UserRows({ list }: { list: BehaviorHandle<typeof listbox> }) {
  const keys = useBehaviorState(list, (state) => state.renderedKeys);
  return keys.map((key) => (
    <div key={key} {...list.getItemProps('option', key)}>
      {usersByKey.get(key)!.name}
    </div>
  ));
}
```

You render the keys in `renderedKeys`; UniAria positions each row, measures
rows whose height differs from `itemSize`, and keeps the view steady when a
row above it changes size. Keep the rows in a child component, as above, so
scrolling renders that component and not the one that owns the list. In Vue,
the child reads the keys the same way, as a ref:

```vue
<!-- UserRows.vue -->
<script setup lang="ts">
import type { listbox } from '@uniaria/core/listbox';
import type { BehaviorHandle } from '@uniaria/vue';
import { useBehaviorState } from '@uniaria/vue';

const props = defineProps<{
  list: BehaviorHandle<typeof listbox>;
  names: ReadonlyMap<string, string>;
}>();
const keys = useBehaviorState(props.list, (state) => state.renderedKeys);
</script>

<template>
  <div v-for="key in keys" :key="key" v-bind="list.getItemProps('option', key)">
    {{ names.get(key) }}
  </div>
</template>
```

On a custom element, set `items` and `virtualizer` as properties and render
the rows yourself on each `renderedkeyschange` event. The
[Listbox page](../components/listbox.mdx) covers the details.
