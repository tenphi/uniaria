import type { Styles } from '@tenphi/tasty';

/**
 * A popup's motion, as Cube UI Kit's pickers move (spec: Overlay motion):
 * opening, it comes from faded, 8 pixels toward its trigger and scaled to
 * .9 along the placement axis, growing from the side toward the trigger;
 * closing, it goes back. UniAria marks the first two frames `entering` and
 * the exit `exiting`, and waits for these transitions before it hides the
 * popup. Until UniAria places it, the popup is as below its trigger.
 * Opacity is linear, movement and scale ease out; under reduced motion
 * nothing transitions, so the popup shows and hides at once.
 *
 * Spread into a popup part whose own `data-placement` UniAria writes
 * (Select's and Combobox's popover); the root states are its component's.
 */
/* eslint-disable tasty/no-own-at-root -- spread into a popover part, where @own() reads its placement */
export const popupMotionStyles = {
  opacity: { '': 1, 'entering | exiting': 0 },
  translate: {
    '': 'none',
    'entering | exiting': '0 -1x',
    '(entering | exiting) & @own(placement=top)': '0 1x',
    '(entering | exiting) & @own(placement=left)': '1x 0',
    '(entering | exiting) & @own(placement=right)': '-1x 0',
  },
  scale: {
    '': 'none',
    'entering | exiting': '1 .9',
    '(entering | exiting) & (@own(placement=left) | @own(placement=right))':
      '.9 1',
  },
  transformOrigin: {
    '': 'top',
    '@own(placement=top)': 'bottom',
    '@own(placement=left)': 'right',
    '@own(placement=right)': 'left',
  },
  transition: {
    '': 'opacity $uni-transition linear, translate $uni-transition ease-out, scale $uni-transition ease-out',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;
/* eslint-enable tasty/no-own-at-root */
