import type { Styles } from '@tenphi/tasty';

/**
 * The check and the dash, drawn on an indicator's `::before` in its
 * `color`: a check is two borders turned 45 degrees, a dash one border.
 * The dash wins over the check. Neither mirrors in right-to-left text.
 */
export const checkMarkStyles = {
  content: { '': 'none', 'indeterminate | @uni-selected': '""' },
  boxSizing: 'border-box',
  inlineSize: { '': 'fixed .25rem', indeterminate: 'fixed .5rem' },
  blockSize: { '': 'fixed .5rem', indeterminate: 'fixed 0' },
  blockMargin: { '': '-.125rem start', indeterminate: '0' },
  border: {
    '': '2bw #current right bottom',
    indeterminate: '2bw #current bottom',
  },
  rotate: { '': '45deg', indeterminate: '0deg' },
} satisfies Styles;

/**
 * A chevron pointing down, the sign that a picker opens: two borders of a
 * 6-pixel square turned 45 degrees, raised by the half of the square the
 * borders leave empty. It doesn't mirror in right-to-left text either.
 */
export const chevronStyles = {
  content: '""',
  flexShrink: 0,
  boxSizing: 'border-box',
  inlineSize: 'fixed .375rem',
  blockSize: 'fixed .375rem',
  border: '1.5bw #current right bottom',
  rotate: '45deg',
  translate: '0 -.125rem',
} satisfies Styles;
