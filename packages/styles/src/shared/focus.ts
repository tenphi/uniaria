import type { Styles } from '@tenphi/tasty';

/**
 * The focus ring: a 2-pixel outline outside the part, on `focus-visible`
 * only, in `#uni-accent-outline`, or `#uni-danger-outline` while invalid
 * (spec: Components, Cases). A disabled part that keeps focus keeps its
 * ring. In forced colors it is the system's `Highlight`.
 */
export const focusRing = {
  outline: {
    '': '0 #clear',
    'focus-visible': '1ow #uni-accent-outline',
    'focus-visible & invalid': '1ow #uni-danger-outline',
    'focus-visible & @uni-forced-colors': '1ow #uni-system-highlight',
  },
  outlineOffset: '1ow',
} satisfies Styles;
