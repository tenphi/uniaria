/**
 * `@uniaria/elements/radio` — registers `<uni-radio>` on import: one
 * option of a `<uni-radio-group>` (`@uniaria/elements/radio-group`),
 * inside it or linked by its id through the `group` attribute. With a
 * description, the root holds it and a `label` wrapper, as on
 * `<uni-checkbox>`.
 *
 * ```html
 * <uni-radio value="pro">
 *   <label data-uni="radio">
 *     <input data-element="Input" type="radio" />
 *     <span data-element="Indicator"></span>
 *     <span data-element="Label">Pro</span>
 *   </label>
 * </uni-radio>
 * ```
 */

import { radio } from '@uniaria/core/radio';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniRadioElement = UniElement<typeof radio>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniRadio: UniElementConstructor<typeof radio> | undefined =
  defineElement(radio);

declare global {
  interface HTMLElementTagNameMap {
    'uni-radio': UniRadioElement;
  }
}
