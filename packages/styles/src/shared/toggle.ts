import type { Styles } from '@tenphi/tasty';

import { fieldDescriptionStyles, fieldErrorStyles } from './field';

/**
 * The row Checkbox, Switch and Radio share: the indicator at the start,
 * the label beside it, the description and error under the label. The
 * input lies over the wrapper, or over a root without one, transparent, so
 * the whole row takes clicks and is the 24-pixel target (WCAG 2.5.8). The
 * component draws the indicator, placed with `toggleIndicatorStyles`.
 */
export const toggleRowStyles = {
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
    '@uni-forced-colors': 'CanvasText',
    '(@uni-forced-colors & @uni-input-disabled)': 'GrayText',
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

  // In the first row, whatever the markup's order: a switch's label often
  // comes first.
  Label: { gridRow: 1, gridColumn: 2 },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldDescriptionStyles,
    gridColumn: 2,
  },
} satisfies Styles;

/** The indicator's place in the row. */
export const toggleIndicatorStyles = {
  gridRow: 1,
  gridColumn: 1,
} satisfies Styles;

/** The error, for the components that have one (not Radio). */
export const toggleErrorStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field text
  ...fieldErrorStyles,
  gridColumn: 2,
} satisfies Styles;
