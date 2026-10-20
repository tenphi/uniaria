/**
 * `@uniaria/elements/checkbox-group` — registers `<uni-checkbox-group>`
 * on import. The `<uni-checkbox>` elements inside it, or naming its id in
 * their `group` attribute, are its checkboxes; those checked in the markup
 * make its default value. Its label, description and error go inside the
 * root.
 *
 * ```html
 * <uni-checkbox-group required>
 *   <div data-uni="checkbox-group">
 *     <span data-element="Label">Notifications</span>
 *     <uni-checkbox value="email">
 *       <label data-uni="checkbox">
 *         <input data-element="Input" type="checkbox" name="notify" checked />
 *         <span data-element="Label">Email</span>
 *       </label>
 *     </uni-checkbox>
 *   </div>
 * </uni-checkbox-group>
 * ```
 */

import { checkboxGroup } from '@uniaria/core/checkbox-group';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniCheckboxGroupElement = UniElement<typeof checkboxGroup>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniCheckboxGroup:
  UniElementConstructor<typeof checkboxGroup> | undefined =
  defineElement(checkboxGroup);

declare global {
  interface HTMLElementTagNameMap {
    'uni-checkbox-group': UniCheckboxGroupElement;
  }
}
