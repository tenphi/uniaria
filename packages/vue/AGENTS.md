# AGENTS.md — @uniaria/vue

Read the root [AGENTS.md](../../AGENTS.md) first, especially "No re-renders
for internal state", and this package's [spec](./spec.md). Local rules:

- One generic `useComponent(definition, props)` and one generic
  `useComponentState(source, selector, isEqual?)`, called in `setup()`. No
  component-specific behavior here, and no Vue component per UniAria
  component.
- Internal state never renders. `parts` and `getItemProps` read the current
  `connect()` when the render reads them; the store isn't reactive, so that
  subscribes the render to nothing. `useComponentState` is the only way a
  render follows state: a `customRef` that reads the state when read and
  triggers only when the store's notification changes the value a render
  last read, so a prop change renders once.
- Props come as a getter, a ref, a reactive object (`defineProps()`) or a
  plain object read once. A pre-flush watcher calls `setProps()` before the
  render; `sync()` runs after the patch (`queuePostFlushCb`).
- Vue calls a function ref during the patch, before the element is in the
  document on first mount, and again on every patch. Refs only record the
  element; the adapter hands it to the binder after the patch, in one batch,
  and never a detached element from a patch.
- Lifecycle: `onMounted` and `onActivated` start (one batch for
  `instance.start()` and `binder.start()`), `onDeactivated` and
  `onBeforeUnmount` stop, while the elements are still in the document.
- Every `useComponent` provides its instance (`provide()`, never state) and
  finds its owner during setup: the `owner` prop, then the nearest provided
  instance, then the DOM after mount. It also answers DOM requests for its
  owner parts.
- Map neutral part props to Vue props: attribute names and values as they
  are, events as `on` + the capitalized DOM name (`onKeydown`,
  `onFocusin`), `style` as it is, and live `value` and `checked` as
  `^value` and `^checked` from the first render only, so Vue never controls
  an input.
- Warn in development when the template, or a parent's fallthrough
  attributes, wrote an attribute the binder owns, checked when the element
  reaches the binder. A named part's `id` isn't one.
- The handle and the instance are `markRaw`.
- Tests: render counts (zero for internal interactions), every props form,
  `<KeepAlive>`, `<Teleport>`, SSR + hydration, and compiled templates with
  Vue's runtime compiler (`vue/dist/vue.esm-bundler.js`) instead of a Vite
  plugin. Several apps on one page need their own `app.config.idPrefix`,
  since `useId()` counts per app.
- `src/conformance-adapter.ts` implements the mount contract and
  `src/conformance.browser.test.ts` runs every suite. Raise its `phase` as
  the roadmap advances, and register each new definition in the adapter's
  `definitions` map, as in React's.
- `vue` stays a peer dependency (`^3.5.0`: `useId()`).
