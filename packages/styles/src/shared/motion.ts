import type { Styles } from '@tenphi/tasty';

/**
 * Overlay motion (spec: Overlay motion): transitions between an overlay's
 * hidden look and its own. UniAria marks the first two frames of an
 * opening overlay `entering` and a closing one `exiting`, and waits for
 * these transitions before it hides it. Opacity is linear, movement and
 * scale ease out; under reduced motion nothing transitions, so overlays
 * show and hide at once.
 *
 * An overlay is `entering` from its first style (UniAria shows it once the
 * state is written), so opening needs no `transition: none`: it starts from
 * the hidden look, and reopening while it exits turns back smoothly.
 */

/**
 * A popup's motion, as Cube UI Kit's pickers move:
 * opening, it comes from faded, 8 pixels toward its trigger and scaled to
 * .9 along the placement axis, growing from the side toward the trigger;
 * closing, it goes back. Until UniAria places it, the popup is as below
 * its trigger.
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

/**
 * Tooltip's motion: the popups', from .8 instead of .9, on the tooltip's
 * root, which holds the placement. A tooltip that opens without its delay
 * (`instant`, after another one just showed) skips it.
 */
export const tooltipMotionStyles = {
  opacity: { '': 1, 'entering | exiting': 0 },
  translate: {
    '': 'none',
    'entering | exiting': '0 -1x',
    '(entering | exiting) & placement=top': '0 1x',
    '(entering | exiting) & placement=left': '1x 0',
    '(entering | exiting) & placement=right': '-1x 0',
  },
  scale: {
    '': 'none',
    'entering | exiting': '1 .8',
    '(entering | exiting) & (placement=left | placement=right)': '.8 1',
  },
  transformOrigin: {
    '': 'top',
    'placement=top': 'bottom',
    'placement=left': 'right',
    'placement=right': 'left',
  },
  transition: {
    '': 'opacity $uni-transition linear, translate $uni-transition ease-out, scale $uni-transition ease-out',
    instant: false,
    '@uni-reduced-motion': false,
  },
} satisfies Styles;

/**
 * Popover's motion, as UI Kit's: faded, and scaled to .9 along the
 * placement axis from the side toward its trigger, without moving, in
 * `$uni-overlay-transition`.
 */
export const popoverMotionStyles = {
  opacity: { '': 1, 'entering | exiting': 0 },
  scale: {
    '': 'none',
    'entering | exiting': '1 .9',
    '(entering | exiting) & (placement=left | placement=right)': '.9 1',
  },
  transformOrigin: {
    '': 'top',
    'placement=top': 'bottom',
    'placement=left': 'right',
    'placement=right': 'left',
  },
  transition: {
    '': 'opacity $uni-overlay-transition linear, scale $uni-overlay-transition ease-out',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;

/**
 * Dialog's motion, as UI Kit's modal: faded and 24 pixels up, dropping
 * into place, with its backdrop fading, in `$uni-dialog-transition`.
 */
export const dialogMotionStyles = {
  opacity: { '': 1, 'entering | exiting': 0 },
  translate: { '': 'none', 'entering | exiting': '0 -3x' },
  transition: {
    '': 'opacity $uni-dialog-transition linear, translate $uni-dialog-transition ease-out',
    '@uni-reduced-motion': false,
  },

  '&::backdrop': {
    opacity: { '': 1, 'entering | exiting': 0 },
    transition: {
      '': 'opacity $uni-dialog-transition linear',
      '@uni-reduced-motion': false,
    },
  },
} satisfies Styles;
