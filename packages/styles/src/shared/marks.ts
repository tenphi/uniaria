import type { Styles } from '@tenphi/tasty';

/**
 * The check and the dash, drawn on an indicator's `::before` in its
 * `color`: a check is two borders turned 45 degrees, a dash one border.
 * The dash wins over the check. Neither mirrors in right-to-left text.
 */
export const checkMarks = {
  content: { '': 'none', 'indeterminate | @uni-selected': '""' },
  boxSizing: 'border-box',
  inlineSize: { '': 'fixed .25rem', indeterminate: 'fixed .5rem' },
  blockSize: { '': 'fixed .5rem', indeterminate: 'fixed 0' },
  marginBlockStart: { '': '-.125rem', indeterminate: '0' },
  border: {
    '': '2bw #current right bottom',
    indeterminate: '2bw #current bottom',
  },
  rotate: { '': '45deg', indeterminate: '0deg' },
} satisfies Styles;
