/**
 * `@uniaria/elements` — the custom-elements adapter (design decisions 8
 * and 10).
 *
 * One generic `defineElement(definition, options)` that registers a light-DOM
 * element (no shadow root, `uni-` prefix by default). Element classes are
 * created inside `defineElement()`, never at module scope, so this package
 * imports in Node without a DOM. Each component has a registering entry
 * (`@uniaria/elements/button`); no other component-specific code belongs
 * here.
 */

export { defineElement } from './define-element';
export type {
  DefineElementOptions,
  ElementProperties,
  UniElement,
  UniElementConstructor,
} from './define-element';
