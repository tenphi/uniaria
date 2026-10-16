/**
 * `@tenphi/sous-elements/popover` — registers `<sous-popover>` on import. It
 * wraps the trigger and the popover. `non-modal` keeps the page exposed;
 * `dismissable="false"`, `restore-focus="false"` and `flip="false"` turn off
 * what is on by default. `shouldCloseOnInteractOutside` is a property only.
 *
 * ```html
 * <sous-popover placement="bottom start">
 *   <button data-part="trigger">Size</button>
 *   <div data-part="root">
 *     <div data-part="arrow"></div>
 *     <label>Width <input /></label>
 *     <button data-part="close">Apply</button>
 *   </div>
 * </sous-popover>
 * ```
 */

import { popover } from '@tenphi/sous/popover';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousPopoverElement = SousElement<typeof popover>;

export const SousPopover = defineElement(popover);

declare global {
  interface HTMLElementTagNameMap {
    'sous-popover': SousPopoverElement;
  }
}
