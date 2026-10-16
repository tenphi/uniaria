/**
 * `@uniaria/elements/checkbox` — registers `<uni-checkbox>` on import.
 * The input's markup `checked`, or a click before upgrade, becomes the
 * default.
 *
 * ```html
 * <uni-checkbox required>
 *   <label data-part="root">
 *     <input data-part="input" type="checkbox" name="terms" />
 *     <span data-part="indicator"></span>
 *     <span data-part="label">Accept the terms</span>
 *   </label>
 *   <p data-part="error" hidden>You must accept to continue</p>
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
