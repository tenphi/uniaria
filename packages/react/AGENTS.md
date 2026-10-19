# AGENTS.md — @uniaria/react

Read the root [AGENTS.md](../../AGENTS.md) first, especially "No re-renders
for internal state". Local rules:

- One generic `useComponent(definition, props)` and one generic
  `useComponentState(instance, selector, isEqual?)`. No component-specific
  behavior here; optional sugar (`useButton`, `useButtonState`, JSX-children
  collections) only wraps them.
- Internal state never re-renders. Render part props from the current
  snapshot with a `ref`, and let the DOM binder from `@uniaria/core/dom` write
  later changes. `useSyncExternalStore` appears only inside
  `useComponentState`, with the selected value as the snapshot (cached per
  store version so it stays stable). It ignores the notification from the
  post-commit `sync()` when it already rendered the value that notification
  brings: React records the rendered snapshot only in a passive effect, so
  otherwise every prop change it reads would render twice.
- `OwnerProvider` provides an owner through a React context whose value
  never changes (the instance, never state). Children take an explicit
  `owner` prop first, then this context, then the DOM ancestor after mount.
- Handlers are stable wrappers that call the latest `connect()` handler with
  `event.nativeEvent`.
- Ids with `useId`. Call `setProps()` during render (silent) and
  `service.sync()` in a layout effect.
- Map neutral part props to React props: `focusin` → `onFocus`, `focusout` →
  `onBlur`, `input` → `onInput` (never `onChange`: a checkbox's fires on
  `click`, before a cancelled click is undone), `class` → `className`, `for`
  → `htmlFor`, `tabindex` → `tabIndex`.
- Warn in development when a consumer passes an attribute the binder owns
  (checked in the part's ref, against what React just rendered). A named
  part's `id` isn't one: the consumer's, after the spread, is kept, and the
  binder points every reference at it (root AGENTS.md → DOM, lifecycle and
  SSR). An item part's is.
- The conformance adapter renders a template's `id` after the part spread,
  as a consumer overriding the part's id writes it.
- Tests: render counts (zero for internal interactions), StrictMode (double
  mount), SSR + hydration.
- `src/conformance-adapter.tsx` implements the mount contract (inside
  StrictMode) and `src/conformance.browser.test.ts` runs every suite. Raise
  its `phase` as the roadmap advances, and register each new definition in
  the adapter's `definitions` map.
- `react` stays a peer dependency (`^18 || ^19`).
- `src/compare/` holds the comparison with React Aria: Button without
  shared state, Button reading all its state, a button from React Aria's
  hooks and a plain one. `compare.browser.test.tsx` requires the same state
  attributes and presses as React Aria at every step of one real-input
  script, and no UniAria render for interactions. `bench/` times them in a
  production build: `pnpm bench` rewrites `bench/results.md`, so commit it
  only when the run was on a quiet machine. `react-aria` is used nowhere
  else.
