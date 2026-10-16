/**
 * `@uniaria/core/dom` — the in-house interaction layer and the DOM plumbing
 * both adapters share: the binder that writes part attributes without
 * re-rendering, part discovery for custom elements, and interactions.
 *
 * Built: the binder, part discovery, press, focus and focus-visible, hover,
 * the shared input-modality tracker, focus-within, focus scopes, the
 * focusable/tabbable rules, the live announcer, outside interaction, the
 * dismissable layer stack, hiding everything outside a modal, scroll lock
 * (iOS strategy pending), presence (enter and exit phases), positioning (CSS
 * anchor positioning with the Floating UI fallback behind one wrapper) and
 * feature detection with the development switch for fallbacks. Planned:
 * owner lookup.
 *
 * Nothing here may touch `document` or `window` at module scope.
 */

export {
  announce,
  clearAnnouncer,
  destroyAnnouncer,
  hostAnnouncer,
} from './announcer';
export type {
  AnnounceOptions,
  AnnouncerMessage,
  Politeness,
} from './announcer';
export { createBinder } from './binder';
export { isComposing } from './events';
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
export { hideOutside, keepVisible } from './hide-outside';
export type { HideOutsideOptions } from './hide-outside';
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
export { createLayer, isTopLayer } from './layers';
export type { DismissReason, Layer, LayerOptions } from './layers';
export { provideOwner, requestOwner } from './owner';
export { createPosition } from './position';
export type {
  Placement,
  PlacementSide,
  Position,
  PositionOptions,
} from './position';
export { UNI_HOST, observeParts, queryParts } from './parts';
export { createPresence } from './presence';
export type { Presence, PresenceOptions } from './presence';
export { createPress, isVirtualClick } from './press';
export { createScrollLock, lockScroll } from './scroll-lock';
export type { ScrollLockOptions } from './scroll-lock';
export type { PointerType, Press, PressEvent, PressOptions } from './press';
export { supportsAnchorPositioning, supportsPopover } from './support';
export { mergeHandlers, partEffect, partElement } from './types';
export type { DomHandlers, DomPartProps, InteractionContext } from './types';
