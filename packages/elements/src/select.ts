/**
 * `@uniaria/elements/select` — registers `<uni-select>` on import. Its
 * options and groups are the consumer's elements inside the popover, keyed
 * by `data-key`; without an `items` property it reads them from the markup,
 * as `<uni-listbox>`. UniAria writes the value part's text and the hidden
 * `<select>`'s options.
 *
 * ```html
 * <uni-select placeholder="Pick a fruit" required>
 *   <span data-part="label">Fruit</span>
 *   <button data-part="trigger">
 *     <span data-part="value"></span>
 *     <svg aria-hidden="true">…</svg>
 *   </button>
 *   <div data-part="popover">
 *     <div data-part="list">
 *       <div data-part="option" data-key="apple">Apple</div>
 *       <div data-part="option" data-key="banana">Banana</div>
 *     </div>
 *     <p data-part="empty">No fruit</p>
 *   </div>
 *   <select data-part="hiddenSelect" name="fruit"></select>
 * </uni-select>
 * ```
 */

import { select } from '@uniaria/core/select';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniSelectElement = UniElement<typeof select>;

export const UniSelect = defineElement(select);

declare global {
  interface HTMLElementTagNameMap {
    'uni-select': UniSelectElement;
  }
}
