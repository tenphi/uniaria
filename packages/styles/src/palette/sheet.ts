/**
 * The tokens an output writes (spec: Outputs, Configuration at run time):
 * the sizes and system colors, the palette, and the consumer's tokens over
 * both. `buildCss()` writes them as CSS, the Tasty plugin as global styles.
 */

import { tokenProperty } from '../tokens';
import type { Palette } from './create';
import { BASE_TOKENS } from './css';
import { SCHEMES } from './themes';
import type { Scheme } from './themes';

/** A token's value: one for every scheme, or one per scheme. */
export type TokenValue = string | Readonly<Partial<Record<Scheme, string>>>;

/** Tokens by name: `$uni-radius`, `#uni-accent-outline`. */
export type TokenValues = Readonly<Record<string, TokenValue>>;

/**
 * The status themes no component uses, written for the consumer's own
 * (spec: Resolved questions 14).
 */
export const EXTRA_THEMES = ['warning', 'note'] as const;

export type ExtraTheme = (typeof EXTRA_THEMES)[number];

export interface TokenSheetOptions {
  /** The colors, or `false` for none. */
  readonly palette: Palette | false;
  /** Tokens over the sizes and the palette. */
  readonly tokens?: TokenValues;
  /** The status themes to keep. Default: both. */
  readonly extraThemes?: readonly ExtraTheme[];
}

export interface TokenSheet {
  /** On `:root`, the same in every scheme. */
  readonly base: Readonly<Record<string, string>>;
  /** One map per scheme; none without a palette or a per-scheme token. */
  readonly palette?: Palette;
}

/**
 * Lays tokens out by scheme. A size or a system color, given one value,
 * stays on `:root`; a color, given one value, goes into every scheme's
 * block, or else a forced scheme would keep the palette's; a value per
 * scheme goes into those schemes' blocks.
 */
export function tokenSheet(options: TokenSheetOptions): TokenSheet {
  const { palette, tokens = {}, extraThemes = EXTRA_THEMES } = options;
  const dropped = EXTRA_THEMES.filter((theme) => !extraThemes.includes(theme));
  const isKept = (token: string) =>
    !dropped.some((theme) => token.startsWith(`#uni-${theme}-`));
  const base: Record<string, string> = { ...BASE_TOKENS };
  let schemes: Record<Scheme, Record<string, string>> | undefined = palette
    ? mapSchemes((scheme) =>
        Object.fromEntries(
          Object.entries(palette[scheme]).filter(([token]) => isKept(token)),
        ),
      )
    : undefined;
  for (const [token, value] of Object.entries(tokens)) {
    // Throws on a name that is no token.
    tokenProperty(token);
    const isBase =
      token.startsWith('$') || token in BASE_TOKENS || schemes === undefined;
    if (typeof value === 'string' && isBase) {
      base[token] = value;
      continue;
    }
    schemes ??= mapSchemes(() => ({}));
    for (const scheme of SCHEMES) {
      const at = typeof value === 'string' ? value : value[scheme];
      if (at !== undefined) schemes[scheme][token] = at;
    }
  }
  return schemes ? { base, palette: schemes } : { base };
}

function mapSchemes<T>(map: (scheme: Scheme) => T): Record<Scheme, T> {
  return Object.fromEntries(
    SCHEMES.map((scheme) => [scheme, map(scheme)]),
  ) as Record<Scheme, T>;
}
