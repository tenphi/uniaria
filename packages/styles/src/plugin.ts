/**
 * `@uniaria/styles/tasty` — `uniaria()`, the Tasty plugin the style objects
 * need (spec: Outputs → Tasty style objects, Configuration at run time):
 * the token blocks of `tokens.css` as global styles, one per scheme
 * selector, and the state aliases. It sets no units: the objects take the
 * project's.
 */

import type { Styles, TastyPlugin } from '@tenphi/tasty';
import { DEFAULT_PALETTE } from '#default-palette';

import type { Palette } from './palette/create';
import { DARK, LIGHT, PAGE_DARK } from './palette/css';
import { tokenSheet } from './palette/sheet';
import type { TokenSheet, TokenValues } from './palette/sheet';
import { SCHEMES } from './palette/themes';
import type { Scheme } from './palette/themes';
import { STATES, SYSTEM_COLORS } from './tokens';

export type { Palette } from './palette/create';
export type { TokenValue, TokenValues } from './palette/sheet';

export interface UniariaOptions {
  /**
   * The colors: a palette from `createPalette()`, or `false` to leave them
   * out and point the roles at your own. Default: the package's palette.
   */
  readonly palette?: Palette | false;
  /**
   * Single tokens, in Tasty's syntax, with one value for every scheme or
   * one per scheme (`light`, `dark`, `lightContrast`, `darkContrast`).
   */
  readonly tokens?: TokenValues;
}

/** The plugin, for `configure({ plugins: [uniaria()] })`. */
export function uniaria(options: UniariaOptions = {}): TastyPlugin {
  const sheet = tokenSheet({
    palette: options.palette ?? DEFAULT_PALETTE,
    tokens: options.tokens,
  });
  return {
    name: 'uniaria',
    states: { ...STATES },
    globalStyles: globalStyles(sheet),
  };
}

const CONTRAST = '@media(prefers-contrast: more)';
const OS_DARK = '@media(prefers-color-scheme: dark)';

/**
 * The token blocks as Tasty global styles (spec: Tokens → Schemes): a
 * scheme's high-contrast colors are a state of its selector, and the OS's
 * dark scheme a state of the page's. A system color is held in
 * `color-mix()`, since Tasty takes no system color in a color token (spec:
 * Tasty gaps 18).
 */
function globalStyles(sheet: TokenSheet): Record<string, Styles> {
  const root: Record<string, unknown> = {};
  for (const [token, value] of Object.entries(sheet.base)) {
    root[token] =
      token in SYSTEM_COLORS ? `color-mix(in srgb, ${value}, ${value})` : value;
  }
  const { palette } = sheet;
  if (!palette) return { ':root': root as Styles };
  const tokens = [
    ...new Set(SCHEMES.flatMap((scheme) => Object.keys(palette[scheme]))),
  ];
  // A scheme selector's block: each token's value under each state.
  const block = (
    colorScheme: unknown,
    states: Readonly<Record<string, Scheme>>,
  ): Record<string, unknown> => {
    const styles: Record<string, unknown> = { colorScheme };
    for (const token of tokens) {
      const map: Record<string, string> = {};
      for (const [state, scheme] of Object.entries(states)) {
        const value = palette[scheme][token];
        if (value !== undefined) map[state] = value;
      }
      if (Object.keys(map).length > 0) styles[token] = map;
    }
    return styles;
  };
  const light = { '': 'light', [CONTRAST]: 'lightContrast' } as const;
  return {
    ':root': { ...root, ...block('light', light) } as Styles,
    [PAGE_DARK]: block(
      { [OS_DARK]: 'dark' },
      { [OS_DARK]: 'dark', [`${OS_DARK} & ${CONTRAST}`]: 'darkContrast' },
    ) as Styles,
    [LIGHT]: block('light', light) as Styles,
    [DARK]: block('dark', { '': 'dark', [CONTRAST]: 'darkContrast' }) as Styles,
  };
}
