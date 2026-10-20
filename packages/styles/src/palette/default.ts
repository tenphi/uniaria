/**
 * The default palette, which the Tasty plugin takes when it is given none.
 * The plugin imports it as `#default-palette` (package.json `imports`): in
 * the source, this module, which runs Glaze; in the build,
 * `dist/default-palette.js`, the same palette as data, which the build
 * writes, so the plugin needs no Glaze (spec: Configuration at run time).
 */

import { createPalette } from './create';
import type { Palette } from './create';

export const DEFAULT_PALETTE: Palette = createPalette();
