import type { Styles } from '@tenphi/tasty';

import { popupMotionStyles } from './motion';
import { optionPartStyles } from './option';

/**
 * A picker's popup, Select's and Combobox's: UI Kit's popup surface, a
 * gap's width from the trigger, at least as wide as it and no wider or
 * taller than the room UniAria measures (`--anchor-width`,
 * `--available-width`, `--available-height`), and at most UI Kit's half
 * of the viewport. The list scrolls inside the popover's padding, the
 * scroller instead while virtualized, and the popover keeps its overflow
 * for the arrow.
 *
 * The popover is `popover="manual"`, or `hidden` without the Popover API,
 * so its `display` is set only while it is shown: open, or closed and
 * still exiting (`./motion.ts`). The arrow is a turned square with the
 * border on its two outer sides; UniAria places it along its side inline
 * and writes `data-placement` on it.
 */
export const popupStyles = {
  Popover: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared popup motion
    ...popupMotionStyles,
    display: { '': false, 'open | exiting': 'flex' },
    flow: 'column',
    boxSizing: 'border-box',
    inlineSize: '$anchor-width max-content ($available-width, 100dvw)',
    blockSize: 'max min(($available-height, 100dvh), (50vh - 5x))',
    // The gap from the trigger, above or below it. UniAria aligns the
    // margin box with the trigger, so an inline margin would shift it.
    margin: '1x 0',
    padding: '.5x',
    overflow: 'visible',
    border: '1bw #uni-border',
    radius: '(1r + .5x)',
    fill: '#uni-surface',
    color: '#uni-text',
    shadow: '0 .5x 2x #uni-shadow',
    // Above the page without the Popover API; the top layer ignores it.
    zIndex: '$uni-z-overlay',
  },
  Arrow: {
    position: 'absolute',
    boxSizing: 'border-box',
    inlineSize: 'fixed 1x',
    blockSize: 'fixed 1x',
    fill: '#uni-surface',
    rotate: '45deg',
    pointerEvents: 'none',
    border: {
      '': '1bw #uni-border top left',
      '@own(placement=top)': '1bw #uni-border right bottom',
      '@own(placement=left)': '1bw #uni-border top right',
      '@own(placement=right)': '1bw #uni-border bottom left',
    },
    // Its center on the popover's outer edge, so its outer half sits in
    // the gap and its inner half covers the border. UniAria writes the
    // other axis inline: `left` above or below, `top` beside.
    inset: {
      '': '(-.5x - 1bw) top',
      '@own(placement=top)': '(-.5x - 1bw) bottom',
      '@own(placement=left)': '(-.5x - 1bw) right',
      '@own(placement=right)': '(-.5x - 1bw) left',
    },
  },
  Scroller: {
    overflow: 'auto',
  },
  List: {
    display: 'block',
    margin: 0,
    padding: 0,
    listStyle: 'none',
    // A scroll container: as a flex item it shrinks to the popover's room.
    overflow: 'auto',
    // Focus on the list itself, when no option can take it.
    outline: {
      '': '0 #clear / (-1ow)',
      'focus-visible & @uni-list-tab-stop': '1ow #uni-accent-outline / (-1ow)',
      'focus-visible & @uni-list-tab-stop & @uni-forced-colors':
        '1ow #uni-system-highlight / (-1ow)',
    },
  },

  // eslint-disable-next-line tasty/no-style-spread -- the shared option parts, the same as Listbox's
  ...optionPartStyles,
} satisfies Styles;
