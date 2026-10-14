/**
 * `@tenphi/sous-react` — the React adapter (design decision 9).
 *
 * One generic `useComponent(definition, props)`: it binds the instance store
 * with `useSyncExternalStore`, generates ids with `useId`, calls `setProps()`
 * during render and `sync()` in a layout effect, and maps neutral part props to
 * React props (`focusin` → `onFocus`, `click` → `onClick`, handlers receive
 * `event.nativeEvent`). No component-specific code belongs in this package.
 */

export {};
