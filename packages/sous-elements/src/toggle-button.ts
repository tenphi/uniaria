/**
 * `@tenphi/sous-elements/toggle-button` — registers `<sous-toggle-button>` on
 * import.
 *
 * ```html
 * <sous-toggle-button default-selected>
 *   <button data-part="root">Mute</button>
 * </sous-toggle-button>
 * ```
 */

import { toggleButton } from '@tenphi/sous/toggle-button';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousToggleButtonElement = SousElement<typeof toggleButton>;

export const SousToggleButton = defineElement(toggleButton);

declare global {
  interface HTMLElementTagNameMap {
    'sous-toggle-button': SousToggleButtonElement;
  }
}
