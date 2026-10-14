# AGENTS.md — @tenphi/sous-react

Read the root [AGENTS.md](../../AGENTS.md) first, especially "No re-renders
for internal state". Local rules:

- One generic `useComponent(definition, props)` and one generic
  `useComponentState(instance, selector, isEqual?)`. No component-specific
  behavior here; optional sugar (`useButton`, `useButtonState`, JSX-children
  collections) only wraps them.
- Internal state never re-renders. Render part props from the current
  snapshot with a `ref`, and let the DOM binder from `@tenphi/sous/dom` write
  later changes. `useSyncExternalStore` appears only inside
  `useComponentState`, with the selected value as the snapshot (cached per
  store version so it stays stable).
- `useComponent` provides its instance through a React context whose value
  never changes (the instance, never state). Children take an explicit
  `owner` prop first, then this context, then the DOM ancestor after mount.
- Handlers are stable wrappers that call the latest `connect()` handler with
  `event.nativeEvent`.
- Ids with `useId`. Call `setProps()` during render (silent) and
  `service.sync()` in a layout effect.
- Map neutral part props to React props: `focusin` → `onFocus`, `focusout` →
  `onBlur`, `input` → `onChange`, `class` → `className`, `for` → `htmlFor`,
  `tabindex` → `tabIndex`.
- Warn in development when a consumer passes an attribute the binder owns.
- Tests: render counts (zero for internal interactions), StrictMode (double
  mount), SSR + hydration.
- `react` stays a peer dependency (`^18 || ^19`).
