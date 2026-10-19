/**
 * `@uniaria/elements/number-field` — registers `<uni-number-field>` on
 * import. The input's markup text, or text typed before upgrade, parsed for
 * the field's language, becomes the default. Put `name` on the hidden input
 * part, so the form gets the number rather than the formatted text.
 *
 * ```html
 * <uni-number-field min-value="0" max-value="99" lang="de">
 *   <label data-element="Label">Menge</label>
 *   <input data-element="Input" value="5" />
 *   <button data-element="Decrement">−</button>
 *   <button data-element="Increment">+</button>
 *   <input type="hidden" data-element="HiddenInput" name="quantity" />
 * </uni-number-field>
 * ```
 */

import { numberField } from '@uniaria/core/number-field';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniNumberFieldElement = UniElement<typeof numberField>;

export const UniNumberField = defineElement(numberField);

declare global {
  interface HTMLElementTagNameMap {
    'uni-number-field': UniNumberFieldElement;
  }
}
