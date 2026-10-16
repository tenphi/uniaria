/**
 * `@tenphi/sous-elements/radio-group` — registers `<sous-radio-group>` on
 * import. Its radios are `<sous-radio>` elements
 * (`@tenphi/sous-elements/radio`); the one whose input is checked in the
 * markup gives the default.
 *
 * ```html
 * <sous-radio-group name="plan" required>
 *   <div data-part="root">
 *     <span data-part="label">Plan</span>
 *     <sous-radio value="free">
 *       <label data-part="root">
 *         <input data-part="input" type="radio" />
 *         <span data-part="label">Free</span>
 *       </label>
 *     </sous-radio>
 *   </div>
 * </sous-radio-group>
 * ```
 */

import { radioGroup } from '@tenphi/sous/radio-group';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousRadioGroupElement = SousElement<typeof radioGroup>;

export const SousRadioGroup = defineElement(radioGroup);

declare global {
  interface HTMLElementTagNameMap {
    'sous-radio-group': SousRadioGroupElement;
  }
}
