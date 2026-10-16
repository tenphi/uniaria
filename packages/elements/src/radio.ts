/**
 * `@uniaria/elements/radio` — registers `<uni-radio>` on import: one
 * option of a `<uni-radio-group>` (`@uniaria/elements/radio-group`),
 * inside it or linked by its id through the `group` attribute.
 *
 * ```html
 * <uni-radio value="pro">
 *   <label data-part="root">
 *     <input data-part="input" type="radio" />
 *     <span data-part="indicator"></span>
 *     <span data-part="label">Pro</span>
 *   </label>
 * </uni-radio>
 * ```
 */

import { radio } from '@uniaria/core/radio';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniRadioElement = UniElement<typeof radio>;

export const UniRadio = defineElement(radio);

declare global {
  interface HTMLElementTagNameMap {
    'uni-radio': UniRadioElement;
  }
}
