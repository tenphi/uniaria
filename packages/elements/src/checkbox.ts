/**
 * `@uniaria/elements/checkbox` — registers `<uni-checkbox>` on import.
 * The input's markup `checked`, or a click before upgrade, becomes the
 * default.
 *
 * ```html
 * <uni-checkbox required>
 *   <label class="uni-checkbox">
 *     <input data-element="Input" type="checkbox" name="terms" />
 *     <span data-element="Indicator"></span>
 *     <span data-element="Label">Accept the terms</span>
 *   </label>
 *   <p data-element="Error" hidden>You must accept to continue</p>
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
