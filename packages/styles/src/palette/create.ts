import { glaze } from '@tenphi/glaze';
import type { GlazeTheme } from '@tenphi/glaze';

import {
  colorToken,
  DEFAULT_COLORS,
  GLAZE_CONFIG,
  SCHEMES,
  SEEDS,
  THEME_COLORS,
  THEMES,
} from './themes';
import type { Scheme, Theme, ThemeSeed } from './themes';

/** Seeds to change; a theme or a field left out keeps the package's. */
export type PaletteSeeds = Readonly<Partial<Record<Theme, Partial<ThemeSeed>>>>;

/** Each scheme's colors, by token name (`#uni-accent-fill`), as CSS values. */
export type Palette = Readonly<
  Record<Scheme, Readonly<Record<string, string>>>
>;

/**
 * Runs Glaze over the themes (`./themes.ts`) with the given seeds, for
 * every scheme. Without seeds it gives the default palette.
 */
export function createPalette(seeds: PaletteSeeds = {}): Palette {
  const seed = (theme: Theme): ThemeSeed => ({
    ...SEEDS[theme],
    ...seeds[theme],
  });
  const base = glaze(seed('default'), undefined, GLAZE_CONFIG);
  base.colors(DEFAULT_COLORS);
  const themes: Record<string, GlazeTheme> = {};
  for (const theme of THEMES) {
    themes[theme] =
      theme === 'default'
        ? base
        : base.extend({ ...seed(theme), colors: THEME_COLORS[theme] });
  }
  const tokens = glaze.palette(themes).tokens({
    prefix: { default: '' },
    modes: { dark: true, highContrast: true },
  });
  const palette = {} as Record<Scheme, Record<string, string>>;
  for (const scheme of SCHEMES) {
    const colors = tokens[scheme];
    if (!colors) throw new Error(`[uniaria] Glaze gave no ${scheme} scheme.`);
    palette[scheme] = Object.fromEntries(
      Object.entries(colors).map(([name, value]) => [
        colorToken('default', name),
        value,
      ]),
    );
  }
  return palette;
}
