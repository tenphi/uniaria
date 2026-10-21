---
title: Vue
description: '@uniaria/vue: useComponent and useComponentState.'
---

`@uniaria/vue` renders any UniAria definition in Vue with one composable. It
has no component-specific code: every component on this site works through
the same two exports.

```ts
import { useComponent, useComponentState } from '@uniaria/vue';
```

It needs Vue 3.5 or later (`vue` is a peer dependency) and nothing else.

Internal state never renders your component again. Each part renders with its
current props, and after mount UniAria writes every change (hover, press,
focus, an opening popover, the highlighted option) straight to the elements.
Your component renders again only for its own reactive data and for state you
[select](#usecomponentstate). See [State](../guide/state.md).

## useComponent

```ts
useComponent<D>(definition: D, props?: MaybeRefOrGetter<PropsOf<D>>): ComponentHandle<D>
```

Call it in `setup()` or `<script setup>`. It creates an instance of
`definition` for this component and returns props to bind onto each part.

```vue
<script setup lang="ts">
import { toggleSwitch } from '@uniaria/core/switch';
import { useComponent } from '@uniaria/vue';

const emit = defineEmits<{ change: [isSelected: boolean] }>();

const wifi = useComponent(toggleSwitch, {
  defaultSelected: true,
  labelElementType: 'span',
  onSelectedChange: (isSelected) => emit('change', isSelected),
});
</script>

<template>
  <label v-bind="wifi.parts.root" class="switch">
    <input v-bind="wifi.parts.input" name="wifi" />
    <span v-bind="wifi.parts.indicator" />
    <span v-bind="wifi.parts.label">Wi-Fi</span>
  </label>
</template>
```

`props` are the component's props as its page lists them, typed from its
definition: values, `default<Name>` for uncontrolled values, `on<Event>`
callbacks, an `owner` for components that have one, and link props such as
`tooltip`. Attributes you own (`id`, `name`, `aria-label`) go in the
template, next to `v-bind`, and so does `class`: UniAria marks parts with
attributes and never sets a class.

- **One instance** per component, created in setup. Keep definitions at
  module scope.
- **Ids** come from Vue's `useId()`, so server and client agree. An `id` you
  write after `v-bind` wins, and UniAria points every reference at it once
  the part mounts (see [Ids](../guide/accessibility.md#ids)). Several Vue
  apps on one page need their own `app.config.idPrefix`, since `useId()`
  counts per app.
- **Callbacks** are component events: `onPress`, `onOpenChange`. They are
  props, not Vue emits; re-emit from them when your component has emits of
  its own, as `emit('change', …)` above.

### Props

Pass props in whichever form changes the way you need:

| Form                                 | Example                                                   | Follows changes |
| ------------------------------------ | --------------------------------------------------------- | --------------- |
| A getter                             | `useComponent(dialog, () => ({ isOpen: open.value }))`    | Yes             |
| A ref                                | `useComponent(dialog, dialogProps)`                       | Yes             |
| Your component's own `defineProps()` | `useComponent(button, props)`                             | Yes             |
| A plain object                       | `useComponent(button, { isFocusableWhenDisabled: true })` | No: read once   |

A getter is the usual form: it reads refs, props and computed values like a
`computed()` does. A change is stored before your component renders, so the
render shows it, and applied after Vue's patch, once every part is in place.

```vue
<script setup lang="ts">
import { button } from '@uniaria/core/button';
import { useComponent } from '@uniaria/vue';

const props = defineProps<{ isSaving: boolean }>();
const emit = defineEmits<{ save: [] }>();

const save = useComponent(button, () => ({
  onPress: () => emit('save'),
  isDisabled: props.isSaving,
  isFocusableWhenDisabled: true,
}));
</script>

<template>
  <button v-bind="save.parts.root">{{ isSaving ? 'Saving…' : 'Save' }}</button>
</template>
```

- **Values pass as they are.** A reactive array stays reactive, and UniAria
  reads it like any array. It compares values by identity, as in React, so
  give a new array when items change (`items.value = [...items.value, item]`)
  rather than changing one in place.
- **Boolean props in wrappers.** Vue turns an absent `Boolean` prop into
  `false`. A wrapper that declares a value such as `isOpen` as a boolean prop
  and passes its props on would make it controlled and closed. Give such a
  prop `undefined` as its default:

```ts
const props = withDefaults(defineProps<{ isOpen?: boolean }>(), {
  isOpen: undefined,
});
const ui = useComponent(popover, props);
```

### v-model

A value is a prop and its change callback, as everywhere in UniAria, and
`defineModel()` connects the two to your component's `v-model`:

```vue
<script setup lang="ts">
import { popover } from '@uniaria/core/popover';
import { useComponent } from '@uniaria/vue';

const open = defineModel<boolean>('open', { default: undefined });

const ui = useComponent(popover, () => ({
  isOpen: open.value,
  onOpenChange: (isOpen) => (open.value = isOpen),
}));
</script>

<template>
  <button v-bind="ui.parts.trigger">Size</button>
  <div v-bind="ui.parts.root"><slot /></div>
</template>
```

With `v-model:open` from the parent, the parent controls it. Without one,
`open` starts `undefined`, so the popover starts uncontrolled, and from the
first change on holds the value itself. The `default: undefined` matters: a
bare `defineModel<boolean>()` starts `false`, which controls the popover and
keeps it closed.

### The handle

| Member                    | Description                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instance`                | The stable [`Instance`](./core.md#instance). Pass it to `useComponentState`, or as another component's `owner` or link prop. `instance.getState()` reads state without subscribing. |
| `actions`                 | The component's public [actions](./core.md#actions), such as an overlay's `open()` and `close()`.                                                                                   |
| `parts`                   | Props for each part, read when the render reads them: `parts.root`, `parts.input`. Bind them with `v-bind`.                                                                         |
| `getItemProps(part, key)` | Props for one item part of one item, for collections: `getItemProps('option', item.key)`. See [item parts](#item-parts).                                                            |

Render the parts you need: each component's page says which parts are
optional. The handle and its instance are marked raw, so a `ref` or
`reactive()` holding them never wraps them in a proxy.

Actions are for commands from outside the component, such as opening a dialog
when a save fails. Call them from handlers and watchers, never during render.
For a controlled component, an action only calls the change callback
(`onOpenChange`), as a user's click would.

```ts
const conflict = useComponent(dialog);

async function save(draft: string) {
  const response = await fetch('/api/draft', { method: 'PUT', body: draft });
  if (response.status === 409) conflict.actions.open();
}
```

## Part props in Vue

`parts.<name>` is a plain object for `v-bind`: attributes, event handlers, a
`style` object when the part has one, and a `ref`. Vue takes DOM names, so
UniAria changes little of its [part props](./core.md#part-props):

| Part props                                                                     | Vue                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Attributes: `aria-*`, `data-*`, `id`, `role`, `for`, `tabindex`, `readonly`, … | Unchanged, as strings. Vue turns `''` on a boolean property into `true`. |
| Events: `click`, `keydown`, `focusin`, `pointerdown`, `dblclick`, …            | `onClick`, `onKeydown`, `onFocusin`, `onPointerdown`, `onDblclick`, …    |
| `style`, custom properties (`--anchor-width`) and others (`inset-block-start`) | Unchanged in `style`                                                     |
| `properties.value`, `properties.checked`                                       | `^value`, `^checked`, from the first render only                         |

- **Handlers** are stable and call the handler from the latest state with
  the native event.
- **Part markers** are attributes in the part props: `data-uni` on the
  root (`data-uni="switch"`), `data-uni-part` on a part outside it, and
  `data-element` on the other parts, which your CSS and Tasty select parts
  by. See [Styling](../guide/styling.md#parts).
- **Your own listeners** go next to `v-bind` as usual. Vue runs them as
  well as UniAria's: `@keydown` beside `v-bind` adds a listener, it doesn't
  replace one.
- **Live values.** An input's `value` and a checkbox's `checked` are never
  controlled by Vue. `^value` and `^checked` set only the attribute, once,
  from the first render, so the server HTML shows the starting value and
  form reset goes back to it, and UniAria sets the DOM property after that.
  Control the value through the component's props (`value`, `isSelected`),
  not with `v-model` on the element. Other live properties, such as a
  checkbox's `indeterminate`, are set after mount.
- **A component as a part.** Bind part props onto a component that renders
  the element as its root, such as a router link:
  `<RouterLink v-bind="docs.parts.root" to="/docs">`. Vue passes them on to
  its root element, and UniAria takes that element.

### Refs

Each part's props include a `ref`, a function that hands the element to
UniAria. Keep it: a `ref` you write next to `v-bind` replaces it, and the
part stops working. To get the element yourself, read
`instance.element(part)` after mount, or pass the element on from a function
ref of your own:

```vue
<script setup lang="ts">
import { button } from '@uniaria/core/button';
import { useComponent } from '@uniaria/vue';
import { shallowRef } from 'vue';

const save = useComponent(button);
const own = shallowRef<HTMLButtonElement | null>(null);

function setRef(element: unknown) {
  save.parts.root.ref(element);
  own.value = element as HTMLButtonElement | null;
}
</script>

<template>
  <button v-bind="save.parts.root" :ref="setRef">Save</button>
</template>
```

UniAria gets the elements once Vue's patch is done, so it never works on one
that isn't in the document yet, as a part is during its first mount.

### Item parts

Collections (Listbox, Select, Combobox) repeat item parts per item. Bind
`getItemProps(part, key)` onto each item's element, with the item's key as
Vue's `key`:

```vue
<script setup lang="ts">
import { listbox } from '@uniaria/core/listbox';
import { useComponent } from '@uniaria/vue';

const props = defineProps<{ items: { key: string; textValue: string }[] }>();
const ui = useComponent(listbox, () => ({ items: props.items }));
</script>

<template>
  <ul v-bind="ui.parts.list">
    <li
      v-for="item in items"
      :key="item.key"
      v-bind="ui.getItemProps('option', item.key)"
    >
      {{ item.textValue }}
    </li>
  </ul>
</template>
```

Item props are computed lazily, only for the items you render, and later
changes reach each row's element directly, so moving the highlight renders
nothing. One handler per part and event serves every item.

## useComponentState

```ts
useComponentState<D, T>(
  source: Instance<D> | ComponentHandle<D>,
  selector: (state: StateOf<D>) => T,
  isEqual?: (a: T, b: T) => boolean,
): Readonly<Ref<T>>
```

Reads one value of a component's public state as a read-only ref. A render
that reads it renders again only when that value changes: `Object.is` by
default, or `isEqual`. The state is what the component's page lists under
State.

```vue
<script setup lang="ts">
import { dialog } from '@uniaria/core/dialog';
import { useComponent, useComponentState } from '@uniaria/vue';

const confirm = useComponent(dialog);
const isOpen = useComponentState(confirm, (state) => state.isOpen);
</script>

<template>
  <p>{{ isOpen ? 'Waiting for an answer' : 'Ready' }}</p>
</template>
```

- Select what the render needs, not the whole state: a selector that returns
  the state object renders on every change.
- A selector returning a new object or array each time needs an `isEqual`,
  such as a shallow comparison.
- A prop change that the selected value already shows doesn't render twice.
- It works in any component that has the instance or the handle, so a child
  can render from its parent's state without rendering the parent. It stops
  following the state when that component unmounts.

## Owners and links

Some components work inside another instance: a checkbox in its checkbox
group, a radio in its radio group, a control in its field. A component finds
its owner in this order:

1. **The `owner` prop**, an instance:
   `useComponent(checkbox, { value: 'sms', owner: group.instance })`. For
   parts that sit apart.
2. **The nearest component that provides one.** Every `useComponent`
   provides its instance to the components inside it, slot content
   included, through Vue's `provide()`. It holds only the stable instance,
   so it renders nothing when state changes, and it follows the component
   tree, so it crosses `<Teleport>`. The first render, and the server HTML,
   already have the owner's state.
3. **The DOM**, after mount: the nearest ancestor element that provides an
   owner, such as a `<uni-checkbox-group>` or another app's group.

```vue
<!-- ContactGroup.vue -->
<script setup lang="ts">
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { useComponent } from '@uniaria/vue';

const group = useComponent(checkboxGroup, { defaultValue: ['email'] });
</script>

<template>
  <div v-bind="group.parts.root">
    <span v-bind="group.parts.label">Contact me by</span>
    <slot />
  </div>
</template>
```

```vue
<!-- ContactOption.vue -->
<script setup lang="ts">
import { checkbox } from '@uniaria/core/checkbox';
import { useComponent } from '@uniaria/vue';

const props = defineProps<{ value: string }>();
const ui = useComponent(checkbox, () => ({
  value: props.value,
  labelElementType: 'span',
}));
</script>

<template>
  <label v-bind="ui.parts.root">
    <input v-bind="ui.parts.input" />
    <span v-bind="ui.parts.label"><slot /></span>
  </label>
</template>
```

```vue
<ContactGroup>
  <ContactOption value="email">Email</ContactOption>
  <ContactOption value="sms">SMS</ContactOption>
</ContactGroup>
```

Provided instances nest; each component takes the nearest owner of the
definition it needs, so providing one that nothing inside asks for changes
nothing.

**Links** go through a prop named after the link: a component that takes a
tooltip gets the tooltip's instance as `tooltip`:

```ts
const hint = useComponent(tooltip);
const save = useComponent(button, { tooltip: hint.instance });
```

Vue components also answer lookups from the DOM: a custom element inside a
Vue checkbox group's part finds that group. See
[Composition](../guide/composition.md).

## Attributes UniAria owns

UniAria owns every attribute a part's props contain: ARIA state, the part
markers (`data-uni`, `data-uni-part`, `data-element`), state attributes such
as `data-pressed`, and the references it writes. The rest of the element,
classes and a part's `id` included, is yours: an `id` after `v-bind` is
kept, and the references follow it. An option's `id`, made from its key, is
UniAria's.

In development, the first time each part element reaches UniAria, it compares
the element's attributes with the part props Vue just rendered. When your
template wrote one of its attributes (a `type`, a `data-pressed`, an
`aria-expanded` next to `v-bind`), or a parent's attributes fell through onto
the part, it warns:

```
[uniaria] button: "type" on the root part is written by UniAria, but the element has "submit". Pass it as a prop, or drop it from the template.
```

Pass the value as the component's prop instead (`type: 'submit'`), or remove
it. Some components add warnings of their own, such as Button's when the
rendered tag doesn't match `elementType`. Warnings are on while
`process.env.NODE_ENV` isn't `'production'`.

## Lifecycle

- **Mount.** The instance starts once your component has mounted, so every
  part is in the document. A part that appears later, under `v-if`, joins
  once Vue's patch is done.
- **`<KeepAlive>`.** A component kept aside stops, as on unmount, and
  starts again when it comes back.
- **`<Teleport>`.** A part can sit elsewhere in the document, as an
  overlay's panel or a radio rendered apart; owners still reach it.
- **Unmount.** The instance stops before Vue removes the elements.

## Server rendering

`useComponent` renders complete HTML through `vue/server-renderer`: ids,
ARIA attributes, state attributes, the part markers, starting values of
inputs and checkboxes, and state you select with `useComponentState`. Owners
provided by components around it are part of it. Nothing that needs the
DOM runs on the server: no listener, focus change or measurement. On the
client, Vue hydrates the same markup, and UniAria attaches to the elements
without a second render. Nuxt needs nothing more. See
[Server rendering](../guide/server-rendering.md).

## Types

| Type                 | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `ComponentHandle<D>` | What `useComponent` returns.                                            |
| `ComponentProps<D>`  | What `useComponent` takes: a getter, a ref, a reactive object or props. |
| `VuePartProps`       | Props for one part: attributes, handlers, `style` and `ref`.            |

Component props and state types come from each component's subpath:
`ButtonProps` and `ButtonState` from `@uniaria/core/button`.
