/**
 * `@uniaria/elements/autocomplete` — registers `<uni-autocomplete>` on
 * import, in inline mode: the list is always shown under the input, and
 * typing filters it. Its options and groups are the consumer's elements in
 * the list, keyed by `data-key`; without an `items` property it reads them
 * from the markup, as `<uni-listbox>`, and hides the options the filter
 * leaves out with `hidden`. The input's `value` seeds the text.
 *
 * ```html
 * <uni-autocomplete selection-mode="multiple" highlight-first-match>
 *   <label data-element="Label">Fruit</label>
 *   <input data-element="Input" type="search" />
 *   <div data-element="List">
 *     <div data-element="Option" data-key="apple">Apple</div>
 *     <div data-element="Option" data-key="banana">Banana</div>
 *   </div>
 *   <p data-element="Empty">No fruit</p>
 * </uni-autocomplete>
 * ```
 */

import { autocomplete } from '@uniaria/core/autocomplete';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniAutocompleteElement = UniElement<typeof autocomplete>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniAutocomplete:
  UniElementConstructor<typeof autocomplete> | undefined =
  defineElement(autocomplete);

declare global {
  interface HTMLElementTagNameMap {
    'uni-autocomplete': UniAutocompleteElement;
  }
}
