/**
 * `@uniaria/elements/combobox` — registers `<uni-combobox>` on import. Its
 * options and groups are the consumer's elements inside the popover, keyed
 * by `data-key`; without an `items` property it reads them from the markup,
 * as `<uni-listbox>`, and hides the options the filter leaves out with
 * `hidden`. UniAria writes the input's text and the hidden input's value.
 *
 * ```html
 * <uni-combobox required>
 *   <label data-element="Label">Fruit</label>
 *   <div data-element="Anchor">
 *     <input data-element="Input" />
 *     <button data-element="Button"><svg aria-hidden="true">…</svg></button>
 *   </div>
 *   <div data-element="Popover">
 *     <div data-element="List">
 *       <div data-element="Option" data-key="apple">Apple</div>
 *       <div data-element="Option" data-key="banana">Banana</div>
 *     </div>
 *     <p data-element="Empty">No fruit</p>
 *   </div>
 *   <input data-element="HiddenInput" name="fruit" />
 * </uni-combobox>
 * ```
 */

import { combobox } from '@uniaria/core/combobox';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniComboboxElement = UniElement<typeof combobox>;

// Annotated: inferred, its declaration has to name Popover's internal types,
// which the declaration build can't always reach (TS2883 in CI).
export const UniCombobox: UniElementConstructor<typeof combobox> | undefined =
  defineElement(combobox);

declare global {
  interface HTMLElementTagNameMap {
    'uni-combobox': UniComboboxElement;
  }
}
