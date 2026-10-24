import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { listBoxStyles, onlyWhen } from '../shared/list';
import { optionPartStyles } from '../shared/option';

/**
 * While the list is empty, the empty part shows inside its box, in an
 * option's place: the box (the list, or the scroller while virtualized)
 * and the empty part take the same cell of the column, under the label if
 * there is one, so the box grows to hold the text. A click on the text
 * reaches the list, which then takes focus.
 */
const emptyCellStyles = {
  gridColumn: { '': false, empty: '1' },
  gridRow: { '': false, empty: '1', 'empty & @uni-labelled': '2' },
} satisfies Styles;

/**
 * Listbox: the shared column (`../shared/field.ts`) with the list as its
 * box (`../shared/list.ts`), and the shared options
 * (`../shared/option.ts`). Virtualized, the
 * scroller is the box, and the list inside it only holds the options
 * UniAria positions, so they keep the box's padding. The height is yours:
 * give the list, or the scroller, a block size or a maximum.
 *
 * Typed `Styles`, not inferred: the declarations can't name the narrowed
 * box's type.
 */
export const listboxStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,

  Scroller: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, here while virtualized
    ...onlyWhen('virtualized', listBoxStyles),
    // eslint-disable-next-line tasty/no-style-spread -- the empty part's cell
    ...emptyCellStyles,
  },
  List: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, on the scroller while virtualized
    ...onlyWhen('!virtualized', listBoxStyles),
    // eslint-disable-next-line tasty/no-style-spread -- the empty part's cell
    ...emptyCellStyles,
    display: 'block',
    margin: 0,
    padding: { '': '.5x', virtualized: 0 },
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
