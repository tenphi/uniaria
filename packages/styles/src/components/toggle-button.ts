import type { Styles } from '@tenphi/tasty';

import { buttonBoxStyles } from '../shared/button';
import {
  itemDescriptionStyles,
  itemExtrasStyles,
  itemFrameStyles,
  itemLabelStyles,
  itemRootStyles,
} from '../shared/item';

/**
 * ToggleButton's box and colors: Button's look and `data-variant`, and
 * the accent fill while selected, whatever the variant (spec: Components).
 * UI Kit tints a selected button lightly instead; on a tint, selection
 * would show mostly by hue (WCAG 1.4.1). Disabled takes the disabled theme
 * whole, its fill while selected.
 */
const toggleButtonLookStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared box; the colors are ToggleButton's
  ...buttonBoxStyles,
  fill: {
    '': '#uni-surface',
    hovered: '#uni-surface-hover',
    pressed: '#uni-surface-pressed',
    'variant=quiet': '#clear',
    'variant=quiet & hovered': '#current.$uni-quiet-hover',
    'variant=quiet & pressed': '#current.$uni-quiet-pressed',
    'variant=primary': '#uni-accent-fill',
    'variant=primary & hovered': '#uni-accent-fill-hover',
    'variant=primary & pressed': '#uni-accent-fill-pressed',
    'variant=danger': '#uni-danger-fill',
    'variant=danger & hovered': '#uni-danger-fill-hover',
    'variant=danger & pressed': '#uni-danger-fill-pressed',
    selected: '#uni-accent-fill',
    'selected & hovered': '#uni-accent-fill-hover',
    'selected & pressed': '#uni-accent-fill-pressed',
    '@uni-disabled': '#uni-disabled-surface',
    'variant=quiet & @uni-disabled': '#clear',
    'selected & @uni-disabled': '#uni-disabled-fill',
    '@uni-forced-colors': 'ButtonFace',
    'selected & @uni-forced-colors': 'Highlight',
    'selected & @uni-disabled & @uni-forced-colors': 'GrayText',
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
    selected: '1bw #uni-accent-fill',
    'selected & hovered': '1bw #uni-accent-fill-hover',
    'selected & pressed': '1bw #uni-accent-fill-pressed',
    '@uni-disabled': '1bw #uni-disabled-border',
    'variant=quiet & @uni-disabled': '1bw #clear',
    'selected & @uni-disabled': '1bw #uni-disabled-fill',
    '@uni-forced-colors': '1bw ButtonText',
    'selected & @uni-forced-colors': '1bw Highlight',
    '(@uni-forced-colors & @uni-disabled)': '1bw GrayText',
  },
  color: {
    '': '#uni-text',
    'variant=quiet': '#current',
    'variant=primary': '#uni-accent-fill-text',
    'variant=danger': '#uni-danger-fill-text',
    selected: '#uni-accent-fill-text',
    '@uni-disabled': '#uni-disabled-text',
    'selected & @uni-disabled': '#uni-disabled-fill-text',
    '@uni-forced-colors': 'ButtonText',
    'selected & @uni-forced-colors': 'HighlightText',
    '(@uni-forced-colors & @uni-disabled)': 'GrayText',
    'selected & @uni-disabled & @uni-forced-colors': 'ButtonFace',
  },
  // Every color is set for forced colors, the selected fill's included.
  forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
} satisfies Styles;

/**
 * ToggleButton, with the item look (`../shared/item.ts`) while it has a
 * label part, as Button. Typed `Styles`, not inferred: the item grid's
 * states are built.
 */
export const toggleButtonStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- its box and colors; the item grid sets other keys
  ...toggleButtonLookStyles,
  ...itemRootStyles({ label: 'Label', description: 'Description' }),
  Label: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared item label
    ...itemLabelStyles,
  },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared item description
    ...itemDescriptionStyles,
  },
};

/**
 * ToggleButton's frame, outside its root: the grid, in its text color.
 * As the root, it sets every color for forced colors, so text in its
 * extras gets no backplate over the selected fill.
 */
export const toggleButtonFrameStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared frame
  ...itemFrameStyles(toggleButtonLookStyles.color),
  forcedColorAdjust: { '': 'auto', '@uni-forced-colors': 'none' },
};

/** ToggleButton's extras, outside its root. */
export const toggleButtonExtrasStyles = itemExtrasStyles;
