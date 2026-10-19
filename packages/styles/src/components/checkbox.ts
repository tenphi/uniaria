import type { Styles } from '@tenphi/tasty';

import { fieldDescription, fieldError } from '../shared/field';
import { focusRing } from '../shared/focus';
import { checkMarks } from '../shared/marks';

/**
 * Checkbox: the box with its check or dash, the label beside it, the
 * description and error under the label. The input lies over the wrapper,
 * or over a root without one, transparent, so the whole row takes clicks
 * and is the 24-pixel target (WCAG 2.5.8). Selected and indeterminate take
 * the accent fill, or the danger fill while invalid; disabled takes the
 * disabled theme whole. Read-only looks enabled, without hover feedback.
 */
export const checkboxStyles = {
  position: 'relative',
  display: 'inline-grid',
  gridColumns: 'auto 1fr',
  gap: '.5x 1x',
  alignItems: 'center',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  blockSize: 'min max(24px, 1.5rem)',
  // eslint-disable-next-line tasty/consistent-token-usage -- as above
  inlineSize: 'min max(24px, 1.5rem)',
  color: {
    '': '#uni-text',
    '@uni-input-disabled': '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
    '(@uni-forced-colors & @uni-input-disabled)': '#uni-system-gray-text',
  },
  // No presets: sizes come from the uni tokens.
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',
  overflowWrap: 'anywhere',

  Wrapper: {
    position: 'relative',
    display: 'grid',
    gridColumn: '1 / -1',
    gridColumns: 'subgrid',
    alignItems: 'center',
    // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
    blockSize: 'min max(24px, 1.5rem)',
  },

  Input: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    margin: 0,
    padding: 0,
    opacity: 0,
    appearance: 'none',
    cursor: { '': 'pointer', 'readonly | @uni-input-disabled': 'default' },
  },

  Indicator: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
    ...focusRing,
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
      '@uni-forced-colors': '#uni-system-canvas',
      '(indeterminate | @uni-selected) & @uni-forced-colors':
        '#uni-system-highlight',
      '(indeterminate | @uni-selected) & @uni-input-disabled & @uni-forced-colors':
        '#uni-system-gray-text',
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
      '@uni-forced-colors': '1bw #uni-system-canvas-text',
      '(indeterminate | @uni-selected) & @uni-forced-colors':
        '1bw #uni-system-highlight',
      '(@uni-forced-colors & @uni-input-disabled)': '1bw #uni-system-gray-text',
    },
    // Every color is set for forced colors too, the marks' included.
    forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
    transition: {
      '': 'fill $uni-transition, border $uni-transition',
      '@uni-reduced-motion': false,
    },

    '&::before': {
      // eslint-disable-next-line tasty/no-style-spread -- the shared marks; the color is the checkbox's
      ...checkMarks,
      color: {
        '': '#uni-accent-fill-text',
        invalid: '#uni-danger-fill-text',
        '@uni-input-disabled': '#uni-disabled-fill-text',
        '@uni-forced-colors': '#uni-system-highlight-text',
        '(@uni-forced-colors & @uni-input-disabled)': '#uni-system-canvas',
      },
    },
  },

  Label: { gridColumn: 2 },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldDescription,
    gridColumn: 2,
  },
  Error: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldError,
    gridColumn: 2,
  },
} satisfies Styles;
