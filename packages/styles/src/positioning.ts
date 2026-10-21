/**
 * `css/positioning.css` (spec: Cases → CSS positioning mode): each
 * overlay's default placement in CSS anchor positioning, for a page that
 * configures `positioning: 'css'`, where UniAria only links an overlay to
 * its anchor. The areas and fallbacks are the components' defaults, which
 * `positioning.test.ts` compares with core's. Opt-in, and the same for
 * every output: the gaps stay the components' margins.
 */

import {
  configure,
  extractStylesForSelector,
  resetConfig,
} from '@tenphi/tasty/zero';
import type { Styles } from '@tenphi/tasty';

import { excludeNestedRoots } from './build';

/**
 * Select's and Combobox's popup: below the trigger, or the anchor, from its
 * start. `inset: auto` undoes the browser's centring of a popover, here
 * and below.
 */
const pickerPlacementStyles = {
  Popover: {
    inset: 'auto',
    positionArea: 'block-end span-inline-end',
    positionTryFallbacks: 'flip-block, flip-inline',
  },
} satisfies Styles;

/** Popover: below its trigger. */
const popoverPlacementStyles = {
  inset: 'auto',
  positionArea: 'bottom',
  positionTryFallbacks: 'flip-block, flip-inline',
} satisfies Styles;

/** Tooltip: above its trigger. */
const tooltipPlacementStyles = {
  inset: 'auto',
  positionArea: 'top',
  positionTryFallbacks: 'flip-block, flip-inline',
} satisfies Styles;

/** Each component with a floating part, by its name: the root, or a part. */
export const PLACEMENTS = {
  select: pickerPlacementStyles,
  combobox: pickerPlacementStyles,
  popover: popoverPlacementStyles,
  tooltip: tooltipPlacementStyles,
} as const;

/**
 * The placements as CSS, inside `@supports (position-area: top)`: a
 * browser without anchor positioning keeps an overlay where its own styles
 * put it, as UniAria leaves it in CSS mode.
 */
export function positioningCss(): string {
  configure({});
  try {
    const rules = Object.entries(PLACEMENTS).map(([name, styles]) =>
      excludeNestedRoots(
        extractStylesForSelector(`[data-uni="${name}"]`, styles).css.trim(),
        name,
      ),
    );
    const body = rules
      .join('\n')
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    return `@supports (position-area: top) {\n${body}\n}\n`;
  } finally {
    resetConfig();
  }
}
