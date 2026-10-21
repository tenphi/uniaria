import type { Styles } from '@tenphi/tasty';

import { focusRingStyles } from '../shared/focus';
import {
  toggleErrorStyles,
  toggleIndicatorStyles,
  toggleRowStyles,
} from '../shared/toggle';

/**
 * Switch: the shared row (`../shared/toggle.ts`), with the indicator as
 * the track, UI Kit's 32 by 20 pixels. The thumb is your own `Thumb`
 * element inside it (spec: Components): a 12-pixel dot in the track's
 * color, at the start while off and the end while on, by logical inset so
 * it mirrors in right-to-left text. On, the track takes the accent fill,
 * or the danger fill while invalid; disabled takes the disabled theme.
 */
export const switchStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared row; the track is Switch's
  ...toggleRowStyles,

  Indicator: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
    ...focusRingStyles,
    // eslint-disable-next-line tasty/no-style-spread -- its place in the row
    ...toggleIndicatorStyles,
    position: 'relative',
    display: 'block',
    boxSizing: 'border-box',
    inlineSize: 'fixed 4x',
    blockSize: 'fixed 2.5x',
    radius: 'round',
    fill: {
      '': '#uni-surface',
      'hovered & !readonly': '#uni-surface-hover',
      '@uni-selected': '#uni-accent-fill',
      '(@uni-selected & hovered & !readonly)': '#uni-accent-fill-hover',
      '(@uni-selected & invalid)': '#uni-danger-fill',
      '(@uni-selected & invalid & hovered & !readonly)':
        '#uni-danger-fill-hover',
      '@uni-input-disabled': '#uni-disabled-surface',
      '(@uni-selected & @uni-input-disabled)': '#uni-disabled-fill',
      '@uni-forced-colors': 'Canvas',
      '(@uni-selected & @uni-forced-colors)': 'Highlight',
      '(@uni-selected & @uni-input-disabled & @uni-forced-colors)': 'GrayText',
    },
    border: {
      '': '1bw #uni-border',
      invalid: '1bw #uni-danger-border',
      '@uni-selected': '1bw #uni-accent-fill',
      '(@uni-selected & hovered & !readonly)': '1bw #uni-accent-fill-hover',
      '(@uni-selected & invalid)': '1bw #uni-danger-fill',
      '(@uni-selected & invalid & hovered & !readonly)':
        '1bw #uni-danger-fill-hover',
      '@uni-input-disabled': '1bw #uni-disabled-border',
      '(@uni-selected & @uni-input-disabled)': '1bw #uni-disabled-fill',
      '@uni-forced-colors': '1bw CanvasText',
      '(@uni-selected & @uni-forced-colors)': '1bw Highlight',
      '(@uni-forced-colors & @uni-input-disabled)': '1bw GrayText',
    },
    // The thumb's color.
    color: {
      '': '#uni-text-soft',
      '@uni-selected': '#uni-accent-fill-text',
      '(@uni-selected & invalid)': '#uni-danger-fill-text',
      '@uni-input-disabled': '#uni-disabled-text',
      '(@uni-selected & @uni-input-disabled)': '#uni-disabled-fill-text',
      '@uni-forced-colors': 'CanvasText',
      '(@uni-selected & @uni-forced-colors)': 'HighlightText',
      '(@uni-forced-colors & @uni-input-disabled)': 'GrayText',
      '(@uni-selected & @uni-input-disabled & @uni-forced-colors)': 'Canvas',
    },
    // Every color is set for forced colors too, the thumb's included.
    forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
    transition: {
      '': 'fill $uni-transition, border $uni-transition',
      '@uni-reduced-motion': false,
    },
  },

  Thumb: {
    position: 'absolute',
    blockInset: '.375x start',
    inlineInset: {
      '': '.375x start',
      '@uni-selected': '(100% - 1.5x - .375x) start',
    },
    inlineSize: 'fixed 1.5x',
    blockSize: 'fixed 1.5x',
    radius: 'round',
    fill: '#current',
    forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
    transition: {
      '': 'inset-inline-start $uni-transition, fill $uni-transition',
      '@uni-reduced-motion': false,
    },
  },

  Error: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...toggleErrorStyles,
  },
} satisfies Styles;
