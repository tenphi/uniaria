/**
 * `@uniaria/elements/toggle-button` — registers `<uni-toggle-button>` on
 * import.
 *
 * ```html
 * <uni-toggle-button default-selected>
 *   <button data-part="root">Mute</button>
 * </uni-toggle-button>
 * ```
 */

import { toggleButton } from '@uniaria/core/toggle-button';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniToggleButtonElement = UniElement<typeof toggleButton>;

export const UniToggleButton = defineElement(toggleButton);

declare global {
  interface HTMLElementTagNameMap {
    'uni-toggle-button': UniToggleButtonElement;
  }
}
