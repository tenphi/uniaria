/**
 * `@uniaria/elements/popover` — registers `<uni-popover>` on import. It
 * wraps the trigger and the popover. `non-modal` keeps the page exposed;
 * `dismissable="false"` and `restore-focus="false"` turn off what is on by
 * default; `position-area` and `position-try-fallbacks` take CSS values
 * and place it in script mode, the default (`configure` in
 * `@uniaria/core/dom`; in CSS mode the page's CSS places it).
 * `shouldCloseOnInteractOutside` is a property only.
 *
 * ```html
 * <uni-popover position-area="bottom span-right">
 *   <button data-uni-part="popover-trigger">Size</button>
 *   <div data-uni="popover">
 *     <div data-element="Arrow"></div>
 *     <label>Width <input /></label>
 *     <button data-element="Close">Apply</button>
 *   </div>
 * </uni-popover>
 * ```
 */

import { popover } from '@uniaria/core/popover';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniPopoverElement = UniElement<typeof popover>;

export const UniPopover = defineElement(popover);

declare global {
  interface HTMLElementTagNameMap {
    'uni-popover': UniPopoverElement;
  }
}
