/**
 * Node-side commands for this package's browser tests, registered in the
 * root Vitest config beside `uniCommands`. Tasty's extractor reads Node
 * built-ins, so a browser test asks Node for the CSS: no build first.
 */

import type { BrowserCommand } from 'vitest/node';

import { buildCss } from '../build';
import type { BuildCssOptions } from '../build';
import { positioningCss } from '../positioning';

export const uniStylesCss: BrowserCommand<[options?: BuildCssOptions]> = (
  _context,
  options,
) => buildCss(options);

/** `css/positioning.css`. */
export const uniStylesPositioningCss: BrowserCommand<[]> = () =>
  positioningCss();

export const stylesCommands = { uniStylesCss, uniStylesPositioningCss };
