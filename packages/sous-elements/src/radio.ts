/**
 * `@tenphi/sous-elements/radio` — registers `<sous-radio>` on import: one
 * option of a `<sous-radio-group>` (`@tenphi/sous-elements/radio-group`),
 * inside it or linked by its id through the `group` attribute.
 *
 * ```html
 * <sous-radio value="pro">
 *   <label data-part="root">
 *     <input data-part="input" type="radio" />
 *     <span data-part="indicator"></span>
 *     <span data-part="label">Pro</span>
 *   </label>
 * </sous-radio>
 * ```
 */

import { radio } from '@tenphi/sous/radio';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousRadioElement = SousElement<typeof radio>;

export const SousRadio = defineElement(radio);

declare global {
  interface HTMLElementTagNameMap {
    'sous-radio': SousRadioElement;
  }
}
