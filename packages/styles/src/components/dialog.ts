import type { Styles } from '@tenphi/tasty';

import { closeStyles } from '../shared/close';
import { dialogMotionStyles } from '../shared/motion';
import {
  itemDescriptionStyles,
  itemExtrasStyles,
  itemLabelStyles,
} from '../shared/item';
import { buttonFrameStyles, buttonItemStyles } from './button';

/**
 * Dialog, as UI Kit's modal: a surface panel centered by the native
 * dialog, 360 pixels wide (22.5rem) down to 288 and never wider or taller
 * than the viewport less 32 pixels a side, scrolling inside when its
 * content is taller. Its parts are a column 12 pixels apart, 12 pixels in
 * from its edge; the title is UI Kit's 18/24 heading. The `::backdrop` is
 * `#uni-backdrop`, and the dialog drops into place as it fades in
 * (`../shared/motion.ts`). The dialog is hidden while closed, so its
 * `display` is set only while it is open or exiting. A transparent border
 * keeps its edge in forced colors, where the fill and shadow go.
 *
 * Typed `Styles`, not inferred: the close part's styles are built, and the
 * declarations can't name their type.
 */
export const dialogStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared dialog motion
  ...dialogMotionStyles,
  // Only while shown: a closed one is hidden by its own element's rule.
  display: { '': false, 'open | exiting': 'flex' },
  flow: 'column',
  // As `display`, or Tasty writes the gap as margins while closed.
  gap: { '': false, 'open | exiting': '1.5x' },
  boxSizing: 'border-box',
  inlineSize: 'min(18rem, (100dvw - 8x)) 22.5rem (100dvw - 8x)',
  // `fit-content`, the native dialog's: centered by `inset: 0`, an `auto`
  // block size would stretch it to the viewport.
  blockSize: 'initial fit-content (100dvh - 8x)',
  margin: 'auto',
  padding: '1.5x',
  overflow: 'auto',
  border: '1bw #clear',
  radius: '(1r + .5x)',
  fill: '#uni-surface',
  color: '#uni-text',
  shadow: '0 1x 4x #uni-shadow',
  // It takes focus itself only when nothing inside is marked to.
  outline: '0 #clear',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',

  '&::backdrop': {
    // eslint-disable-next-line tasty/no-style-spread -- the shared backdrop motion
    ...dialogMotionStyles['&::backdrop'],
    fill: '#uni-backdrop',
  },

  Title: {
    margin: 0,
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontSize: '1.125rem',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    lineHeight: '1.5rem',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontWeight: '600',
  },
  Description: {
    margin: 0,
    color: '#uni-text-soft',
  },
  Close: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared close button
    ...closeStyles,
  },
};

/**
 * The trigger and its parts, outside the dialog: a Button, with the item
 * look while it has a `triggerLabel` (`../shared/item.ts`).
 */
export const dialogTriggerStyles = buttonItemStyles({
  label: '[data-uni-part="dialog-trigger-label"]',
  description: '[data-uni-part="dialog-trigger-description"]',
});
export const dialogTriggerLabelStyles = itemLabelStyles;
export const dialogTriggerDescriptionStyles = itemDescriptionStyles;
export const dialogTriggerFrameStyles = buttonFrameStyles;
export const dialogTriggerExtrasStyles = itemExtrasStyles;
