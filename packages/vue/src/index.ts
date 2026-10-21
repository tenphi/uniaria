/**
 * `@uniaria/vue` — the Vue adapter (design decisions 2, 4 and 9, Vue adapter
 * spec).
 *
 * `useComponent(definition, props)` renders any UniAria definition: bind
 * `ui.parts.<name>` onto each part element with `v-bind`. Internal state
 * never re-renders the component; the DOM binder writes it to the elements.
 * Read state only where the render needs it, with
 * `useComponentState(ui, selector)`. Owners are provided automatically. No
 * component-specific code belongs in this package.
 */

export { useComponent } from './use-component';
export type {
  ComponentHandle,
  ComponentProps,
  VuePartProps,
} from './use-component';
export { useComponentState } from './use-component-state';
