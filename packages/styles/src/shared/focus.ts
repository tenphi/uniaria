import type { Styles } from '@tenphi/tasty';

/**
 * The focus ring: a 2-pixel outline a pixel outside the part, on
 * `focus-visible` only, in `#uni-accent-outline`, or `#uni-danger-outline`
 * while invalid (spec: Components, Cases). A disabled part that keeps focus
 * keeps its ring. In forced colors it is the system's `Highlight`.
 */
export const focusRingStyles = {
  outline: {
    '': '0 #clear / 1bw',
    'focus-visible': '1ow #uni-accent-outline / 1bw',
    'focus-visible & invalid': '1ow #uni-danger-outline / 1bw',
    'focus-visible & @uni-forced-colors': '1ow Highlight / 1bw',
  },
} satisfies Styles;
