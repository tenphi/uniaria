/**
 * `@uniaria/elements/combobox` — registers `<uni-combobox>` on import. Its
 * options and groups are the consumer's elements inside the popover, keyed
 * by `data-key`; without an `items` property it reads them from the markup,
 * as `<uni-listbox>`, and hides the options the filter leaves out with
 * `hidden`. UniAria writes the input's text and the hidden input's value.
 *
 * ```html
 * <uni-combobox required>
 *   <label data-part="label">Fruit</label>
 *   <div data-part="anchor">
 *     <input data-part="input" />
 *     <button data-part="button"><svg aria-hidden="true">…</svg></button>
 *   </div>
 *   <div data-part="popover">
 *     <div data-part="list">
 *       <div data-part="option" data-key="apple">Apple</div>
 *       <div data-part="option" data-key="banana">Banana</div>
 *     </div>
 *     <p data-part="empty">No fruit</p>
 *   </div>
 *   <input data-part="hiddenInput" name="fruit" />
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
