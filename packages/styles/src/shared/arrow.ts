import type { Styles } from '@tenphi/tasty';

/**
 * An overlay's arrow, as Popover, Tooltip, Select and Combobox draw it: a
 * square turned 45 degrees, its center on the overlay's outer edge, so its
 * outer half sits in the gap and its inner half covers the border. UniAria
 * centers the arrow part on the anchor from its box, transforms included
 * (Popover docs, Styling), so the part only turns in quarter turns, which
 * keep its box, and `::before` draws the turned square: pointing up, with
 * the border on its two outer sides, for an overlay below its anchor. The
 * part takes its own `data-placement`; UniAria writes its offset along the
 * edge inline: `left` above or below, `top` beside.
 */
/* eslint-disable tasty/no-own-at-root -- spread into arrow parts, where @own() reads the arrow's placement */
export const arrowStyles = {
  position: 'absolute',
  boxSizing: 'border-box',
  inlineSize: 'fixed 1x',
  blockSize: 'fixed 1x',
  pointerEvents: 'none',
  rotate: {
    '': '0deg',
    '@own(placement=top)': '180deg',
    '@own(placement=left)': '90deg',
    '@own(placement=right)': '-90deg',
  },
  inset: {
    '': '(-.5x - 1bw) top',
    '@own(placement=top)': '(-.5x - 1bw) bottom',
    '@own(placement=left)': '(-.5x - 1bw) right',
    '@own(placement=right)': '(-.5x - 1bw) left',
  },

  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    fill: '#uni-surface',
    border: '1bw #uni-border top left',
    rotate: '45deg',
  },
} satisfies Styles;
/* eslint-enable tasty/no-own-at-root */
