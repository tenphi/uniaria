/**
 * `@tenphi/sous-elements/text-field` — registers `<sous-text-field>` on
 * import. The input can be an `<input>` or a `<textarea>`; its markup value,
 * or text typed before upgrade, becomes the default.
 *
 * ```html
 * <sous-text-field required>
 *   <label data-part="label">Email</label>
 *   <input data-part="input" name="email" type="email" />
 *   <p data-part="error" hidden>Enter a valid email</p>
 * </sous-text-field>
 * ```
 */

import { textField } from '@tenphi/sous/text-field';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousTextFieldElement = SousElement<typeof textField>;

export const SousTextField = defineElement(textField);

declare global {
  interface HTMLElementTagNameMap {
    'sous-text-field': SousTextFieldElement;
  }
}
