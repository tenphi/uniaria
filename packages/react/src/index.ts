/**
 * `@uniaria/react` — the React adapter (design decisions 2, 4 and 9).
 *
 * `useBehavior(definition, props)` renders any UniAria definition: spread
 * `ui.parts.<name>` onto each part element. Internal state never re-renders
 * the component; the DOM binder writes it to the elements. Read state only
 * where the render needs it, with `useBehaviorState(ui, selector)`. No
 * component-specific code belongs in this package.
 */

export { OwnerProvider } from './owner';
export type { OwnerProviderProps } from './owner';
export { useBehavior, useBehaviorState } from './use-behavior';
export type { BehaviorHandle, ReactPartProps } from './use-behavior';
