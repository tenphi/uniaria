/**
 * `@uniaria/elements/checkbox-group` — registers `<uni-checkbox-group>`
 * on import. The `<uni-checkbox>` elements inside it, or naming its id in
 * their `group` attribute, are its checkboxes; those checked in the markup
 * make its default value.
 *
 * ```html
 * <uni-checkbox-group required>
 *   <div data-part="root">
 *     <span data-part="label">Notifications</span>
 *     <uni-checkbox value="email">
 *       <label data-part="root">
 *         <input data-part="input" type="checkbox" name="notify" checked />
 *         <span data-part="label">Email</span>
 *       </label>
 *     </uni-checkbox>
 *   </div>
 * </uni-checkbox-group>
 * ```
 */

import { checkboxGroup } from '@uniaria/core/checkbox-group';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniCheckboxGroupElement = UniElement<typeof checkboxGroup>;

export const UniCheckboxGroup = defineElement(checkboxGroup);

declare global {
  interface HTMLElementTagNameMap {
    'uni-checkbox-group': UniCheckboxGroupElement;
  }
}
