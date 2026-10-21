/**
 * `@uniaria/styles/build` — `buildCss()`, the stylesheets from the Tasty
 * source (spec: Outputs → Customized CSS, Build). Node only: Tasty's
 * extractor reads Node built-ins, and its configuration is one global
 * object, which every call sets, uses and resets before it returns.
 */

import {
  configure,
  extractStylesForSelector,
  resetConfig,
} from '@tenphi/tasty/zero';
import type { Styles } from '@tenphi/tasty';

import { COMPONENT_NAMES, COMPONENTS } from './components';
import type {
  ComponentName,
  ComponentStyles,
  StylesTarget,
} from './components';
import { mergeStyles } from './merge';
import { createPalette } from './palette/create';
import type { Palette } from './palette/create';
import { baseCss, paletteCss } from './palette/css';
import type { SchemeOptions } from './palette/css';
import { tokenSheet } from './palette/sheet';
import type { ExtraTheme, TokenValues } from './palette/sheet';
import { STATES, UNITS } from './tokens';

export type { ComponentName, StylesTarget } from './components';
export type { Palette } from './palette/create';
export type { SchemeOptions } from './palette/css';
export type { ExtraTheme, TokenValue, TokenValues } from './palette/sheet';

export interface ComponentsCssOptions {
  /**
   * Styles merged into a component's, by its name, or into a part outside
   * its root, by the part's marker (`'popover-trigger'`), with Tasty's
   * merge rules.
   */
  readonly overrides?: Readonly<Partial<Record<StylesTarget, Styles>>>;
}

export interface BuildCssOptions extends ComponentsCssOptions {
  /**
   * The colors: a palette, or `false` to leave them out and set the
   * `--uni-*-color` properties yourself. Default: the package's palette.
   */
  readonly palette?: Palette | false;
  /**
   * Tokens over the sizes and the palette, as CSS: one value for every
   * scheme, or one per scheme (`light`, `dark`, `lightContrast`,
   * `darkContrast`).
   */
  readonly tokens?: TokenValues;
  /** The components to style. Default: all; `[]` writes the tokens only. */
  readonly components?: readonly ComponentName[];
  /** The status themes no component uses to keep. Default: both. */
  readonly extraThemes?: readonly ExtraTheme[];
  /** The schemes besides light. Default: dark and high contrast. */
  readonly schemes?: SchemeOptions;
  /** A cascade layer to put the whole stylesheet in. Default: none. */
  readonly layer?: string;
}

/**
 * A stylesheet: the size tokens and system colors, the palette, then the
 * components.
 */
export function buildCss(options: BuildCssOptions = {}): string {
  const { components = COMPONENT_NAMES, layer } = options;
  const sheet = tokenSheet({
    palette:
      options.palette === false ? false : (options.palette ?? createPalette()),
    tokens: options.tokens,
    extraThemes: options.extraThemes,
  });
  const css = [
    baseCss(sheet.base),
    sheet.palette ? paletteCss(sheet.palette, options.schemes) : '',
    components.length > 0 ? componentsCss(components, options) : '',
  ]
    .filter(Boolean)
    .join('\n');
  return layer === undefined ? css : inLayer(css, layer);
}

/** The components' rules alone, as each `<name>.css` holds them. */
export function componentsCss(
  names: readonly ComponentName[],
  options: ComponentsCssOptions = {},
): string {
  configure({ units: { ...UNITS }, states: { ...STATES } });
  try {
    return names
      .map((name) => componentCss(name, options.overrides ?? {}))
      .join('\n');
  } finally {
    resetConfig();
  }
}

function componentCss(
  name: ComponentName,
  overrides: Readonly<Partial<Record<string, Styles>>>,
): string {
  const component: ComponentStyles = COMPONENTS[name];
  const merged = (styles: Styles, target: string) => {
    const override = overrides[target];
    return override ? mergeStyles(styles, override) : styles;
  };
  const rules = [
    excludeNestedRoots(
      extract(`[data-uni="${name}"]`, merged(component.styles, name)),
      name,
    ),
  ];
  for (const [part, styles] of Object.entries(component.outside ?? {})) {
    const marker = `${name}-${part}`;
    rules.push(extract(`[data-uni-part="${marker}"]`, merged(styles, marker)));
  }
  return `/* ${name} */\n${rules.join('\n')}`;
}

function extract(selector: string, styles: Styles): string {
  return `${extractStylesForSelector(selector, styles).css.trim()}\n`;
}

/**
 * Keeps a component's part rules off the parts of another component nested
 * in it (spec: Selectors): each `[data-element]` a rule's selector styles
 * gets `:where(:not(<root> [data-uni]:not(<root>) *))`, so a part rule
 * stays (0,2,0). Those inside a pseudo-class's parentheses, such as a
 * state's `:has()`, only test a part, so they keep their selector.
 */
export function excludeNestedRoots(css: string, name: string): string {
  const root = `[data-uni="${name}"]`;
  const exclusion = `:where(:not(${root} [data-uni]:not(${root}) *))`;
  const depthAt = (text: string, end: number) => {
    let depth = 0;
    for (let i = 0; i < end; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
    }
    return depth;
  };
  // A rule's prelude: the text between a brace (or the start) and a `{`.
  return css.replace(
    /(^|[{}])([^{}]*)(?=\{)/g,
    (match, brace: string, prelude: string) =>
      prelude.trimStart().startsWith('@')
        ? match
        : brace +
          prelude.replace(
            /\[data-element="[^"]+"\]/g,
            (part, offset: number) =>
              depthAt(prelude, offset) === 0 ? `${part}${exclusion}` : part,
          ),
  );
}

function inLayer(css: string, layer: string): string {
  const body = css
    .trimEnd()
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
  return `@layer ${layer} {\n${body}\n}\n`;
}
