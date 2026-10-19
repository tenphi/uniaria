---
title: Custom components
description: Write your own component definition and use it in every adapter.
---

Every UniAria component is a _definition_: a plain object that names the
component's parts, declares its props and events, and turns state into
attributes. The adapters are generic over definitions, so a definition you
write works in React and as a custom element, renders on the server, and
never re-renders React for its internal state, exactly like the built-in
components.

This guide builds a disclosure (a button that shows and hides a panel, the
WAI-ARIA [Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)),
uses it from both adapters and tests it. The reference for everything used
here is in [Runtime](../api/core.md) and [DOM layer](../api/dom.md).

## Plan the component

Start from the pattern and decide four things:

- **Parts**: the elements the consumer renders. Here a `trigger` (a
  `<button>`) and a `panel`.
- **Props**: what the consumer passes. Whether the panel is expanded is
  state the user changes, so it is a _bindable_, `isExpanded`: controlled when
  the consumer passes it, uncontrolled otherwise. `isDisabled` is a plain
  prop.
- **Events**: what the component reports. A bindable reports its own
  changes (`expandedChange`), so this one needs no other.
- **Public state**: what consumers can read and style by: `isExpanded`,
  `isDisabled` and `isPressed`.

## Write the definition

```ts
// disclosure.ts
import { bindable, defineComponent, prop } from '@uniaria/core';
import { createPress } from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';

const flag = (isOn: boolean) => (isOn ? '' : undefined);

export const disclosure = defineComponent({
  name: 'disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isExpanded: bindable(false),
    isDisabled: prop(false),
  },
  setup(ctx) {
    const { isExpanded, isDisabled } = ctx.props;
    const press = createPress(ctx, {
      part: 'trigger',
      isDisabled,
      onPress: () => isExpanded.set(!isExpanded.get()),
    });
    return { isPressed: press.isPressed, handlers: press.handlers };
  },
  expose: ({ props, api }) => ({
    isExpanded: props.isExpanded.get(),
    isDisabled: props.isDisabled(),
    isPressed: api.isPressed(),
  }),
  connect({ props, ids, api }) {
    const isExpanded = props.isExpanded.get();
    const isDisabled = props.isDisabled();
    const state = isExpanded ? 'open' : 'closed';
    const trigger: DomPartProps = {
      attrs: {
        // Safari focuses a clicked button only when it has a tabindex.
        tabindex: '0',
        'aria-expanded': String(isExpanded),
        'aria-controls': ids.panel,
        'aria-disabled': isDisabled ? 'true' : undefined,
        'data-state': state,
        'data-pressed': flag(api.isPressed()),
        'data-disabled': flag(isDisabled),
      },
      on: api.handlers,
    };
    const panel: DomPartProps = {
      attrs: { id: ids.panel, hidden: flag(!isExpanded), 'data-state': state },
    };
    return { trigger, panel };
  },
});
```

What each piece does:

- **`name`** is kebab case. It becomes the element name, `<uni-disclosure>`
  by default, and marks the parts: each gets `data-scope="disclosure"` and its
  name capitalized as `data-element` (`Trigger`, `Panel`). A part named
  `root`, which this component doesn't have, gets the class `uni-disclosure`
  instead.
- **`props`** is the one schema both adapters read. From
  `isExpanded: bindable(false)` the consumer gets `isExpanded`,
  `defaultExpanded` and `onExpandedChange` in React, and the
  `default-expanded` attribute, the `isExpanded` property and the
  `expandedchange` event on the element. `isDisabled` becomes the `disabled`
  attribute. See [naming conventions](../api/core.md#naming-conventions).
- **`setup(ctx)`** runs once per instance, on the server too, so it must not
  touch the DOM. It reads props through `ctx.props` (a bindable has `get()`
  and `set()`), and wires `createPress`, which gives one `press` for mouse,
  touch, keyboard (Enter and Space) and screen-reader activation. It returns
  what `expose()` and `connect()` need. That return value is internal to the
  definition: consumers call only the members it lists as
  [actions](../api/core.md#actions), and this one lists none.
- **`isExpanded.set()`** commits the change and calls `onExpandedChange`
  while uncontrolled. While controlled it only calls `onExpandedChange`, and
  the panel changes when the consumer passes the new value.
- **`expose()`** is the public state. Keep it small: it is API.
- **`connect()`** returns attributes and handlers for every part, from current
  state. It runs again after every change and UniAria writes only the
  attributes that differ, so keep it cheap and pure. ARIA values are strings
  (`'true'`, `'false'`), a boolean attribute that is on is `''`, and
  `undefined` removes an attribute. `ids` gives a stable id per part;
  `DomPartProps` types the handlers with DOM events.

A few rules keep a definition working in both adapters:

- Never read a prop once and keep it: call the reader where you need the
  value.
- Anything that needs a part's element goes through
  [`partEffect`](../api/dom.md#parts-and-effects) or an interaction from
  `@uniaria/core/dom`, since a custom element's parts can arrive after it
  connects.
- Combine several interactions on one part with `mergeHandlers`; never call
  `stopPropagation`.
- Write only the attributes the component owns. Content, classes, `type` and
  everything else stay the consumer's.

## Use it in React

```tsx
import { useComponent, useComponentState } from '@uniaria/react';

import { disclosure } from './disclosure';

export function Shipping() {
  const ui = useComponent(disclosure, { defaultExpanded: true });
  const isExpanded = useComponentState(ui, (state) => state.isExpanded);
  return (
    <section>
      <button {...ui.parts.trigger} type="button" className="disclosure">
        {isExpanded ? 'Hide shipping' : 'Show shipping'}
      </button>
      <div {...ui.parts.panel}>Ships in two business days.</div>
    </section>
  );
}
```

Pressing the button changes the panel's `hidden`, `aria-expanded` and
`data-state` without rendering `Shipping` again. It renders again here only
because the label reads `isExpanded` through `useComponentState`; drop that
line and the component renders once. See [React](../api/react.md).

## Register it as an element

```ts
// elements.ts
import { defineElement } from '@uniaria/elements';
import type { UniElement } from '@uniaria/elements';

import { disclosure } from './disclosure';

export const AcmeDisclosure = defineElement(disclosure, { prefix: 'acme' });

declare global {
  interface HTMLElementTagNameMap {
    'acme-disclosure': UniElement<typeof disclosure>;
  }
}
```

Import `elements.ts` once on the page. `defineElement` names the element
`<prefix>-<name>`, returns the existing class if the name is taken, and
returns `undefined` on a server, so the module is safe to import anywhere.

```html
<acme-disclosure>
  <h3>
    <button data-element="Trigger" type="button">Shipping</button>
  </h3>
  <div data-element="Panel" hidden>Ships in two business days.</div>
</acme-disclosure>

<script type="module">
  import './elements.js';

  const shipping = document.querySelector('acme-disclosure');
  shipping.addEventListener('expandedchange', (event) => {
    console.log('expanded:', event.detail);
  });
</script>
```

The element finds its parts by `data-element`, and a root part by its
`uni-<name>` class, at any depth, and writes the same attributes React does.
The `hidden` in the markup keeps the panel shut before the script runs;
UniAria removes it when the panel opens. Add `default-expanded` to start open,
or set the `isExpanded` property to control it. See
[Custom elements](../api/elements.md).

## Test it

The definition runs in Node without a framework or a DOM. Create an instance,
pass props as React would, and check the part props and the public state:

```ts
// disclosure.test.ts
import { createInstance } from '@uniaria/core';
import { describe, expect, it } from 'vitest';

import { disclosure } from './disclosure';

describe('disclosure', () => {
  it('starts collapsed, with the trigger pointing at the panel', () => {
    const instance = createInstance(disclosure, { id: 'shipping' });
    const { trigger, panel } = instance.connect();
    expect(trigger.attrs['aria-expanded']).toBe('false');
    expect(trigger.attrs['aria-controls']).toBe('shipping-panel');
    expect(panel.attrs.id).toBe('shipping-panel');
    expect(panel.attrs.hidden).toBe('');
  });

  it('starts expanded from defaultExpanded', () => {
    const instance = createInstance(disclosure, {
      props: { defaultExpanded: true },
    });
    expect(instance.getState().isExpanded).toBe(true);
    expect(instance.connect().panel.attrs.hidden).toBeUndefined();
  });

  it('follows a controlled value', () => {
    const instance = createInstance(disclosure, {
      props: { isExpanded: false },
    });
    instance.setProps({ isExpanded: true });
    instance.sync();
    expect(instance.connect().trigger.attrs['aria-expanded']).toBe('true');
  });
});
```

`createPress` needs real elements and real input, so test presses in a
browser. With Vitest's browser mode and the commands from
`@uniaria/testing/commands` registered (see [Testing](../api/testing.md#running-suites)),
`pointer` and `keyboard` send real input through Playwright:

```ts
// disclosure.browser.test.ts
import { keyboard, pointer, releaseInput } from '@uniaria/testing/browser';
import { afterEach, expect, it } from 'vitest';

import './elements';

afterEach(releaseInput);

it('toggles with the mouse and the keyboard', async () => {
  document.body.innerHTML = `
    <acme-disclosure>
      <button data-element="Trigger" type="button">Shipping</button>
      <div data-element="Panel">Ships in two business days.</div>
    </acme-disclosure>`;
  const host = document.querySelector('acme-disclosure')!;
  const trigger = host.querySelector('button')!;
  const panel = host.querySelector<HTMLElement>('[data-element="Panel"]')!;
  const changes: boolean[] = [];
  host.addEventListener('expandedchange', (event) => {
    changes.push((event as CustomEvent<boolean>).detail);
  });

  await pointer.click(trigger);
  expect(panel.hidden).toBe(false);
  await keyboard.press('Enter');
  expect(panel.hidden).toBe(true);
  expect(changes).toEqual([true, false]);
});
```

To check that both adapters behave the same, write a conformance suite with
`defineConformance` and run it against each; see [Testing](../api/testing.md).

## Going further

- **Events.** Declare one with `event<Detail>()` under `events` and report it
  from `setup()` with `ctx.emit(name, detail)`. React receives it as
  `on<Name>`, the element dispatches the lowercase DOM event. See
  [event](../api/core.md#event).
- **Actions.** To let consumers expand the panel from elsewhere, return an
  `expand` function from `setup()` and list it: `actions: ['expand']`. React
  calls `ui.actions.expand()`, and the element gets an `expand()` method. See
  [Actions](../api/core.md#actions).
- **Hover and focus.** `createHover` and `createFocus` add `isHovered`,
  `isFocused` and `isFocusVisible`; merge their handlers with the press's.
  See [Interactions](../api/dom.md#interactions).
- **Reusing a component.** `ctx.use(button, props)` runs Button inside your
  definition, on its parts, as ToggleButton does. See
  [Composition](../api/core.md#composition).
- **Working inside another instance.** An `owner` (a checkbox in its group)
  or a link (a tooltip) connects separate instances. See
  [Owners and links](../api/core.md#owners-and-links).
- **Overlays and lists.** Focus scopes, the layer stack, presence and
  positioning are in the [DOM layer](../api/dom.md); collections, typeahead
  and virtualization in [Collections](../api/collections.md).
- **Development warnings.** Report misuse with `warn()` from
  `@uniaria/core/dom`, which logs only in development.
