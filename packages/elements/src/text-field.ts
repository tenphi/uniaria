/**
 * `@uniaria/elements/text-field` — registers `<uni-text-field>` on
 * import. The input can be an `<input>` or a `<textarea>`; its markup value,
 * or text typed before upgrade, becomes the default.
 *
 * ```html
 * <uni-text-field required>
 *   <label data-part="label">Email</label>
 *   <input data-part="input" name="email" type="email" />
 *   <p data-part="error" hidden>Enter a valid email</p>
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
