import type { Styles } from '@tenphi/tasty';

import { arrowStyles } from '../shared/arrow';
import { closeStyles } from '../shared/close';
import { popoverMotionStyles } from '../shared/motion';
import {
  itemDescriptionStyles,
  itemExtrasStyles,
  itemLabelStyles,
} from '../shared/item';
import { buttonFrameStyles, buttonItemStyles } from './button';

/**
 * Popover: the popup surface Select's and Combobox's share
 * (`../shared/popup.ts`), its parts a column 8 pixels apart, 12 pixels in
 * from its edge, with UI Kit's 14/20 heading as its title. Its margin is
 * the gap from the trigger and keeps it off the viewport's edges
 * (Overlays guide), and it is no larger than the room UniAria measures.
 * Without an arrow it scrolls inside when its content is taller; an arrow
 * needs the overflow, so then scroll an element inside it. It grows from
 * its trigger's side as it fades in (`../shared/motion.ts`), and its
 * `display` is set only while it is shown.
 *
 * Typed `Styles`, not inferred: the close part's styles are built, and the
 * declarations can't name their type.
 */
export const popoverStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared popover motion
  ...popoverMotionStyles,
  // Only while shown: a closed one is hidden by its own element's rule.
  display: { '': false, 'open | exiting': 'flex' },
  flow: 'column',
  // As `display`, or Tasty writes the gap as margins while closed.
  gap: { '': false, 'open | exiting': '1x' },
  boxSizing: 'border-box',
  inlineSize: 'max ($available-width, 100dvw)',
  blockSize: 'max ($available-height, 100dvh)',
  margin: '1x',
  padding: '1.5x',
  overflow: { '': 'auto', '@uni-arrowed': 'visible' },
  border: '1bw #uni-border',
  radius: '(1r + .5x)',
  fill: '#uni-surface',
  color: '#uni-text',
  shadow: '0 .5x 2x #uni-shadow',
  // It takes focus itself only when nothing inside is marked to.
  outline: '0 #clear',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',
  // Above the page without the Popover API; the top layer ignores it.
  zIndex: '$uni-z-overlay',

  Arrow: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared arrow
    ...arrowStyles,
  },
  Title: {
    margin: 0,
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
 * The trigger and its parts, outside the popover: a Button, with the item
 * look while it has a `triggerLabel` (`../shared/item.ts`).
 */
export const popoverTriggerStyles = buttonItemStyles({
  label: '[data-uni-part="popover-trigger-label"]',
  description: '[data-uni-part="popover-trigger-description"]',
});
export const popoverTriggerLabelStyles = itemLabelStyles;
export const popoverTriggerDescriptionStyles = itemDescriptionStyles;
export const popoverTriggerFrameStyles = buttonFrameStyles;
export const popoverTriggerExtrasStyles = itemExtrasStyles;
