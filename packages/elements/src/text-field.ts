/**
 * `@uniaria/elements/text-field` — registers `<uni-text-field>` on
 * import. The input can be an `<input>` or a `<textarea>`; its markup value,
 * or text typed before upgrade, becomes the default. The root and the wrapper,
 * the box around the input, are optional.
 *
 * ```html
 * <uni-text-field required>
 *   <div class="uni-text-field">
 *     <label data-element="Label">Email</label>
 *     <div data-element="Wrapper">
 *       <input data-element="Input" name="email" type="email" />
 *     </div>
 *     <p data-element="Error" hidden>Enter a valid email</p>
 *   </div>
 * </uni-text-field>
 * ```
 */

import { textField } from '@uniaria/core/text-field';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniTextFieldElement = UniElement<typeof textField>;

export const UniTextField = defineElement(textField);

declare global {
  interface HTMLElementTagNameMap {
    'uni-text-field': UniTextFieldElement;
  }
}
