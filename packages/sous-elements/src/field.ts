/**
 * `@tenphi/sous-elements/field` — registers `<sous-field>` on import. It
 * wires a label, a description and an error to a native or third-party
 * control; a Sous input has these parts itself.
 *
 * ```html
 * <sous-field required>
 *   <label data-part="label">Email</label>
 *   <input data-part="control" id="email" name="email" type="email" />
 *   <p data-part="description">We never share it</p>
 *   <p data-part="error" hidden>Enter a valid email</p>
 * </sous-field>
 * ```
 */

import { field } from '@tenphi/sous/field';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousFieldElement = SousElement<typeof field>;

export const SousField = defineElement(field);

declare global {
  interface HTMLElementTagNameMap {
    'sous-field': SousFieldElement;
  }
}
