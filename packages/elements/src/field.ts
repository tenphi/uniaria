/**
 * `@uniaria/elements/field` — registers `<uni-field>` on import. It
 * wires a label, a description and an error to a native or third-party
 * control; a UniAria input has these parts itself.
 *
 * ```html
 * <uni-field required>
 *   <label data-part="label">Email</label>
 *   <input data-part="control" id="email" name="email" type="email" />
 *   <p data-part="description">We never share it</p>
 *   <p data-part="error" hidden>Enter a valid email</p>
 * </uni-field>
 * ```
 */

import { field } from '@uniaria/core/field';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniFieldElement = UniElement<typeof field>;

export const UniField = defineElement(field);

declare global {
  interface HTMLElementTagNameMap {
    'uni-field': UniFieldElement;
  }
}
