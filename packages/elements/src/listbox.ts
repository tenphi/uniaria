/**
 * `@uniaria/elements/listbox` — registers `<uni-listbox>` on import. Its
 * options and groups are the consumer's elements, keyed by `data-key`;
 * without an `items` property it reads them from the markup, the text from
 * `data-text-value` or the option's own. Disabled options go in
 * `disabled-keys`.
 *
 * ```html
 * <uni-listbox selection-mode="multiple" disabled-keys='["cherry"]'>
 *   <span data-part="label">Fruit</span>
 *   <div data-part="list">
 *     <div data-part="option" data-key="apple">Apple</div>
 *     <div data-part="option" data-key="cherry">Cherry</div>
 *     <div data-part="group" data-key="citrus">
 *       <span data-part="groupLabel" data-key="citrus">Citrus</span>
 *       <div data-part="option" data-key="lemon">Lemon</div>
 *     </div>
 *   </div>
 *   <p data-part="empty">No fruit</p>
 * </uni-listbox>
 * ```
 */

import { listbox } from '@uniaria/core/listbox';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniListboxElement = UniElement<typeof listbox>;

export const UniListbox = defineElement(listbox);

declare global {
  interface HTMLElementTagNameMap {
    'uni-listbox': UniListboxElement;
  }
}
