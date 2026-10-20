import type { Styles } from '@tenphi/tasty';

import { focusRingStyles } from './focus';

/**
 * A button's box, without its colors: Button's and ToggleButton's, and the
 * triggers outside other components' roots. UI Kit's sizes: one line of
 * text in a control-height box, at least 24 pixels either way.
 */
export const buttonBoxStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
  ...focusRingStyles,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '.5x',
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  blockSize: 'min max(24px, $uni-control-height)',
  // eslint-disable-next-line tasty/consistent-token-usage -- as above
  inlineSize: 'min max(24px, $uni-control-height)',
  margin: 0,
  // UI Kit's: the inline padding centers one line of text in a square of
  // the control's height, plus half a gap.
  padding: '.5x (($uni-control-height - $uni-line-height) / 2 - 1bw + .5x)',
  radius: '1r',
  // No presets: the type follows the page, sizes come from the uni tokens.
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',
  textAlign: 'center',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  cursor: { '': 'pointer', '@uni-disabled': 'default' },
  transition: {
    '': 'fill $uni-transition, border $uni-transition, color $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;
