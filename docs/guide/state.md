---
title: State
description: Controlled and uncontrolled values, events, and reading state without re-renders.
---

A component's state has three sources: the props you pass, the values the
user changes (a checkbox's selection, a dialog's open state), and interaction
state UniAria tracks for you (hover, press, focus, highlight). This page
covers how each reaches your code.

## Props

Pass props to `useComponent` in React; they update on every render. In Vue,
pass them as a getter (`() => ({ isDisabled: props.isSaving })`), which
follows the props and refs it reads. On a custom element, set the attribute or
the property of the same name:

| Prop                        | Attribute                | Property                    |
| --------------------------- | ------------------------ | --------------------------- |
| `isDisabled`                | `disabled`               | `isDisabled`                |
| `shouldPreventFocusOnPress` | `prevent-focus-on-press` | `shouldPreventFocusOnPress` |
| `positionArea`              | `position-area`          | `positionArea`              |
| `items`                     | none: an object          | `items`                     |

Attributes are the prop name in kebab case, without an `is` or `should`
prefix. A boolean attribute is true when present, so `disabled` and
`disabled=""` both disable; for a prop that is on by default, `"false"` turns
it off (`dismissable="false"`). Objects, arrays and functions are properties
only.

## Values the user changes

Values the user can change are _bindable_: you either let the component own
them (uncontrolled) or own them yourself (controlled). Each has a change event
named after the value without its `is` prefix: `isOpen` changes through
`openChange`, `isSelected` through `selectedChange`, `value` through
`valueChange`.

In React:

```tsx
import { checkbox } from '@uniaria/core/checkbox';
import { dialog } from '@uniaria/core/dialog';

// Uncontrolled: seeded once by `default<Name>`, then owned by the component.
const terms = useComponent(checkbox, {
  defaultSelected: false,
  onSelectedChange: (isSelected) => track('terms', isSelected),
});

// Controlled: you pass the value and update it from the change callback.
const [isOpen, setOpen] = useState(false);
const settings = useComponent(dialog, { isOpen, onOpenChange: setOpen });
```

In Vue, the same props, with a getter for the controlled one; `defineModel()`
turns it into your component's `v-model` (see [Vue](../api/vue.md#v-model)):

```ts
const terms = useComponent(checkbox, {
  defaultSelected: false,
  onSelectedChange: (isSelected) => track('terms', isSelected),
});

const isOpen = ref(false);
const settings = useComponent(dialog, () => ({
  isOpen: isOpen.value,
  onOpenChange: (open) => (isOpen.value = open),
}));
```

On a custom element, the `default-<name>` attribute seeds an uncontrolled
value, setting the property makes it controlled, and reading the property
gives the current value either way, like a native input's `value`. Writing
back what you read (`el.value = el.value`) controls it too:

```html
<uni-checkbox default-selected>…</uni-checkbox>

<script type="module">
  const settings = document.querySelector('uni-dialog');
  settings.isOpen = false;
  settings.addEventListener('openchange', (event) => {
    if (event.detail || confirmLeaving()) settings.isOpen = event.detail;
  });
</script>
```

A default applies until the first change, like a form control's `value`
attribute. When the value is controlled, a change event is a request: the
component calls it and waits for the new value from you. If you don't pass
one back, nothing changes, which is how you veto a change.

On elements, the starting value often comes from your markup instead: a
checkbox reads its input's `checked` attribute, a text field its input's
`value`. Each component page lists what it reads.

## Events

Components report what happened through events, typed per component:

| In React and Vue props | On a custom element                           |
| ---------------------- | --------------------------------------------- |
| `onPress: (e) => …`    | `addEventListener('press', (e) => …)`         |
| `onSelectedChange: …`  | `selectedchange`, the value in `event.detail` |
| `onFocusChange: …`     | `focuschange`                                 |

DOM events are the camelCase name in lowercase. They bubble, aren't
`composed`, and carry their value in `detail`. In React and Vue, callbacks are
read when they run, so inline functions are fine: there is nothing to
memoize. In Vue they are props, not emits; call `emit` from one to pass the
event on.

## Reading state

Each component exposes its _public state_: the values listed in the State
table of its page, such as `isPressed`, `isFocusVisible`, `isOpen` or
`focusedKey`. Interaction state changes often, so UniAria writes it to
the DOM as [state attributes](./styling.md#state-attributes) without
rendering anything. Read it in code only when a render or a script needs it.

### In React

`useComponentState` selects one value and renders the component again only
when that value changes:

```tsx
import { useComponent, useComponentState } from '@uniaria/react';

function Menu() {
  const menu = useComponent(popover, {});
  const isOpen = useComponentState(menu, (state) => state.isOpen);

  return (
    <>
      <button {...menu.parts.trigger}>Options</button>
      <div {...menu.parts.root}>{isOpen && <ExpensiveContent />}</div>
    </>
  );
}
```

Select the smallest value you need. A selector that builds a new object each
time renders again on every change; pass an `isEqual` function as the third
argument to compare such values yourself. Never select the whole state.

Hovering, pressing, focusing, moving a highlight or opening an overlay renders
the component zero times unless a selector asks for that value. UniAria's own
tests count renders to keep it that way.

### In Vue

`useComponentState` returns a read-only ref of one selected value. A template
that reads it renders again only when that value changes:

```vue
<script setup lang="ts">
import { popover } from '@uniaria/core/popover';
import { useComponent, useComponentState } from '@uniaria/vue';

import ExpensiveContent from './ExpensiveContent.vue';

const menu = useComponent(popover);
const isOpen = useComponentState(menu, (state) => state.isOpen);
</script>

<template>
  <button v-bind="menu.parts.trigger">Options</button>
  <div v-bind="menu.parts.root"><ExpensiveContent v-if="isOpen" /></div>
</template>
```

The same rules hold: select the smallest value, and pass an `isEqual` for one
built anew each time. The rest of the state reaches the elements without
rendering the component, and Vue's tests count renders as React's do.

### On custom elements

Listen for the component's events, or read the state when you need it:

```js
const select = document.querySelector('uni-select');
select.addEventListener('openchange', () => {
  const { isOpen, value } = select.instance.getState();
  console.log(isOpen, value);
});
```

For state without an event of its own, `element.instance.subscribe(listener)`
calls `listener` after every change; read `getState()` inside it, and call
the function it returns to stop.
