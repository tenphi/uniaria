import type { Styles } from '@tenphi/tasty';

import { focusRingStyles } from '../shared/focus';
import { checkMarkStyles } from '../shared/marks';
import {
  toggleErrorStyles,
  toggleIndicatorStyles,
  toggleRowStyles,
} from '../shared/toggle';

/**
 * Checkbox: the shared row (`../shared/toggle.ts`), with a box that shows
 * its check or dash. Selected and indeterminate take the accent fill, or
 * the danger fill while invalid; disabled takes the disabled theme whole.
 * Read-only looks enabled, without hover feedback.
 */
export const checkboxStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared row; the box is Checkbox's
  ...toggleRowStyles,

  Indicator: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
    ...focusRingStyles,
    // eslint-disable-next-line tasty/no-style-spread -- its place in the row
    ...toggleIndicatorStyles,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    // UI Kit's 14-pixel box.
    inlineSize: 'fixed (2x - 2bw)',
    blockSize: 'fixed (2x - 2bw)',
    radius: '.5r',
    fill: {
      '': '#uni-surface',
      'hovered & !readonly': '#uni-surface-hover',
      'indeterminate | @uni-selected': '#uni-accent-fill',
      '(indeterminate | @uni-selected) & hovered & !readonly':
        '#uni-accent-fill-hover',
      '(indeterminate | @uni-selected) & invalid': '#uni-danger-fill',
      '(indeterminate | @uni-selected) & invalid & hovered & !readonly':
        '#uni-danger-fill-hover',
      '@uni-input-disabled': '#uni-disabled-surface',
      '(indeterminate | @uni-selected) & @uni-input-disabled':
        '#uni-disabled-fill',
      '@uni-forced-colors': 'Canvas',
      '(indeterminate | @uni-selected) & @uni-forced-colors': 'Highlight',
      '(indeterminate | @uni-selected) & @uni-input-disabled & @uni-forced-colors':
        'GrayText',
    },
    border: {
      '': '1bw #uni-border',
      invalid: '1bw #uni-danger-border',
      'indeterminate | @uni-selected': '1bw #uni-accent-fill',
      '(indeterminate | @uni-selected) & hovered & !readonly':
        '1bw #uni-accent-fill-hover',
      '(indeterminate | @uni-selected) & invalid': '1bw #uni-danger-fill',
      '(indeterminate | @uni-selected) & invalid & hovered & !readonly':
        '1bw #uni-danger-fill-hover',
      '@uni-input-disabled': '1bw #uni-disabled-border',
      '(indeterminate | @uni-selected) & @uni-input-disabled':
        '1bw #uni-disabled-fill',
      '@uni-forced-colors': '1bw CanvasText',
      '(indeterminate | @uni-selected) & @uni-forced-colors': '1bw Highlight',
      '(@uni-forced-colors & @uni-input-disabled)': '1bw GrayText',
    },
    // Every color is set for forced colors too, the marks' included.
    forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
    transition: {
      '': 'fill $uni-transition, border $uni-transition',
      '@uni-reduced-motion': false,
    },

    // Out of the flow, still centered by the grid: in it, the mark would set
    // the row's baseline, and the checkbox would move as it appears. Clicks
    // go through to the input under it.
    '&::before': {
      // eslint-disable-next-line tasty/no-style-spread -- the shared marks; the color is the checkbox's
      ...checkMarkStyles,
      position: 'absolute',
      pointerEvents: 'none',
      color: {
        '': '#uni-accent-fill-text',
        invalid: '#uni-danger-fill-text',
        '@uni-input-disabled': '#uni-disabled-fill-text',
        '@uni-forced-colors': 'HighlightText',
        '(@uni-forced-colors & @uni-input-disabled)': 'Canvas',
      },
    },
  },

  Error: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...toggleErrorStyles,
  },
} satisfies Styles;
