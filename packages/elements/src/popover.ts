/**
 * `@uniaria/elements/popover` — registers `<uni-popover>` on import. It
 * wraps the trigger and the popover. `non-modal` keeps the page exposed;
 * `dismissable="false"`, `restore-focus="false"` and `flip="false"` turn off
 * what is on by default. `shouldCloseOnInteractOutside` is a property only.
 *
 * ```html
 * <uni-popover placement="bottom start">
 *   <button data-part="trigger">Size</button>
 *   <div data-part="root">
 *     <div data-part="arrow"></div>
 *     <label>Width <input /></label>
 *     <button data-part="close">Apply</button>
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
