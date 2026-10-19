/** The palette: Glaze themes and roles, and the CSS for their tokens. */

export { createPalette } from './create';
export type { Palette, PaletteSeeds } from './create';
export { baseCss, paletteCss } from './css';
export {
  colorToken,
  DEFAULT_ONLY,
  ROLES,
  SCHEMES,
  SEEDS,
  THEMES,
} from './themes';
export type { Role, Scheme, Theme, ThemeSeed } from './themes';
