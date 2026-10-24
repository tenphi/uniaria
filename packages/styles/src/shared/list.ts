import type { Styles } from '@tenphi/tasty';

/**
 * The box around the options, Listbox's and Autocomplete's: the input
 * box's colors (`./input.ts`), half a gap inside it, and UI Kit's list
 * radius, concentric with the options'. Its ring shows only while the list
 * itself has focus, empty or with no option to focus; otherwise the
 * focused option shows its own.
 */
export const listBoxStyles = {
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
      '1ow Highlight / 1bw',
  },
  overflow: 'auto',
  transition: {
    '': 'border $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;

/**
 * `styles` while the root is in `state` (a part in its own, with
 * `@own()`), and nothing otherwise: each state map's keys gain the state,
 * so none of them applies outside it.
 */
export function onlyWhen(state: string, styles: Styles): Styles {
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
