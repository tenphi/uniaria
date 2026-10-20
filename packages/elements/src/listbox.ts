/**
 * `@uniaria/elements/listbox` — registers `<uni-listbox>` on import. Its
 * options and groups are the consumer's elements, keyed by `data-key`;
 * without an `items` property it reads them from the markup, the text from
 * `data-text-value` or the option's own. Disabled options go in
 * `disabled-keys`.
 *
 * ```html
 * <uni-listbox selection-mode="multiple" disabled-keys='["cherry"]'>
 *   <span data-element="Label">Fruit</span>
 *   <div data-element="List">
 *     <div data-element="Option" data-key="apple">Apple</div>
 *     <div data-element="Option" data-key="cherry">Cherry</div>
 *     <div data-element="Group" data-key="citrus">
 *       <span data-element="GroupLabel" data-key="citrus">Citrus</span>
 *       <div data-element="Option" data-key="lemon">Lemon</div>
 *     </div>
 *   </div>
 *   <p data-element="Empty">No fruit</p>
 * </uni-listbox>
 * ```
 */

import { listbox } from '@uniaria/core/listbox';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniListboxElement = UniElement<typeof listbox>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniListbox: UniElementConstructor<typeof listbox> | undefined =
  defineElement(listbox);

declare global {
  interface HTMLElementTagNameMap {
    'uni-listbox': UniListboxElement;
  }
}
