/**
 * `@uniaria/elements/checkbox` — registers `<uni-checkbox>` on import.
 * The input's markup `checked`, or a click before upgrade, becomes the
 * default. The description and the error go in the root, outside the `label`
 * wrapper; a checkbox without them can make the `label` its root.
 *
 * ```html
 * <uni-checkbox required>
 *   <div class="uni-checkbox">
 *     <label data-element="Wrapper">
 *       <input data-element="Input" type="checkbox" name="terms" />
 *       <span data-element="Indicator"></span>
 *       <span data-element="Label">Accept the terms</span>
 *     </label>
 *     <p data-element="Error" hidden>You must accept to continue</p>
 *   </div>
 * </uni-checkbox>
 * ```
 */

import { checkbox } from '@uniaria/core/checkbox';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniCheckboxElement = UniElement<typeof checkbox>;

export const UniCheckbox = defineElement(checkbox);

declare global {
  interface HTMLElementTagNameMap {
    'uni-checkbox': UniCheckboxElement;
  }
}
