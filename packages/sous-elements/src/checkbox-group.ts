/**
 * `@tenphi/sous-elements/checkbox-group` — registers `<sous-checkbox-group>`
 * on import. The `<sous-checkbox>` elements inside it, or naming its id in
 * their `group` attribute, are its checkboxes; those checked in the markup
 * make its default value.
 *
 * ```html
 * <sous-checkbox-group required>
 *   <div data-part="root">
 *     <span data-part="label">Notifications</span>
 *     <sous-checkbox value="email">
 *       <label data-part="root">
 *         <input data-part="input" type="checkbox" name="notify" checked />
 *         <span data-part="label">Email</span>
 *       </label>
 *     </sous-checkbox>
 *   </div>
 * </sous-checkbox-group>
 * ```
 */

import { checkboxGroup } from '@tenphi/sous/checkbox-group';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousCheckboxGroupElement = SousElement<typeof checkboxGroup>;

export const SousCheckboxGroup = defineElement(checkboxGroup);

declare global {
  interface HTMLElementTagNameMap {
    'sous-checkbox-group': SousCheckboxGroupElement;
  }
}
