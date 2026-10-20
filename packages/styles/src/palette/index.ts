/**
 * `@uniaria/styles/palette` — palettes from Glaze seeds, and the CSS for
 * their tokens (spec: Configuration at run time). `createPalette()` runs
 * Glaze, in Node and in the browser; `buildCss()`, `uniaria()` and
 * `paletteCss()` all take its result.
 */

export { createPalette } from './create';
export type { Palette, PaletteSeeds } from './create';
export { paletteCss } from './css';
export type { SchemeOptions } from './css';
export {
  colorToken,
  DEFAULT_ONLY,
  ROLES,
  SCHEMES,
  SEEDS,
  THEMES,
} from './themes';
export type { Role, Scheme, Theme, ThemeSeed } from './themes';
