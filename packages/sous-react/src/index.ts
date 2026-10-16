/**
 * `@tenphi/sous-react` — the React adapter (design decisions 2, 4 and 9).
 *
 * `useComponent(definition, props)` renders any Sous definition: spread
 * `ui.parts.<name>` onto each part element. Internal state never re-renders
 * the component; the DOM binder writes it to the elements. Read state only
 * where the render needs it, with `useComponentState(ui, selector)`. No
 * component-specific code belongs in this package.
 */

export { OwnerProvider } from './owner';
export type { OwnerProviderProps } from './owner';
export { useComponent, useComponentState } from './use-component';
export type { ComponentHandle, ReactPartProps } from './use-component';
