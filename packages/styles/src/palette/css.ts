import { SIZES, SYSTEM_COLORS, tokenProperty } from '../tokens';
import type { Palette } from './create';
import type { Scheme } from './themes';

const LIGHT = '[data-uni-scheme="light"]';
const DARK = '[data-uni-scheme="dark"]';
// The page follows the OS unless `<html>` forces light.
const PAGE_DARK = `:root:not(${LIGHT})`;

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

/** The size and motion tokens and the system colors, on `:root`. */
export function baseCss(): string {
  return block(':root', { ...SIZES, ...SYSTEM_COLORS });
}

/**
 * A palette's colors, one flat block per scheme selector (spec: Tokens →
 * Schemes): the OS's scheme by default, `data-uni-scheme` on `<html>` or
 * any element to force one, and the high-contrast colors under
 * `prefers-contrast: more`. Each block brings its `color-scheme`.
 */
export function paletteCss(palette: Palette): string {
  const scheme = (selector: string, name: Scheme) =>
    block(
      selector,
      palette[name],
      name === 'dark' || name === 'darkContrast' ? 'dark' : 'light',
    );
  return [
    scheme(':root', 'light'),
    media('(prefers-color-scheme: dark)', [scheme(PAGE_DARK, 'dark')]),
    scheme(LIGHT, 'light'),
    scheme(DARK, 'dark'),
    media('(prefers-contrast: more)', [
      scheme(':root', 'lightContrast'),
      scheme(LIGHT, 'lightContrast'),
      scheme(DARK, 'darkContrast'),
    ]),
    media('(prefers-contrast: more) and (prefers-color-scheme: dark)', [
      scheme(PAGE_DARK, 'darkContrast'),
    ]),
  ].join('\n');
}
