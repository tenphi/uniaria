/**
 * `@uniaria/elements/toggle-button` — registers `<uni-toggle-button>` on
 * import.
 *
 * ```html
 * <uni-toggle-button default-selected>
 *   <button data-uni="toggle-button">Mute</button>
 * </uni-toggle-button>
 * ```
 */

import { toggleButton } from '@uniaria/core/toggle-button';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniToggleButtonElement = UniElement<typeof toggleButton>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniToggleButton:
  UniElementConstructor<typeof toggleButton> | undefined =
  defineElement(toggleButton);

declare global {
  interface HTMLElementTagNameMap {
    'uni-toggle-button': UniToggleButtonElement;
  }
}
