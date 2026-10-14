/**
 * `@tenphi/sous/dom` — the in-house interaction layer and the DOM plumbing
 * both adapters share: the binder that writes part attributes without
 * re-rendering, part discovery for custom elements, and interactions.
 *
 * Phase 1 ships the binder, part discovery, press (keyboard, mouse, virtual
 * clicks, disabled) and focus state. Planned: focus-visible, hover, focus
 * scope, the dismissable layer stack, outside interaction, aria-hidden
 * outside, scroll lock, live announcer, typeahead, owner lookup, and
 * positioning (CSS anchor positioning with the Floating UI fallback behind
 * one wrapper).
 *
 * Nothing here may touch `document` or `window` at module scope.
 */

export { createBinder } from './binder';
export { isDevelopment, warn } from './dev';
export type { Binder, BinderOptions } from './binder';
export { createFocus } from './focus';
export type { Focus } from './focus';
export { observeParts, queryParts } from './parts';
export { createPress, isVirtualClick } from './press';
export type { PointerType, Press, PressEvent, PressOptions } from './press';
export { partElement } from './types';
export type { DomHandlers, DomPartProps, InteractionContext } from './types';
