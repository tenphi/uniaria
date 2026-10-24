import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { inputBoxStyles, inputTextStyles } from '../shared/input';
import { listBoxStyles, onlyWhen } from '../shared/list';
import { optionPartStyles } from '../shared/option';

/**
 * Listbox's box without its ring: inline, the list is never a tab stop,
 * and focus stays in the input, which shows it.
 */
const { outline: _listRing, ...inlineListBoxStyles } = listBoxStyles;

/**
 * While nothing matches, the empty part shows inside the list's box, in an
 * option's place, as in Listbox: the box (the list, or the scroller while
 * virtualized) and the empty part take the same cell of the column, the
 * one after the input, so the box grows to hold the text.
 */
const emptyCellStyles = {
  gridColumn: { '': false, empty: '1' },
  gridRow: { '': false, empty: '2', 'empty & @uni-labelled': '3' },
} satisfies Styles;

/**
 * Autocomplete, inline: the shared column (`../shared/field.ts`) with the
 * input as the input box (`../shared/input.ts`), as Field draws a native
 * input, and Listbox's list under it (`../shared/list.ts`) with the shared
 * options (`../shared/option.ts`), which the filter hides with `hidden`.
 * The input keeps its ring while the keys move the highlight through the
 * list, since focus stays in it. Virtualized, the scroller is the box, as
 * in Listbox; the root doesn't say so, so the list and the scroller read
 * their own state. The list's height is yours, as Listbox's.
 *
 * Popup mode is for definitions that show the list in a popup, which style
 * their own parts (Combobox), so the button and the popup get nothing.
 *
 * Typed `Styles`, not inferred: the declarations can't name the narrowed
 * box's type.
 */
export const autocompleteStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,

  Input: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared input box, as Field's native input
    ...inputBoxStyles,
    // eslint-disable-next-line tasty/no-style-spread -- the shared input text
    ...inputTextStyles,
    padding: '(($uni-control-height - $uni-line-height) / 2 - 1bw) (1x - 1bw)',
  },

  Scroller: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, here while virtualized
    ...onlyWhen('@own(virtualized)', inlineListBoxStyles),
    // eslint-disable-next-line tasty/no-style-spread -- the empty part's cell
    ...emptyCellStyles,
  },
  List: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, on the scroller while virtualized
    ...onlyWhen('!@own(virtualized)', inlineListBoxStyles),
    // eslint-disable-next-line tasty/no-style-spread -- the empty part's cell
    ...emptyCellStyles,
    display: 'block',
    margin: 0,
    padding: { '': '.5x', '@own(virtualized)': 0 },
    listStyle: 'none',
  },

  ...optionPartStyles,

  Empty: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared empty state
    ...optionPartStyles.Empty,
    // eslint-disable-next-line tasty/no-style-spread -- the box's cell
    ...emptyCellStyles,
    // Inside the box's padding and border.
    margin: '(.5x + 1bw)',
    pointerEvents: 'none',
  },
};
