import type { Styles } from '@tenphi/tasty';

import { buttonBoxStyles } from '../shared/button';
import {
  itemDescriptionStyles,
  itemExtrasStyles,
  itemFrameStyles,
  itemLabelStyles,
  itemRootStyles,
} from '../shared/item';
import type { ItemParts } from '../shared/item';

/**
 * Button's box and colors, without its parts: an overlay's close part
 * takes them on its own state (`../shared/close.ts`). `data-variant`,
 * which the consumer writes, picks the theme: `secondary` (the default
 * theme's surface; also without the attribute), `primary` (the accent
 * fill), `quiet` (no fill or border until hovered) and `danger` (the
 * danger fill), spec: Resolved questions 10. A quiet button takes its
 * surroundings' text color and mixes its hover and press fills from it,
 * UI Kit's `current` theme, so it reads on any fill, a frame's or a
 * selected row's included. Disabled takes the disabled theme whole.
 */
export const buttonLookStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared box; the colors are Button's
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
    // Its surroundings', so it reads on any fill (items spec, Resolved
    // questions 9).
    'variant=quiet': '#current',
    'variant=primary': '#uni-accent-fill-text',
    'variant=danger': '#uni-danger-fill-text',
    '@uni-disabled': '#uni-disabled-text',
    '@uni-forced-colors': 'ButtonText',
    '(@uni-forced-colors & @uni-disabled)': 'GrayText',
  },
} satisfies Styles;

/**
 * Button's look on a root whose label and description are `parts`: its
 * own, or a trigger's outside its component's root
 * (`[data-uni-part="popover-trigger-label"]`).
 */
export function buttonItemStyles(parts: ItemParts): Styles {
  return {
    ...buttonLookStyles,
    ...itemRootStyles(parts),
  };
}

/**
 * Button, and the look of the triggers outside other components' roots,
 * with the item look (`../shared/item.ts`) while it has a label part.
 * Typed `Styles`, not inferred: the item grid's states are built.
 */
export const buttonStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- Button's look with its own parts
  ...buttonItemStyles({ label: 'Label', description: 'Description' }),
  Label: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared item label
    ...itemLabelStyles,
  },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared item description
    ...itemDescriptionStyles,
  },
};

/** Button's frame, outside its root: the grid, in its text color. */
export const buttonFrameStyles = itemFrameStyles(buttonLookStyles.color);

/** Button's extras, outside its root. */
export const buttonExtrasStyles = itemExtrasStyles;
