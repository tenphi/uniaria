---
title: Collections
description: '@uniaria/core/collections and @uniaria/core/virtual.'
---

Lists in UniAria are data: an array of items plus functions that read each
item's key, text and disabled state. Listbox, Select and Combobox build on
the two entries on this page, and so can your own definitions.

- [`@uniaria/core/collections`](#list-collections) turns items into a list
  with the lookups keyboard navigation and selection need, and implements
  [typeahead](#typeahead). It has no DOM code, so it runs anywhere.
- [`@uniaria/core/virtual`](#virtualization) is the engine a virtualized list
  takes. Only lists that virtualize import it.

For using collections in components (items, keys, sections, disabled keys),
see [Collections](../guide/collections.md) and
[Listbox](../components/listbox.mdx).

## List collections

```ts
createListCollection<Item>(
  items: readonly Item[],
  accessors: ListAccessors<Item>,
  disabledKeys?: Iterable<string>,
): ListCollection<Item>
```

Flattens items once into options in display order. An item with children is a
section: its children are options, and a section is never an option itself.
Sections don't nest. Keys map to indexes, so moving from a key costs only the
disabled options it skips, never a search.

```ts
import { createListCollection } from '@uniaria/core/collections';

interface Fruit {
  id: string;
  name: string;
  isSoldOut?: boolean;
  children?: Fruit[];
}

const fruit = createListCollection<Fruit>(
  [
    { id: 'apple', name: 'Apple' },
    {
      id: 'citrus',
      name: 'Citrus',
      children: [
        { id: 'lemon', name: 'Lemon', isSoldOut: true },
        { id: 'lime', name: 'Lime' },
      ],
    },
  ],
  {
    getKey: (item) => item.id,
    getTextValue: (item) => item.name,
    isDisabled: (item) => item.isSoldOut === true,
    getChildren: (item) => item.children,
  },
);

fruit.keys; // ['apple', 'lemon', 'lime']
fruit.next('apple'); // 'lime': lemon is disabled
fruit.get('lime')?.section; // 'citrus'
```

### Accessors

| Accessor             | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| `getKey(item)`       | The item's key, a string unique in the collection.                                  |
| `getTextValue(item)` | Its plain text: typeahead matches it, and Select and Combobox show it as the value. |
| `isDisabled(item)`   | Whether the option can't be focused or selected.                                    |
| `getChildren(item)`  | A section's items, or `undefined` for an option.                                    |

`disabledKeys` disables options by key on top of `isDisabled`. A key that
appears twice keeps its first item; the rest are dropped and listed in
`duplicates`.

### ListCollection

| Member                       | Description                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `options`                    | Every option in display order, sections flattened: `{ key, textValue, isDisabled, item, index, section }`.                      |
| `sections`                   | Every section: `{ key, item, keys }`, `keys` being its options' keys in order.                                                  |
| `keys`                       | Every option key in display order.                                                                                              |
| `duplicates`                 | Keys that appeared more than once.                                                                                              |
| `get(key)`, `section(key)`   | An option or a section by key, or `undefined`.                                                                                  |
| `isEnabled(key)`             | The option exists and isn't disabled.                                                                                           |
| `first()`, `last()`          | The first or last enabled option, or `null`.                                                                                    |
| `next(key, isWrapping?)`     | The enabled option after `key`: `null` past the last, or the first with `isWrapping`. From `null` or an unknown key, the first. |
| `previous(key, isWrapping?)` | The enabled option before `key`, the same way.                                                                                  |
| `range(a, b)`                | The enabled options from `a` to `b`, both included, in display order, for Shift-selection.                                      |
| `enabledKeys()`              | Every enabled option, in display order.                                                                                         |

## Typeahead

Typing moves focus to the first item whose text starts with what was typed,
as in a native `<select>`.

```ts
createTypeahead(): Typeahead
findByText<Key>(query: string, options: FindByTextOptions<Key>): Key | null
```

`createTypeahead()` keeps the query. `handleKey(input, search)` adds a
printable key to it and asks `search` for the key to focus; it returns
`{ isHandled, key }`, where `isHandled` means the key joined the query and
the caller should call `preventDefault()`. It never moves focus or changes
selection itself.

```ts
import { createTypeahead, findByText } from '@uniaria/core/collections';

const typeahead = createTypeahead();

/** The key to focus for a keydown, or `null`. */
function keyForTyping(event: KeyboardEvent, focusedKey: string | null) {
  const { isHandled, key } = typeahead.handleKey(event, (query) =>
    findByText(query, {
      keys: fruit.keys,
      getTextValue: (key) => fruit.get(key)!.textValue,
      isDisabled: (key) => !fruit.isEnabled(key),
      fromKey: focusedKey,
    }),
  );
  if (isHandled) event.preventDefault();
  return key;
}
```

- **The query** lasts until a second passes without a keystroke, matched or
  not, measured with the events' own `timeStamp`, so there are no timers.
  A miss keeps the query, so a typo leaves focus where it is.
- **Space** joins the query only while one is in progress, so "New York"
  can be typed; otherwise it keeps its meaning (selection).
  `isSearching(timeStamp)` tells a handler that sees Space first whether to
  leave it to typeahead. `reset()` forgets the query.
- **Shortcuts** don't type: a key with Ctrl, Meta or Alt isn't handled.
- `handleKey` reads only `key`, `ctrlKey`, `metaKey`, `altKey` and
  `timeStamp`, so a DOM `KeyboardEvent` fits as is.

`findByText(query, options)` returns the first key whose text starts with the
query, from `fromKey` (inclusive) to the end, then from the top. Starting at
the focused item keeps focus there while its text still matches, so typing
the same letter twice extends the query instead of jumping.

| Option              | Description                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys`              | Every key, in display order.                                                                                                                                                                         |
| `getTextValue(key)` | A key's text. Items without text never match.                                                                                                                                                        |
| `isDisabled?(key)`  | Keys typeahead never lands on.                                                                                                                                                                       |
| `fromKey?`          | Where the search starts: the focused key.                                                                                                                                                            |
| `collator?`         | Compares the start of each text with the query. Defaults to `Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' })`, case- and accent-insensitive; pass one for the component's locale. |

## Virtualization

A virtualized list renders only the options in and near its scrolled view:
a few dozen elements stand in for thousands of items. Listbox, Select and
Combobox virtualize when you pass an engine as their `virtualizer` prop:

```ts
import { virtualizer } from '@uniaria/core/virtual';
```

`virtualizer` wraps [TanStack Virtual](https://tanstack.com/virtual)'s
`@tanstack/virtual-core`, bundled into this entry at one pinned version, so
there is nothing else to install and a list that doesn't virtualize never
loads it. Nothing about the list changes for the user: keys, selection,
typeahead, focus and what screen readers say stay the same, and moving to an
option that isn't rendered renders it, scrolls it into view and focuses it.

### How a Listbox uses it

With a `virtualizer`, the list keeps a rendered set: the options in the view,
`overscan` more beyond each edge, and a few it pins, such as the focused
option. You render only that set, inside a `scroller` part, and UniAria
positions each row.

| Listbox API                              | Description                                                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `virtualizer` prop                       | The engine. Property only on the element.                                                                                                                                                    |
| `itemSize` prop                          | A row's size in pixels along the list's axis, or a function of the key. Exact unless `shouldMeasureItems`; unset, rows are measured and estimated at 32. Attribute `item-size` for a number. |
| `shouldMeasureItems` prop                | `itemSize` is an estimate and each rendered row is measured. Attribute `measure-items`.                                                                                                      |
| `overscan` prop                          | Options rendered beyond each edge of the view. Default `10`.                                                                                                                                 |
| `initialItemCount` prop                  | Options rendered before the scroller has a size (on the server, in a closed popover). Default `20`.                                                                                          |
| `scroller` part                          | The element that scrolls, around the list. Give it a height (or a max height) and `overflow: auto`.                                                                                          |
| `renderedKeys`, `renderedSections` state | The options and the sections to render, in list order. Each array is new only when its contents change.                                                                                      |
| `renderedKeysChange` event               | The rendered set changed: `{ keys, sections }`. `renderedkeyschange` on the element.                                                                                                         |

While virtualized, UniAria writes `position: relative` and the total size on
the list, `position: absolute` with a `translate` on each row (so your own
`transform` still composes), `overflow-anchor: none` on the scroller, and
`aria-posinset` and `aria-setsize` on each option, since not every option is
in the DOM. The root, scroller and list get `data-virtualized`, and the
scroller `tabindex="-1"`, so a box that scrolls isn't a tab stop of its own. Width is
yours: give options `inset-inline-end: 0` or `inline-size: 100%`, and put
gaps inside the row size, since absolutely positioned rows ignore margins.

In React, read `renderedKeys` in a child component, so a change of the
rendered set renders only the rows:

```tsx
import { listbox } from '@uniaria/core/listbox';
import { virtualizer } from '@uniaria/core/virtual';
import type { ComponentHandle } from '@uniaria/react';
import { useComponent, useComponentState } from '@uniaria/react';

const zones = Intl.supportedValuesOf('timeZone').map((zone) => ({
  key: zone,
  textValue: zone,
}));

export function TimeZones() {
  const ui = useComponent(listbox, { items: zones, virtualizer, itemSize: 32 });
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Time zone</span>
      <div {...ui.parts.scroller} className="scroller">
        <div {...ui.parts.list}>
          <Rows ui={ui} />
        </div>
      </div>
    </div>
  );
}

function Rows({ ui }: { ui: ComponentHandle<typeof listbox> }) {
  const keys = useComponentState(ui, (state) => state.renderedKeys);
  return keys.map((key) => (
    <div key={key} {...ui.getItemProps('option', key)}>
      {key}
    </div>
  ));
}
```

```css
.scroller {
  block-size: 240px;
  overflow: auto;
}

.scroller [data-element='Option'] {
  inset-inline-end: 0;
  block-size: 32px;
}
```

A custom element takes `items` as a property, since the markup can't hold
items that aren't rendered. Render the rows from `renderedKeys`, and again on
each `renderedkeyschange`, synchronously. Keep the element of a row that
stays: removing the focused option's element would drop focus.

```html
<uni-listbox id="zones" item-size="32">
  <span data-element="Label">Time zone</span>
  <div data-element="Scroller" class="scroller">
    <div data-element="List"></div>
  </div>
</uni-listbox>

<script type="module">
  import '@uniaria/elements/listbox';
  import { virtualizer } from '@uniaria/core/virtual';

  const host = document.querySelector('#zones');
  const list = host.querySelector('[data-element="List"]');

  function render(keys) {
    const wanted = new Set(keys);
    for (const row of [...list.children]) {
      if (!wanted.has(row.dataset.key)) row.remove();
    }
    let next = list.firstElementChild;
    for (const key of keys) {
      if (next?.dataset.key === key) {
        next = next.nextElementSibling;
        continue;
      }
      const row = document.createElement('div');
      row.dataset.element = 'Option';
      row.dataset.key = key;
      row.textContent = key;
      list.insertBefore(row, next);
    }
  }

  host.addEventListener('renderedkeyschange', (event) => {
    if (event.target === host) render(event.detail.keys);
  });
  host.virtualizer = virtualizer;
  host.items = Intl.supportedValuesOf('timeZone').map((zone) => ({
    key: zone,
    textValue: zone,
  }));
  render(host.instance.getState().renderedKeys);
</script>
```

In development, UniAria warns once when the `scroller` part is missing, when
a pinned option in `renderedKeys` has no element, and, with an exact
`itemSize`, when a row's measured size differs from it.

### The Virtualizer interface

The `virtualizer` prop takes any object with this shape, so another engine
can stand in for TanStack Virtual. The types come from
`@uniaria/core/virtual` (and `@uniaria/core/dom`).

```ts
interface Virtualizer {
  create(options: VirtualRowsOptions): VirtualRows;
}
```

| `VirtualRowsOptions`    | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `scroller`              | The element that scrolls.                                              |
| `count`                 | How many rows. A row is an option or a section's label row.            |
| `keyOf(index)`          | A row's key: measured sizes stay with it when the rows change.         |
| `sizeOf(index)`         | A row's size along the axis: exact, or an estimate until measured.     |
| `isHorizontal`, `isRtl` | The list's axis and direction.                                         |
| `overscan`              | Rows kept beyond each edge of the view.                                |
| `onChange()`            | Call it when the rows in view, the view's size or a row's size change. |

| `VirtualRows`                            | Description                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `update(options)`                        | New rows, sizes or overscan.                                                                                                        |
| `viewSize()`                             | The view's length along the axis; `0` until the scroller has a size.                                                                |
| `range()`                                | The first and last row in view with the overscan, both included, or `null` while the view has no size.                              |
| `start(index)`, `size(index)`, `total()` | Where a row starts, its size, and the list's length.                                                                                |
| `resize(index, size)`                    | A row's measured size. A row above the view keeps the first visible row in place.                                                   |
| `scrollTo(index)`                        | Scrolls a row into view, to the nearest edge, inside the scroller's `scroll-padding`; once the view has a size, if it has none yet. |
| `destroy()`                              | Stops observing the scroller.                                                                                                       |
