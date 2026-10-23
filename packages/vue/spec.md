# Vue adapter spec (`@uniaria/vue`)

Status: approved by @tenphi on 2026-10-21, with the changes outside the
package and the recommended answers below.

## Summary

`@uniaria/vue` renders any UniAria definition in Vue 3 with one composable,
the way `@uniaria/react` does in React. Its purpose is as much a test as a
feature (owner, 2026-10-21): a second framework adapter shows whether the
approach holds outside React. Behavior written once in `@uniaria/core`,
internal state that never renders a component, and a DOM binder shared by
every adapter should carry over to Vue without changing the core.

The adapter succeeds when:

- every conformance suite passes against it unchanged, at the phase React
  has reached (4);
- an internal interaction (hover, press, focus, highlight, opening an
  overlay) renders the owning Vue component zero times;
- server rendering gives the same complete HTML as React, and hydration
  attaches without a mismatch or a second render;
- nothing in `@uniaria/core` changes. If the adapter needs a runtime or
  binder change, that is a finding: it stops for the owner like any
  contract change.

Vue apps can already use the custom elements (`@uniaria/elements`). The
adapter adds what elements can't give a Vue app: no host element around each
component, complete server HTML from Vue's own renderer, owners found during
setup (so the first render and the server HTML have the owner's state), and
props, callbacks and state as Vue code reads them.

Not part of this package: component-specific code, a Vue component per
UniAria component, `v-model` sugar, a Nuxt module, and Vue 3.6's Vapor mode
(see Not included).

## API

```ts
import { useBehavior, useBehaviorState } from '@uniaria/vue';
```

Two composables, the same names and shape as React's. There is no
`OwnerProvider`: Vue's `provide()` does its work (Owners and links).

### useBehavior

```ts
useBehavior<D>(
  definition: D,
  props?: MaybeRefOrGetter<PropsOf<D>>,
): BehaviorHandle<D>
```

Called in `setup()` (or `<script setup>`). Creates one instance of
`definition` for the component and returns props to bind onto each part.

```vue
<script setup lang="ts">
import { toggleSwitch } from '@uniaria/core/switch';
import { useBehavior } from '@uniaria/vue';

const emit = defineEmits<{ change: [isSelected: boolean] }>();

const wifi = useBehavior(toggleSwitch, () => ({
  defaultSelected: true,
  labelElementType: 'span',
  onSelectedChange: (isSelected) => emit('change', isSelected),
}));
</script>

<template>
  <label v-bind="wifi.parts.root" class="switch">
    <input v-bind="wifi.parts.input" name="wifi" />
    <span v-bind="wifi.parts.indicator" />
    <span v-bind="wifi.parts.label">Wi-Fi</span>
  </label>
</template>
```

- **Props** are the definition's props, typed from it as in React: values,
  `default<Name>`, `on<Event>` callbacks, `owner` and link props. Inline
  callbacks get their parameter types from the definition.
- **One instance** per component, created in setup. Keep definitions at
  module scope.
- **Ids** come from Vue's `useId()`, so server and client agree.
- **Attributes you own** (`id`, `name`, `class`, `aria-label`) go in the
  template next to `v-bind`, as in React they go next to the spread.

### Props and reactivity

`props` is what Vue composables usually take (`MaybeRefOrGetter`):

| Form                                | Example                                               | Reactive        |
| ----------------------------------- | ----------------------------------------------------- | --------------- |
| A getter (documented form)          | `useBehavior(dialog, () => ({ isOpen: open.value }))` | Yes             |
| A ref                               | `useBehavior(dialog, dialogProps)`                    | Yes             |
| The component's own `defineProps()` | `useBehavior(button, props)`                          | Yes, key by key |
| A plain object                      | `useBehavior(button, { isDisabled: true })`           | No: read once   |

A change goes the way React's does, in two steps:

1. A pre-flush watcher stores the new props silently (`setProps()`) before
   the component renders, so the render reads them.
2. `instance.sync()` runs after the patch (post-flush), once every part
   element is in place, and runs the watchers for what changed.

Values pass through as they are: a reactive array stays reactive, and the
core reads it like any array. The adapter adds no deep reactivity.

**Boolean props in wrappers.** Vue casts an absent `Boolean` prop to
`false`. A wrapper that declares a bindable as a boolean prop and forwards
its `defineProps()` would make it controlled and closed. Such a prop needs
`undefined` as its default:

```ts
const props = withDefaults(defineProps<{ isOpen?: boolean }>(), {
  isOpen: undefined,
});
```

The docs say this wherever a wrapper forwards props. The adapter can't
detect it.

### Bindables and `v-model`

No sugar in this version. A bindable is a prop and a callback, as in React,
and `defineModel()` connects them to the consumer's `v-model`:

```ts
const open = defineModel<boolean>('open', { default: undefined });
const ui = useBehavior(dialog, () => ({
  isOpen: open.value,
  onOpenChange: (isOpen) => (open.value = isOpen),
}));
```

Without a `v-model:open` from the parent, `open` starts `undefined` (the
component is uncontrolled) and holds the value from the first change on,
which is then controlled by the local value: the same result. The
`default: undefined` matters here too: a bare `defineModel<boolean>()` is a
Boolean prop, so it starts `false`.

### Events

Component events are the definition's `on<Event>` callbacks, passed in
props. They are not Vue emits: the composable has no `emits` of its own. A
wrapper that wants emits re-emits from the callback, as above.

### The handle

| Member                    | Description                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `instance`                | The stable `Instance`. Pass it to `useBehaviorState`, as another component's `owner`, or as a link prop. |
| `actions`                 | The public actions (`open()`, `close()` on overlays), stable.                                            |
| `parts`                   | Props for each part, read when the render reads them. Bind them with `v-bind="ui.parts.root"`.           |
| `getItemProps(part, key)` | Props for one item part of one item, for collections.                                                    |

`parts` is a getter: each read takes the props from the current
`connect()` (cached while it returns the same object), so every render reads
current state, as React's renders do. The store isn't reactive, so reading
`parts` subscribes the render to nothing. The handle and the instance are
`markRaw`, so putting them in a `ref` or `reactive()` never proxies the
instance.

### Part props in Vue

Vue's `v-bind` takes DOM names, so the conversion is smaller than React's:

| Part props                                                                | Vue                                                                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Attributes (`aria-*`, `data-*`, `role`, `for`, `tabindex`, `readonly`, …) | Unchanged: names and string values. Vue turns `''` on a boolean DOM property into `true`.                                         |
| An attribute that is `undefined`                                          | Left out                                                                                                                          |
| Events: `click`, `keydown`, `focusin`, `pointerdown`, `dblclick`, …       | `on` and the name capitalized: `onClick`, `onKeydown`, `onFocusin`, `onPointerdown`. Vue listens to the same lowercase DOM event. |
| `style`                                                                   | The object as it is: custom properties and kebab-case names                                                                       |
| `properties.value`, `properties.checked`                                  | `^value`, `^checked` (Vue's attribute-only binding), from the first render only                                                   |
| (none)                                                                    | `ref`: a stable function that hands the element to UniAria                                                                        |

- **Handlers** are stable wrappers that call the handler from the latest
  `connect()` with the native event Vue passes.
- **Your own handlers** (`@keydown` next to `v-bind`) run as well as
  UniAria's: Vue merges listeners where React replaces them.
- **Live values.** `^value` and `^checked` set the attribute (the default
  value) and never the property, so Vue never controls an input: the server
  HTML shows the starting value, a re-render leaves what the user typed, and
  form reset goes back to it. The binder sets the property after mount, as
  in React.
- **A component as a part.** A part may be a component that renders the
  element as its root, like a router link:
  `<RouterLink v-bind="docs.parts.root" to="/docs">`. Vue passes the part
  props through to its root element, and the function ref receives the
  component: the adapter takes its root element (`$el`).

### Refs and when elements reach the binder

Vue calls a function ref during the patch, and on first mount that is before
the element is in the document. The binder must never get a detached
element: `showPopover()` throws on one, and a bubbling owner request from one
reaches no ancestor. So refs only record the element, and the adapter hands
every recorded element to the binder in one batch once the patch is done:
in `onMounted` before the instance starts, and for elements a later patch
adds or removes, in a post-flush callback. Vue calls a function ref again on
every patch of its element; the same element again is a no-op.

### Item parts

```vue
<ul v-bind="ui.parts.list">
  <li
    v-for="item in items"
    :key="item.key"
    v-bind="ui.getItemProps('option', item.key)"
  >
    {{ item.textValue }}
  </li>
</ul>
```

As in React: props computed lazily per rendered item and reused while
`connectItem()` returns the same object, one handler per part and event that
finds the key from the element, and one ref per part and key. A virtualized
list renders `renderedKeys` from a child component that reads them with
`useBehaviorState`, so the owner never renders again for them.

### useBehaviorState

```ts
useBehaviorState<D, T>(
  source: Instance<D> | BehaviorHandle<D>,
  selector: (state: StateOf<D>) => T,
  isEqual?: (a: T, b: T) => boolean,
): Readonly<Ref<T>>
```

A read-only ref of one selected value. Reading it in a render subscribes
that render, and only a change of the selected value (`Object.is`, or
`isEqual`) triggers it.

```ts
const confirm = useBehavior(dialog, () => ({}));
const isOpen = useBehaviorState(confirm, (state) => state.isOpen);
```

- The ref reads the state when it is read, so a render after a prop change
  already shows the new value, and the store's notification from the
  post-flush `sync()` finds nothing new: a prop change renders once, as in
  React.
- It subscribes on the client only, and unsubscribes when its effect scope
  ends (the component unmounts).
- It works in any component that has the instance or the handle.

### Owners and links

A component finds its owner in the same order as in React:

1. **The `owner` prop**, an instance.
2. **`provide`/`inject`.** Every `useBehavior` provides its instance to the
   component's descendants, slot content included, and finds the nearest
   provided instance of its owner's definition during setup. The first
   render and the server HTML have the owner's state. Like React context,
   it follows the component tree, so it crosses `<Teleport>`. What is
   provided is the stable instance, never state.
3. **The DOM**, after mount: the nearest ancestor that provides an owner, a
   custom element or another adapter's part.

React needs `OwnerProvider` because a hook can't provide a context; Vue's
`provide()` can, so a Vue component provides by calling `useBehavior`.

```vue
<!-- ContactGroup.vue -->
<script setup lang="ts">
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { useBehavior } from '@uniaria/vue';

const group = useBehavior(checkboxGroup, () => ({ defaultValue: ['email'] }));
</script>

<template>
  <div v-bind="group.parts.root">
    <span v-bind="group.parts.label">Contact me by</span>
    <slot />
  </div>
</template>
```

`<ContactGroup><Option value="email">Email</Option></ContactGroup>`: each
`Option` calls `useBehavior(checkbox, …)` and injects the group.

The adapter also answers DOM requests for its owner parts, so a custom
element inside a Vue group's root finds that group, as with React.

**Links** pass the instance in the prop named after the link:
`useBehavior(button, () => ({ tooltip: hint.instance }))`.

### Attributes UniAria owns

As in React. In development, the first time each part element reaches the
binder, the adapter compares its attributes with the part props Vue just
rendered and warns when the template wrote one UniAria owns (an attribute
after `v-bind`, or one falling through from a parent component). A named
part's `id` is the exception: one after `v-bind` wins, and the references
follow it. The probe below confirmed that Vue gives the later attribute
precedence, as React's spread order does.

## Lifecycle

| Vue                                            | UniAria                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup()`                                      | Create the instance and the binder, link an injected owner, provide the instance, watch the props.                                                                                          |
| Render                                         | `parts` and `getItemProps` read the current `connect()`.                                                                                                                                    |
| Function refs                                  | Record elements (Refs and when elements reach the binder).                                                                                                                                  |
| `onMounted`                                    | Hand recorded elements to the binder; `instance.start()` and `binder.start()` in one batch; answer DOM owner requests; look an owner up through the DOM when no prop or injection gave one. |
| Prop change                                    | `setProps()` before the render; `sync()` after the patch.                                                                                                                                   |
| `onBeforeUnmount`                              | Stop answering owner requests, `binder.stop()`, `instance.stop()`, while the elements are still in the document.                                                                            |
| `<KeepAlive>`: `onDeactivated` / `onActivated` | Stop, then start again. Instances are restartable, as React's StrictMode already requires.                                                                                                  |

Starting the instance and the binder in one batch keeps the order React
uses, so an overlay open from the start is `data-entering` as it shows.

## Server rendering

`renderToString` from `vue/server-renderer` runs setup and the render, never
`onMounted` or a watcher, so no listener, focus change or measurement
happens on the server. The HTML has ids from `useId()`, ARIA and state
attributes, the part markers, starting values of inputs and checkboxes
(`^value` and `^checked` render as `value` and `checked`), injected owners'
state, and state read with `useBehaviorState`. Hydration calls the refs
with the server's elements and starts the instance in `onMounted`, without a
second render. Nuxt is Vue's server renderer with `useId()`, so it needs
nothing more.

## What Vue does with part props

A probe against Vue 3.5.43 (render functions and the runtime template
compiler, in Chromium and in Node's server renderer) confirmed what the
design above rests on:

- `^value` and `^checked` set only the attribute on the client, render as
  `value` and `checked` on the server, and hydrate without a mismatch
  warning. After the user typed or unchecked, a re-render left the live
  value alone.
- An attribute the binder wrote (`aria-pressed`) survived a re-render whose
  part props hadn't changed: Vue patches from the previous vnode, not from
  the element.
- `onKeydown`, `onFocusin`, `onPointerdown`, `onDblclick`,
  `onGotpointercapture` and `onBeforetoggle` listened to the lowercase DOM
  events.
- `''` on `disabled`, `hidden`, `inert` and `readonly` gave the boolean
  attribute; `tabindex` and `for` stayed attributes; a `style` object with
  `--anchor-width` and `inset-block-start` rendered both.
- A function ref in a `v-bind` object was called on mount with a detached
  element, again on every re-render with the connected one, and once on
  hydration with the server's element.
- In a compiled template, `id` after `v-bind` won and `id` before it lost;
  `@click` next to `v-bind` ran after UniAria's handler, not instead of it.
- `inject()` in slot content found what the component rendering the slot
  provided, on the server too.
- `useId()` gave the same id on the server and in hydration.
- An absent `Boolean` prop was `false`, and `undefined` with
  `default: undefined`, which the SFC compiler keeps for `withDefaults()`
  and `defineModel()`.

## Package layout

```
packages/vue/
├── AGENTS.md                  Local rules, like packages/react/AGENTS.md
├── README.md
├── package.json               @uniaria/vue; peer vue ^3.5.0
├── spec.md                    This file
├── tsconfig.json
├── tsdown.config.ts           One entry, ESM, platform neutral
└── src/
    ├── index.ts               useBehavior, useBehaviorState, types
    ├── use-behavior.ts
    ├── use-behavior-state.ts
    ├── owner.ts               The provide/inject scope
    ├── props.ts               Part props → Vue props
    ├── conformance-adapter.ts The mount contract (test support, not exported)
    └── *.test.ts, *.browser.test.ts
```

The peer range is `^3.5.0`: `useId()` arrived in Vue 3.5. The development
dependency is `^3.5.43`, the newest 3.5 release past the 14-day release age
(3.5.44 is from 2026-10-13).

## Testing

Tests are TypeScript with Vue's `h()` render functions, so they need no Vite
plugin. A few compile real templates with the runtime compiler that ships in
`vue` (`vue/dist/vue.esm-bundler.js`), where a template behaves differently
from a render function: `v-bind` merged with attributes before and after it,
listeners merged, `v-for` with item parts.

- **Conformance.** `src/conformance-adapter.ts` renders a template with
  `h()` in a harness component that counts its renders; `nested()` becomes a
  component with its own `useBehavior()`, `rows()` a child component that
  reads `renderedKeys` and `renderedSections`. Props live in a shallow ref:
  `setProps()` replaces it and awaits `nextTick()`, which covers the
  post-flush `sync()`. `src/conformance.browser.test.ts` runs every suite at
  phase 4.
- **`useBehavior`.** First paint; part markers beside the consumer's
  `class`; handler identity; attributes the binder wrote surviving a
  re-render; latest callbacks without a render; actions; zero renders for
  internal interactions; every props form (getter, ref, `defineProps()`,
  plain object) and the Boolean default; a component as a part (`$el`).
- **Elements reaching the binder.** Never detached: parts that appear later
  under `v-if`, a popover inside one, `<Teleport>`; one batch per patch for
  item rows; `<KeepAlive>` stopping and starting.
- **Development warnings**, **part ids**, **live DOM properties**, **item
  parts** and **element effects** (`data-entering` from the start): the
  cases React's tests cover, in Vue.
- **`useBehaviorState`.** Renders only for a change; once for a prop
  change; again for a change the sync makes; `isEqual`; unsubscribes on
  unmount.
- **Owners.** Injection from the first render and on the server, through
  slots and `<Teleport>`; the `owner` prop; the DOM path; a Vue checkbox
  inside `<uni-checkbox-group>` and an element inside a Vue group's root;
  an owner that connects late; radios outside their group's root.
- **Server rendering** (`ssr.test.ts`, Node): the components React's server
  tests cover, through `renderToString`. **Hydration** (browser): no
  mismatch warning, no second render.
- **`ssr-safety.test.ts`**: the entry imports in Node.

## Documentation

- **`docs/api/vue.md`**, a new page in the API tab, in the shape of
  `react.md`.
- **Component pages.** A Vue tab beside every React tab (38 across 15
  pages), as a `<script setup>` component. The "React prop" column of the
  events tables becomes "Callback prop": both adapters take the same names.
- **Guides.** Vue next to React where a guide shows React: getting started,
  state, composition, collections, forms, overlays, server rendering,
  custom components.
- **`docs/api/index.md`**, the README and `docs/contributing/`: six
  packages, the layers, the adapter's tests.
- No new live demos: the demos run the custom elements.

## Changes outside the package

These need the owner's approval (AGENTS.md → Stop and ask the owner):

1. **A new dependency: `vue`**, a peer of `@uniaria/vue` (`^3.5.0`) and its
   development dependency (`^3.5.43`). It brings the server renderer and the
   runtime compiler; nothing else is added.
2. **`eslint.config.js`:** `vue/*` and `@uniaria/vue` join `FRAMEWORKS`, so
   the core can't import them (`vue` is already there).
3. **`.changeset/config.json`:** `@uniaria/vue` joins the `fixed` group, and
   a changeset releases it with the next minor version (0.2.0).
4. **`vitest.config.ts`**, only if the runtime compiler's build warns:
   defining Vue's compile-time flags (`__VUE_OPTIONS_API__`,
   `__VUE_PROD_DEVTOOLS__`, `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__`).
5. **AGENTS.md:** the packages table, the layers line and the rules that
   name both adapters (decision 2, the mount contract, testing) name Vue
   too.

Nothing changes in `tsconfig.core.json`, `types/host.d.ts`,
`pnpm-workspace.yaml` (its `packages/*` covers the package), `scripts/` or
`.github/`: CI picks the package up through the workspace. Before the
release that first ships `@uniaria/vue`, the npm name needs a placeholder
and a trusted publisher, which takes the owner's 2FA, as for 0.1.0.

## Delivery

One pull request (owner, 2026-10-21: bigger pull requests):

1. This spec, on its own commit, for review. Nothing else starts before the
   owner approves it.
2. The package: `useBehavior`, `useBehaviorState`, owners, with their
   tests.
3. The conformance adapter, every suite at phase 4.
4. Server rendering and hydration tests.
5. Documentation and the AGENTS.md changes.
6. The changeset.

No commit in it touches `conformance/`. If a scenario fails in Vue only, the
adapter is wrong; if it looks wrong for Vue, I stop and describe it.

## Not included

- **`v-model` sugar** (a `useModel`-style helper). `defineModel()` covers it
  in two lines; add it if the docs show the same lines everywhere.
- **Vue components per UniAria component** (`<UniButton>`). The adapter
  stays generic, as the React one does.
- **A Nuxt module.** Nothing needs registering.
- **Vapor mode.** Vue 3.6 is a release candidate. Its Vapor components skip
  the virtual DOM, so `v-bind` objects and refs may behave differently.
  Revisit when 3.6 is stable.
- **A comparison with a Vue library** like the one with React Aria. It
  would need another dependency, and the render counts already test the
  claim.

## Resolved questions

The owner took every recommendation (2026-10-21).

1. **Props forms.** A getter, a ref, the component's `defineProps()` or a
   plain object. A getter only would make wrappers write
   `() => ({ ...props })`.
2. **Owners.** `useBehavior` provides its instance automatically; there is
   no `provideOwner()`. Provided instances are matched by definition, so
   providing one no descendant asks for changes nothing.
3. **Docs scope.** A Vue tab beside every React tab, in the same pull
   request, since writing every example in Vue is part of the test.
4. **Template tests.** Vue's runtime compiler, with no new dependency, not
   `@vitejs/plugin-vue`.
