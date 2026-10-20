import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { optionPartStyles } from '../shared/option';

/**
 * The box around the options: the input box's colors
 * (`../shared/input.ts`), half a gap inside it, and UI Kit's list radius,
 * concentric with the options'. Its ring shows only while the list itself
 * has focus, empty or with no option to focus; otherwise the focused
 * option shows its own.
 */
const listBoxStyles = {
  boxSizing: 'border-box',
  padding: '.5x',
  radius: '(1r + .5x)',
  fill: { '': '#uni-surface', disabled: '#uni-disabled-surface' },
  border: {
    '': '1bw #uni-border',
    invalid: '1bw #uni-danger-border',
    disabled: '1bw #uni-disabled-border',
  },
  outline: {
    '': '0 #clear / 1bw',
    'focus-visible & @uni-list-tab-stop': '1ow #uni-accent-outline / 1bw',
    'focus-visible & @uni-list-tab-stop & invalid':
      '1ow #uni-danger-outline / 1bw',
    'focus-visible & @uni-list-tab-stop & @uni-forced-colors':
      '1ow #uni-system-highlight / 1bw',
  },
  overflow: 'auto',
  transition: {
    '': 'border $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;

/**
 * `styles` while the root is in `state`, and nothing otherwise: every
 * state map loses its default, which `false` can't stand for (Tasty reads
 * `padding: false` as its own gap).
 */
function onlyWhen(state: string, styles: Styles): Styles {
  return Object.fromEntries(
    Object.entries(styles).map(([name, value]) => {
      const states: object =
        typeof value === 'object' && value !== null ? value : { '': value };
      return [
        name,
        Object.fromEntries(
          Object.entries(states).map(([key, at]) => [
            key ? `${state} & (${key})` : state,
            at,
          ]),
        ),
      ];
    }),
  ) as Styles;
}

/**
 * Listbox: the shared column (`../shared/field.ts`) with the list as its
 * box, and the shared options (`../shared/option.ts`). Virtualized, the
 * scroller is the box, and the list inside it only holds the options
 * UniAria positions, so they keep the box's padding. The height is yours:
 * give the list, or the scroller, a block size or a maximum.
 */
export const listboxStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,

  Scroller: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, here while virtualized
    ...onlyWhen('virtualized', listBoxStyles),
  },
  List: {
    // eslint-disable-next-line tasty/no-style-spread -- the list's box, on the scroller while virtualized
    ...onlyWhen('!virtualized', listBoxStyles),
    display: 'block',
    margin: 0,
    padding: { '': '.5x', virtualized: 0 },
    listStyle: 'none',
  },

  ...optionPartStyles,
} satisfies Styles;
