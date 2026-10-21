import type { Styles } from '@tenphi/tasty';

import { buttonBoxStyles } from '../shared/button';

/**
 * Button, and the look of the triggers outside other components' roots.
 * `data-variant`, which the consumer writes, picks the theme: `secondary`
 * (the default theme's surface; also without the attribute), `primary`
 * (the accent fill), `quiet` (no fill or border until hovered) and
 * `danger` (the danger fill), spec: Resolved questions 10. Disabled takes
 * the disabled theme whole.
 */
export const buttonStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared box; the colors are Button's
  ...buttonBoxStyles,
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
    '@uni-forced-colors': 'ButtonFace',
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
    '@uni-forced-colors': '1bw ButtonText',
    '(@uni-forced-colors & @uni-disabled)': '1bw GrayText',
  },
  color: {
    '': '#uni-text',
    'variant=primary': '#uni-accent-fill-text',
    'variant=danger': '#uni-danger-fill-text',
    '@uni-disabled': '#uni-disabled-text',
    '@uni-forced-colors': 'ButtonText',
    '(@uni-forced-colors & @uni-disabled)': 'GrayText',
  },
} satisfies Styles;
