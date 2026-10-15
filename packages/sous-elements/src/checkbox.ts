/**
 * `@tenphi/sous-elements/checkbox` — registers `<sous-checkbox>` on import.
 * The input's markup `checked`, or a click before upgrade, becomes the
 * default.
 *
 * ```html
 * <sous-checkbox required>
 *   <label data-part="root">
 *     <input data-part="input" type="checkbox" name="terms" />
 *     <span data-part="indicator"></span>
 *     <span data-part="label">Accept the terms</span>
 *   </label>
 *   <p data-part="error" hidden>You must accept to continue</p>
 * </sous-checkbox>
 * ```
 */

import { checkbox } from '@tenphi/sous/checkbox';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousCheckboxElement = SousElement<typeof checkbox>;

export const SousCheckbox = defineElement(checkbox);

declare global {
  interface HTMLElementTagNameMap {
    'sous-checkbox': SousCheckboxElement;
  }
}
