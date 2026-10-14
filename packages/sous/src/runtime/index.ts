/**
 * The DOM-free runtime: store, bindable values, `defineComponent`, the opt-in
 * statechart helper and the test instance. Compiled without the DOM lib
 * (`tsconfig.core.json`).
 */

export { createStore } from './store';
export type { Store } from './store';
