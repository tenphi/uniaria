/**
 * `@tenphi/sous/dom` — the in-house interaction layer and the DOM plumbing
 * both adapters share: the binder that writes part attributes without
 * re-rendering, part discovery for custom elements, and interactions.
 *
 * Built: the binder, part discovery, press, focus and focus-visible, hover,
 * the shared input-modality tracker, focus-within, focus scopes, the
 * focusable/tabbable rules, the live announcer, outside interaction and the
 * dismissable layer stack. Planned: aria-hidden outside, scroll lock, owner
 * lookup, and positioning (CSS anchor positioning with the Floating UI
 * fallback behind one wrapper).
 *
 * Nothing here may touch `document` or `window` at module scope.
 */

export { announce, clearAnnouncer, destroyAnnouncer } from './announcer';
export type {
  AnnounceOptions,
  AnnouncerMessage,
  Politeness,
} from './announcer';
export { createBinder } from './binder';
export { isDevelopment, warn } from './dev';
export type { Binder, BinderOptions } from './binder';
export { createFocus } from './focus';
export type { Focus, FocusOptions } from './focus';
export { createFocusScope } from './focus-scope';
export type { FocusScopeOptions } from './focus-scope';
export { createFocusWithin } from './focus-within';
export type { FocusWithin, FocusWithinOptions } from './focus-within';
export {
  firstFocusable,
  focusableWalker,
  isFocusable,
  isTabbable,
  lastFocusable,
} from './focusable';
export type { FocusableOptions } from './focusable';
export { createHover } from './hover';
export type { Hover, HoverOptions } from './hover';
export {
  isFocusVisibleKey,
  modalityTracker,
  modalityTrackerFor,
} from './modality';
export type { Modality, ModalityEvent, ModalityTracker } from './modality';
export { interactOutside } from './interact-outside';
export type { InteractOutsideHandlers } from './interact-outside';
export { createLayer } from './layers';
export type { DismissReason, LayerOptions } from './layers';
export { observeParts, queryParts } from './parts';
export { createPress, isVirtualClick } from './press';
export type { PointerType, Press, PressEvent, PressOptions } from './press';
export { mergeHandlers, partEffect, partElement } from './types';
export type { DomHandlers, DomPartProps, InteractionContext } from './types';
