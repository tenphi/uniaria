import { SIZES, tokenProperty } from '../tokens';
import type { Palette } from './create';
import type { Scheme } from './themes';

export const LIGHT = '[data-uni-scheme="light"]';
export const DARK = '[data-uni-scheme="dark"]';
// The page follows the OS unless `<html>` forces light.
export const PAGE_DARK = `:root:not(${LIGHT})`;

/** The schemes a stylesheet has besides light. Default: both. */
export interface SchemeOptions {
  /** Dark: the OS's, or forced with `data-uni-scheme="dark"`. */
  readonly dark?: boolean;
  /** High contrast, under `prefers-contrast: more`. */
  readonly highContrast?: boolean;
}

/** The tokens on `:root` in every scheme: the sizes. */
export const BASE_TOKENS: Readonly<Record<string, string>> = SIZES;

function block(
  selector: string,
  declarations: Readonly<Record<string, string>>,
  colorScheme?: 'light' | 'dark',
): string {
  const lines = Object.entries(declarations).map(
    ([token, value]) => `  ${tokenProperty(token)}: ${value};`,
  );
  if (colorScheme) lines.unshift(`  color-scheme: ${colorScheme};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

function media(query: string, blocks: readonly string[]): string {
  const inner = blocks
    .join('\n')
    .trimEnd()
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  return `@media ${query} {\n${inner}\n}\n`;
}

/** The size and motion tokens, on `:root`. */
export function baseCss(
  tokens: Readonly<Record<string, string>> = BASE_TOKENS,
): string {
  return block(':root', tokens);
}

/**
 * A palette's colors, one flat block per scheme selector (spec: Tokens →
 * Schemes): the OS's scheme by default, `data-uni-scheme` on `<html>` or
 * any element to force one, and the high-contrast colors under
 * `prefers-contrast: more`. Each block brings its `color-scheme`. Without
 * the dark or the high-contrast scheme, their blocks are left out.
 */
export function paletteCss(
  palette: Palette,
  schemes: SchemeOptions = {},
): string {
  const { dark = true, highContrast = true } = schemes;
  const scheme = (selector: string, name: Scheme) =>
    block(
      selector,
      palette[name],
      name === 'dark' || name === 'darkContrast' ? 'dark' : 'light',
    );
  const blocks = [scheme(':root', 'light')];
  if (dark) {
    blocks.push(
      media('(prefers-color-scheme: dark)', [scheme(PAGE_DARK, 'dark')]),
      scheme(LIGHT, 'light'),
      scheme(DARK, 'dark'),
    );
  }
  if (highContrast) {
    blocks.push(
      media(
        '(prefers-contrast: more)',
        dark
          ? [
              scheme(':root', 'lightContrast'),
              scheme(LIGHT, 'lightContrast'),
              scheme(DARK, 'darkContrast'),
            ]
          : [scheme(':root', 'lightContrast')],
      ),
    );
  }
  if (dark && highContrast) {
    blocks.push(
      media('(prefers-contrast: more) and (prefers-color-scheme: dark)', [
        scheme(PAGE_DARK, 'darkContrast'),
      ]),
    );
  }
  return blocks.join('\n');
}
