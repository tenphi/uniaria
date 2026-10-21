import type { Styles } from '@tenphi/tasty';

import { focusRingStyles } from '../shared/focus';
import { toggleIndicatorStyles, toggleRowStyles } from '../shared/toggle';

/**
 * Radio: the shared row (`../shared/toggle.ts`), with UI Kit's 16-pixel
 * circle and an 8-pixel dot while selected, in the accent text color, or
 * the danger theme's while invalid. Disabled takes the disabled theme. A
 * radio has no error of its own: the group shows it.
 */
export const radioStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared row; the circle is Radio's
  ...toggleRowStyles,

  Indicator: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
    ...focusRingStyles,
    // eslint-disable-next-line tasty/no-style-spread -- its place in the row
    ...toggleIndicatorStyles,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    inlineSize: 'fixed 2x',
    blockSize: 'fixed 2x',
    radius: 'round',
    fill: {
      '': '#uni-surface',
      'hovered & !readonly': '#uni-surface-hover',
      '@uni-input-disabled': '#uni-disabled-surface',
      '@uni-forced-colors': 'Canvas',
    },
    border: {
      '': '1bw #uni-border',
      invalid: '1bw #uni-danger-border',
      '@uni-selected': '1bw #uni-accent-text',
      '(@uni-selected & invalid)': '1bw #uni-danger-text',
      '@uni-input-disabled': '1bw #uni-disabled-border',
      '(@uni-selected & @uni-input-disabled)': '1bw #uni-disabled-text',
      '@uni-forced-colors': '1bw CanvasText',
      '(@uni-selected & @uni-forced-colors)': '1bw Highlight',
      '(@uni-forced-colors & @uni-input-disabled)': '1bw GrayText',
    },
    // The dot's color.
    color: {
      '': '#uni-accent-text',
      invalid: '#uni-danger-text',
      '@uni-input-disabled': '#uni-disabled-text',
      '@uni-forced-colors': 'Highlight',
      '(@uni-forced-colors & @uni-input-disabled)': 'GrayText',
    },
    // Every color is set for forced colors too, the dot's included.
    forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
    transition: {
      '': 'fill $uni-transition, border $uni-transition',
      '@uni-reduced-motion': false,
    },

    '&::before': {
      content: { '': 'none', '@uni-selected': '""' },
      inlineSize: 'fixed 1x',
      blockSize: 'fixed 1x',
      radius: 'round',
      fill: '#current',
    },
  },
} satisfies Styles;
