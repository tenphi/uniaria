/**
 * `@uniaria/elements/select` — registers `<uni-select>` on import. Its
 * options and groups are the consumer's elements inside the popover, keyed
 * by `data-key`; without an `items` property it reads them from the markup,
 * as `<uni-listbox>`. UniAria writes the value part's text and the hidden
 * `<select>`'s options.
 *
 * ```html
 * <uni-select placeholder="Pick a fruit" required>
 *   <span data-element="Label">Fruit</span>
 *   <button data-element="Trigger">
 *     <span data-element="Value"></span>
 *     <svg aria-hidden="true">…</svg>
 *   </button>
 *   <div data-element="Popover">
 *     <div data-element="List">
 *       <div data-element="Option" data-key="apple">Apple</div>
 *       <div data-element="Option" data-key="banana">Banana</div>
 *     </div>
 *     <p data-element="Empty">No fruit</p>
 *   </div>
 *   <select data-element="HiddenSelect" name="fruit"></select>
 * </uni-select>
 * ```
 */

import { select } from '@uniaria/core/select';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniSelectElement = UniElement<typeof select>;

// Annotated: inferred, its declaration has to name Popover's internal types,
// which the declaration build can't always reach (TS2883 in CI).
export const UniSelect: UniElementConstructor<typeof select> | undefined =
  defineElement(select);

declare global {
  interface HTMLElementTagNameMap {
    'uni-select': UniSelectElement;
  }
}
