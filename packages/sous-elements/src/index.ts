/**
 * `@tenphi/sous-elements` — the custom-elements adapter (design decisions 8
 * and 10).
 *
 * One generic `defineElement(definition, options)` that registers a light-DOM
 * element (no shadow root, `sous-` prefix by default). Element classes are
 * created inside `defineElement()`, never at module scope, so this package
 * imports in Node without a DOM. No component-specific code belongs here
 * beyond the per-component registering entries.
 */

export {};
