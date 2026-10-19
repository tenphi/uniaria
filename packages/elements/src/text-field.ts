/**
 * `@uniaria/elements/text-field` — registers `<uni-text-field>` on
 * import. The input can be an `<input>` or a `<textarea>`; its markup value,
 * or text typed before upgrade, becomes the default.
 *
 * ```html
 * <uni-text-field required>
 *   <label data-element="Label">Email</label>
 *   <input data-element="Input" name="email" type="email" />
 *   <p data-element="Error" hidden>Enter a valid email</p>
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
