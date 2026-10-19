/**
 * `@uniaria/elements/radio-group` — registers `<uni-radio-group>` on
 * import. Its radios are `<uni-radio>` elements
 * (`@uniaria/elements/radio`); the one whose input is checked in the
 * markup gives the default.
 *
 * ```html
 * <uni-radio-group name="plan" required>
 *   <div class="uni-radio-group">
 *     <span data-element="Label">Plan</span>
 *     <uni-radio value="free">
 *       <label class="uni-radio">
 *         <input data-element="Input" type="radio" />
 *         <span data-element="Label">Free</span>
 *       </label>
 *     </uni-radio>
 *   </div>
 * </uni-radio-group>
 * ```
 */

import { radioGroup } from '@uniaria/core/radio-group';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniRadioGroupElement = UniElement<typeof radioGroup>;

export const UniRadioGroup = defineElement(radioGroup);

declare global {
  interface HTMLElementTagNameMap {
    'uni-radio-group': UniRadioGroupElement;
  }
}
