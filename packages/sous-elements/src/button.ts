/**
 * `@tenphi/sous-elements/button` — registers `<sous-button>` on import.
 *
 * ```html
 * <sous-button focusable-when-disabled>
 *   <button data-part="root">Save</button>
 * </sous-button>
 * ```
 */

import { button } from '@tenphi/sous/button';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousButtonElement = SousElement<typeof button>;

export const SousButton = defineElement(button);

declare global {
  interface HTMLElementTagNameMap {
    'sous-button': SousButtonElement;
  }
}
