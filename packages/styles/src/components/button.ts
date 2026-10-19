import type { Styles } from '@tenphi/tasty';

import { focusRing } from '../shared/focus';

/**
 * Button, and the look of the triggers outside other components' roots.
 * `data-variant`, which the consumer writes, picks the theme: `secondary`
 * (the default theme's surface; also without the attribute), `primary`
 * (the accent fill), `quiet` (no fill or border until hovered) and
 * `danger` (the danger fill), spec: Resolved questions 10. Disabled takes
 * the disabled theme whole.
 */
export const buttonStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, the same on every part that shows focus
  ...focusRing,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1x',
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  blockSize: 'min max(24px, $uni-control-height)',
  // eslint-disable-next-line tasty/consistent-token-usage -- as above
  inlineSize: 'min max(24px, $uni-control-height)',
  margin: 0,
  padding: '.5x 1.5x',
  radius: '1r',
  fill: {
    '': '#uni-surface',
    hovered: '#uni-surface-hover',
    pressed: '#uni-surface-pressed',
    'variant=quiet': '#clear',
    'variant=quiet & hovered': '#uni-surface-hover',
    'variant=quiet & pressed': '#uni-surface-pressed',
    'variant=primary': '#uni-accent-fill',
    'variant=primary & hovered': '#uni-accent-fill-hover',
    'variant=primary & pressed': '#uni-accent-fill-pressed',
    'variant=danger': '#uni-danger-fill',
    'variant=danger & hovered': '#uni-danger-fill-hover',
    'variant=danger & pressed': '#uni-danger-fill-pressed',
    '@uni-disabled': '#uni-disabled-surface',
    'variant=quiet & @uni-disabled': '#clear',
    '@uni-forced-colors': '#uni-system-button-face',
  },
  border: {
    '': '1bw #uni-border',
    'variant=quiet': '1bw #clear',
    'variant=primary': '1bw #uni-accent-fill',
    'variant=primary & hovered': '1bw #uni-accent-fill-hover',
    'variant=primary & pressed': '1bw #uni-accent-fill-pressed',
    'variant=danger': '1bw #uni-danger-fill',
    'variant=danger & hovered': '1bw #uni-danger-fill-hover',
    'variant=danger & pressed': '1bw #uni-danger-fill-pressed',
    '@uni-disabled': '1bw #uni-disabled-border',
    'variant=quiet & @uni-disabled': '1bw #clear',
    '@uni-forced-colors': '1bw #uni-system-button-text',
    '(@uni-forced-colors & @uni-disabled)': '1bw #uni-system-gray-text',
  },
  color: {
    '': '#uni-text',
    'variant=primary': '#uni-accent-fill-text',
    'variant=danger': '#uni-danger-fill-text',
    '@uni-disabled': '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-button-text',
    '(@uni-forced-colors & @uni-disabled)': '#uni-system-gray-text',
  },
  // No presets: the type follows the page, sizes come from the uni tokens.
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '1.4',
  textAlign: 'center',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  cursor: { '': 'pointer', '@uni-disabled': 'default' },
  transition: {
    '': 'fill $uni-transition, border $uni-transition, color $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;
