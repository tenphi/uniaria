import type { Styles } from '@tenphi/tasty';

import { arrowStyles } from '../shared/arrow';
import { tooltipMotionStyles } from '../shared/motion';

/**
 * Tooltip, as UI Kit's: the default theme's fill (dark in every scheme)
 * with its text, UI Kit's 12/18, 6 by 8 pixels inside, at most 20rem wide
 * or the room UniAria measures, long words wrapping. Its margin is the gap
 * from the trigger and keeps it off the viewport's edges (Overlays guide).
 * It moves in from its trigger's side as it fades in, from .8, and skips
 * that when it opens without its delay (`../shared/motion.ts`). A
 * transparent border keeps its edge in forced colors, where the fill goes;
 * the arrow is the shared one, in the fill.
 */
export const tooltipStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared tooltip motion
  ...tooltipMotionStyles,
  boxSizing: 'border-box',
  inlineSize: 'max min(20rem, ($available-width, 100dvw))',
  margin: '1x',
  padding: '(.75x - 1bw) (1x - 1bw)',
  overflow: 'visible',
  border: '1bw #clear',
  radius: '1r',
  fill: '#uni-fill',
  color: '#uni-fill-text',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size-small',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height-small',
  overflowWrap: 'anywhere',
  // Above the page without the Popover API; the top layer ignores it.
  zIndex: '$uni-z-overlay',

  Arrow: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared arrow
    ...arrowStyles,

    '&::before': {
      // eslint-disable-next-line tasty/no-style-spread -- the shared arrow's square
      ...arrowStyles['&::before'],
      fill: '#uni-fill',
      border: '1bw #clear top left',
    },
  },
} satisfies Styles;
