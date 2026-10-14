# AGENTS.md — @tenphi/sous-react

Read the root [AGENTS.md](../../AGENTS.md) first. Local rules:

- One generic `useComponent(definition, props)`. No component-specific
  behavior here; optional sugar (such as JSX-children collections) only wraps
  core APIs.
- Bind the store with `useSyncExternalStore`, ids with `useId`. Call
  `setProps()` during render (silent) and `service.sync()` in a layout effect.
- Map neutral part props to React props: `focusin` → `onFocus`, `focusout` →
  `onBlur`, `input` → `onChange`, `class` → `className`, `for` → `htmlFor`,
  `tabindex` → `tabIndex`. Handlers receive `event.nativeEvent`.
- Must work under StrictMode (double mount) and with SSR + hydration; both
  get dedicated tests.
- `react` stays a peer dependency (`^18 || ^19`).
