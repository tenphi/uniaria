---
title: Custom components
description: Write your own behavior definition and use it in every adapter.
---

Every UniAria component's behavior is a _definition_: a plain object, made
with `defineBehavior`, that names the component's parts, declares its props and events, and turns state into
attributes. The adapters are generic over definitions, so a definition you
write works in React, in Vue and as a custom element, renders on the server,
and never re-renders a framework component for its internal state, exactly
like the built-in components.

This guide builds a disclosure (a button that shows and hides a panel, the
WAI-ARIA [Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)),
uses it from every adapter and tests it. The reference for everything used
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
import { bindable, defineBehavior, prop } from '@uniaria/core';
import { createPress } from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';

const flag = (isOn: boolean) => (isOn ? '' : undefined);

export const disclosure = defineBehavior({
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
  by default. Each part gets its name capitalized as `data-element`
  (`Trigger`, `Panel`); a part named `root`, which this component doesn't
  have, gets `data-uni="disclosure"` instead. A part listed in
  `outsideParts`, rendered outside the root as an overlay's trigger is, gets
  `data-uni-part="disclosure-<part>"`. Without a root, as here, nothing ties
  the parts to the component in CSS: give it a root to style it through
  UniAria's markers.
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
  `undefined` removes an attribute. `ids` gives each part's id: the one its
  element carries, else a stable generated one, so read it in `connect()`;
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
import { useBehavior, useBehaviorState } from '@uniaria/react';

import { disclosure } from './disclosure';

export function Shipping() {
  const ui = useBehavior(disclosure, { defaultExpanded: true });
  const isExpanded = useBehaviorState(ui, (state) => state.isExpanded);
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
because the label reads `isExpanded` through `useBehaviorState`; drop that
line and the component renders once. See [React](../api/react.md).

## Use it in Vue

```vue
<script setup lang="ts">
import { useBehavior, useBehaviorState } from '@uniaria/vue';

import { disclosure } from './disclosure';

const ui = useBehavior(disclosure, { defaultExpanded: true });
const isExpanded = useBehaviorState(ui, (state) => state.isExpanded);
</script>

<template>
  <section>
    <button v-bind="ui.parts.trigger" type="button" class="disclosure">
      {{ isExpanded ? 'Hide shipping' : 'Show shipping' }}
    </button>
    <div v-bind="ui.parts.panel">Ships in two business days.</div>
  </section>
</template>
```

The same definition, with nothing Vue-specific in it. The template renders
again only for the label, which reads `isExpanded`. See [Vue](../api/vue.md).

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

The element finds its parts by `data-element`, a root part by `data-uni`
and a part outside the root by `data-uni-part`, at any depth, and writes the
same attributes React and Vue do.
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

To check that every adapter behaves the same, write a conformance suite with
`defineConformance` and run it against each; see [Testing](../api/testing.md).

## Build on the controls

UniAria's fields are built from smaller behaviors, and your definition can
compose them the same way:

- **TextInput** (`@uniaria/core/text-input`) is a native `<input>` or
  `<textarea>` with TextField's value handling: uncontrolled, or controlled
  with the typed text kept on screen until you pass it back, never written
  in the middle of an IME composition, and back to its default on a form
  reset. Hover and focus come with it. It has no label and no element of
  its own: the behavior around it labels it. TextField is Field and
  TextInput.
- **Autocomplete** (`@uniaria/core/autocomplete`) is a text input that
  filters a list and moves a highlight through it while focus stays in the
  input. It has its own label, description and error parts, and an element.
  Combobox is Autocomplete and Popover. See
  [Autocomplete](../components/autocomplete.mdx).
- **Field** (`@uniaria/core/field`) gives a control its label, description
  and error, and binds its value to a [Form](../components/form.mdx) by
  `name`. Every UniAria field has it inside. See
  [A field of your own](#a-field-of-your-own).

TextInput has no page of its own, so here is all of it:

|        | TextInput                                                                                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part   | `root`, the `<input>` or `<textarea>`: native `disabled` and `readonly`, the `value` property, and `data-hovered`, `data-focused`, `data-focus-visible`, `data-readonly`, `data-disabled` |
| Props  | `value` (bindable, reported as `valueChange` on each edit), `isDisabled`, `isReadOnly`                                                                                                    |
| Events | `focusChange`, when the input gains or loses focus                                                                                                                                        |
| State  | `value`, `isFocused`, `isFocusVisible`, `isHovered`, `isDisabled`, `isReadOnly`                                                                                                           |

React and Vue can render it alone with `useBehavior(textInput, props)`. On
custom elements, a TextField that renders only its input part is the input
on its own.

### An input of your own

Here TextInput handles the value, and the definition refuses typed
characters that aren't hex:

```ts
// hex-input.ts
import { bindable, defineBehavior } from '@uniaria/core';
import { partEffect } from '@uniaria/core/dom';
import { textInput } from '@uniaria/core/text-input';

export const hexInput = defineBehavior({
  name: 'hex-input',
  parts: ['root', 'input', 'swatch'],
  props: {
    // The element adopts the text typed before it upgraded.
    value: bindable('', { adopt: { part: 'input', property: 'value' } }),
  },
  setup(ctx) {
    const { value } = ctx.props;
    const text = ctx.use(
      textInput,
      () => ({
        value: value.get(),
        onValueChange: (next: string) => value.set(next),
      }),
      { parts: { root: 'input' } },
    );
    partEffect(ctx, 'input', (input) => {
      const veto = (event: InputEvent) => {
        if (event.data && !/^[\da-f]+$/i.test(event.data)) {
          event.preventDefault();
        }
      };
      input.addEventListener('beforeinput', veto);
      return () => input.removeEventListener('beforeinput', veto);
    });
    return { text };
  },
  expose: ({ api }) => api.text.state(),
  connect: ({ props, api }) => ({
    root: { attrs: {} },
    input: api.text.connect().root,
    swatch: { attrs: {}, style: { '--hex-color': `#${props.value.get()}` } },
  }),
});
```

- `{ parts: { root: 'input' } }` renders TextInput's `root` on this
  component's `input` part.
- Typing, IME, a controlled value that a form library echoes back late,
  hover and focus all come from TextInput. Label the input as any other,
  with a `<label for>` or an `aria-label`, or wrap it in a TextField.
- The value is `hexInput`'s, passed down. Inside a form, reset it yourself
  as TextField does (see
  [Resetting a bindable](../api/core.md#resetting-a-bindable)): a TextInput
  given its value leaves the reset to you.
- The veto can't refuse IME text in Chromium, which doesn't let a
  composition be cancelled.

### A list behind a text box

Autocomplete composes the same way. This command list runs the command the
user chooses and clears the text, and on Enter with nothing highlighted it
searches for the text instead:

```ts
// command-list.ts
import { bindable, defineBehavior, event, prop } from '@uniaria/core';
import { autocomplete } from '@uniaria/core/autocomplete';
import { isComposing, mergeHandlers } from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';

interface Command {
  readonly key: string;
  readonly textValue: string;
}

export const commandList = defineBehavior({
  name: 'command-list',
  parts: ['root', 'label', 'input', 'list', 'empty'],
  itemParts: ['option'],
  props: {
    // The element reads the commands from its options.
    commands: prop<readonly Command[]>([], {
      attribute: false,
      adopt: { items: { item: 'option' } },
    }),
    query: bindable(''),
  },
  events: {
    run: event<string>(),
    search: event<string>(),
  },
  setup(ctx) {
    const { commands, query } = ctx.props;
    const search = ctx.use(
      autocomplete,
      () => ({
        items: commands(),
        inputValue: query.get(),
        onInputChange: (next: string) => query.set(next),
        onAction: (key: string) => {
          ctx.emit('run', key);
          query.set('');
        },
      }),
      // The parts this component doesn't have.
      {
        parts: {
          button: null,
          popup: null,
          scroller: null,
          description: null,
          error: null,
        },
      },
    );
    // Runs after Autocomplete's, which prevents an Enter that chooses.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      if (isComposing(event) || event.altKey || event.ctrlKey) return;
      if (event.metaKey) return;
      const text = search.state().inputValue.trim();
      if (text === '') return;
      event.preventDefault();
      ctx.emit('search', text);
      query.set('');
    };
    return { search, onKeyDown };
  },
  expose: ({ api }) => api.search.state(),
  connect: ({ api }) => {
    const { root, label, input, list, empty } = api.search.connect();
    const own = input as DomPartProps;
    const on = mergeHandlers(own.on ?? {}, { keydown: api.onKeyDown });
    return { root, label, input: { ...own, on }, list, empty };
  },
  connectItem: ({ api }, part, key) => api.search.connectItem(part, key),
});
```

The rules for putting behaviors together:

- **Parts.** A composed part renders on your part of the same name, or
  where `parts` maps it. Map the ones you don't render to `null`. One with
  no part of its name and no mapping is left out as well, but UniAria warns
  about it in development, so a part you meant to render doesn't go missing
  without a word. A part whose name you also have binds to yours, so map
  it to `null` when it isn't meant to be there.
- **Handlers.** Add your handlers to a composed part with `mergeHandlers`;
  they run in the order given. Autocomplete ignores a `keydown` that is
  already prevented, so a handler you put first takes a key over. A handler
  for a key Autocomplete leaves alone, such as Enter with nothing
  highlighted, goes after it and skips what Autocomplete skips: a `keydown`
  already prevented, one that belongs to an IME composition
  (`isComposing()`), one with Ctrl or Meta, and every key while disabled.
- **Item parts.** `parts` maps parts, not item parts. Declare the item
  parts you render under Autocomplete's names (`option`, `optionLabel`,
  `group`, …) in your own `itemParts`, and return its `connectItem()` for
  them.
- **Adoption.** A custom element reads unset props from its markup only
  for the definition it registers, not for the ones that definition
  composes. Declare `adopt` on your own props, as `value` and `commands` do
  above, for the element to take the text typed before it upgraded or the
  options in its markup.
- **What to rely on.** The props you pass and the events they report back,
  `state()`, `connect()` and `connectItem()` as the component documents
  them, `actions` (`search.actions.showAll()`), and the names of its parts
  and links. `api` is internal and can change in any version. See
  [Composition](../api/core.md#composition).

Simpler needs don't call for a definition. TextField's `wrapper` holds
content before and after the input, and Autocomplete's own `action` and
`inputChange` are enough for a search box that runs a command and clears;
`commandList` is a definition for the Enter it adds.

Calling `useBehavior(textInput)` and `useBehavior(listbox)` in one React or
Vue component instead, and spreading both on the input, doesn't work:

- **The props collide.** The later spread replaces the earlier one's
  handlers and attributes, so every adapter would have to merge them by
  hand.
- **Every arrow key renders again.** What joins the two (which option is
  highlighted, whether the list shows) would live in React or Vue state.
- **A definition does more.** It works in React, in Vue and as an element,
  renders on the server, and runs in Node tests.

### A field of your own

A control UniAria doesn't have gets its label, description, error and form
binding by composing Field. This star rating is a spin button: the arrows
change the rating, Home and End go to the ends, and in a form it is required
and submitted under its `name`:

```ts
// rating.ts
import { defineBehavior, prop } from '@uniaria/core';
import { mergeHandlers } from '@uniaria/core/dom';
import type { DomPartProps } from '@uniaria/core/dom';
import { field } from '@uniaria/core/field';
import { formLink } from '@uniaria/core/form';

const MAX = 5;

export const rating = defineBehavior({
  name: 'rating',
  parts: ['root', 'label', 'stars', 'description', 'error', 'errorText'],
  links: [formLink],
  props: {
    name: prop<string | undefined>(undefined, { type: 'string' }),
    isRequired: prop(false),
  },
  setup(ctx) {
    const { props } = ctx;
    const labelling = ctx.use(
      field,
      () => ({
        name: props.name(),
        isRequired: props.isRequired(),
        labelElementType: 'span',
      }),
      { parts: { control: 'stars' }, links: [formLink] },
    );
    const stars = () => {
      const value = labelling.state().value;
      return typeof value === 'number' ? value : 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const next = {
        ArrowUp: Math.min(stars() + 1, MAX),
        ArrowDown: Math.max(stars() - 1, 1),
        Home: 1,
        End: MAX,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      labelling.actions.setValue(next);
    };
    return { labelling, stars, onKeyDown };
  },
  expose: ({ api }) => api.labelling.state(),
  connect: ({ api }) => {
    const { control, ...parts } = api.labelling.connect();
    const own = control as DomPartProps;
    const count = api.stars();
    return {
      ...parts,
      stars: {
        ...own,
        attrs: {
          ...own.attrs,
          role: 'spinbutton',
          tabindex: '0',
          'aria-valuemin': '1',
          'aria-valuemax': String(MAX),
          'aria-valuenow': count ? String(count) : undefined,
          'aria-valuetext': count ? `${count} of ${MAX} stars` : 'No rating',
        },
        style: { '--stars': String(count) },
        on: mergeHandlers(own.on ?? {}, { keydown: api.onKeyDown }),
      },
    };
  },
});
```

In React it renders like any field, and inside a form's `OwnerProvider`,
`<Rating name="score" isRequired />` submits `{ score: 3 }`:

```tsx
function Rating(props: { name?: string; isRequired?: boolean }) {
  const ui = useBehavior(rating, props);
  return (
    <div {...ui.parts.root}>
      <span {...ui.parts.label}>Your rating</span>
      <div {...ui.parts.stars} />
      <p {...ui.parts.error}>
        <span {...ui.parts.errorText} />
      </p>
    </div>
  );
}
```

- **Parts.** `{ parts: { control: 'stars' } }` puts Field's control on the
  spin button. Field's other parts render on the rating's parts of the same
  name; a part you don't render, map to `null`.
- **The form link.** A composed definition reads only the links its composer
  passes on, so the rating declares `links: [formLink]` and passes it to
  Field. Without it, the rating never finds its form.
- **The value is Field's.** Render it from `labelling.state().value`, the
  form's while bound, and report each change with
  `labelling.actions.setValue()`. Outside a form, Field holds it.
- **Field's control props.** Merge your attributes and handlers with them,
  as `connect()` does: Field's handlers follow focus, so a form checks the
  rating when focus leaves it.
- **The label.** A `<label>` names only a native control, so the label is a
  `<span>` (`labelElementType: 'span'`), linked through `aria-labelledby`.
- **More of Field.** Declare the other props you need, such as
  `isInvalid`, `validate` or `validationMessages`, and hand them on the
  same way.
- **A native control.** Around an `<input>` or a `<select>`, Field follows
  the value itself: map `control` onto it and leave out `setValue`.

## Going further

- **Events.** Declare one with `event<Detail>()` under `events` and report it
  from `setup()` with `ctx.emit(name, detail)`. React and Vue receive it as
  `on<Name>`, the element dispatches the lowercase DOM event. See
  [event](../api/core.md#event).
- **Actions.** To let consumers expand the panel from elsewhere, return an
  `expand` function from `setup()` and list it: `actions: ['expand']`. React
  and Vue call `ui.actions.expand()`, and the element gets an `expand()`
  method. See
  [Actions](../api/core.md#actions).
- **Hover and focus.** `createHover` and `createFocus` add `isHovered`,
  `isFocused` and `isFocusVisible`; merge their handlers with the press's.
  See [Interactions](../api/dom.md#interactions).
- **Reusing a component.** `ctx.use(button, props)` runs Button inside your
  definition, on its parts, as ToggleButton does. See
  [Build on the controls](#build-on-the-controls) and
  [Composition](../api/core.md#composition).
- **Working inside another instance.** An `owner` (a checkbox in its group)
  or a link (a tooltip) connects separate instances. See
  [Owners and links](../api/core.md#owners-and-links).
- **Overlays and lists.** Focus scopes, the layer stack, presence and
  positioning are in the [DOM layer](../api/dom.md); collections, typeahead
  and virtualization in [Collections](../api/collections.md).
- **Development warnings.** Report misuse with `warn()` from
  `@uniaria/core/dom`, which logs only in development.
