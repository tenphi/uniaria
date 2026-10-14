/**
 * `@tenphi/sous/dom` — the in-house interaction layer and the DOM plumbing
 * both adapters share: the binder that writes part attributes without
 * re-rendering, part discovery for custom elements, and interactions.
 *
 * Built: the binder, part discovery, press, focus and focus-visible, hover,
 * and the shared input-modality tracker. Planned: focus scope, the
 * dismissable layer stack, outside interaction, aria-hidden outside, scroll
 * lock, live announcer, typeahead, owner lookup, and positioning (CSS anchor
 * positioning with the Floating UI fallback behind one wrapper).
 *
 * Nothing here may touch `document` or `window` at module scope.
 */

export { createBinder } from './binder';
export { isDevelopment, warn } from './dev';
export type { Binder, BinderOptions } from './binder';
export { createFocus } from './focus';
export type { Focus, FocusOptions } from './focus';
export { createHover } from './hover';
export type { Hover, HoverOptions } from './hover';
export {
  isFocusVisibleKey,
  modalityTracker,
  modalityTrackerFor,
} from './modality';
export type { Modality, ModalityEvent, ModalityTracker } from './modality';
export { observeParts, queryParts } from './parts';
export { createPress, isVirtualClick } from './press';
export type { PointerType, Press, PressEvent, PressOptions } from './press';
export { mergeHandlers, partEffect, partElement } from './types';
export type { DomHandlers, DomPartProps, InteractionContext } from './types';
