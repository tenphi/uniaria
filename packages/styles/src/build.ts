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
import type { ComponentName, ComponentStyles } from './components';
import { baseCss, createPalette, paletteCss } from './palette';
import type { Palette } from './palette';
import { STATES, UNITS } from './tokens';

export type { ComponentName } from './components';

export interface BuildCssOptions {
  /**
   * The colors: a palette, or `false` to leave them out and set the
   * `--uni-*-color` properties yourself. Default: the package's palette.
   */
  readonly palette?: Palette | false;
  /** The components to style. Default: all; `[]` writes the tokens only. */
  readonly components?: readonly ComponentName[];
  /** A cascade layer to put the whole stylesheet in. Default: none. */
  readonly layer?: string;
}

/**
 * A stylesheet: the size tokens and system colors, the palette, then the
 * components.
 */
export function buildCss(options: BuildCssOptions = {}): string {
  const { palette, components = COMPONENT_NAMES, layer } = options;
  const css = [
    baseCss(),
    palette === false ? '' : paletteCss(palette ?? createPalette()),
    components.length > 0 ? componentsCss(components) : '',
  ]
    .filter(Boolean)
    .join('\n');
  return layer === undefined ? css : inLayer(css, layer);
}

/** The components' rules alone, as each `<name>.css` holds them. */
export function componentsCss(names: readonly ComponentName[]): string {
  configure({
    units: { ...UNITS },
    states: { ...STATES },
    // Tasty's `#clear` is a token Tasty projects define; plain CSS has none.
    replaceTokens: { '#clear': 'transparent' },
  });
  try {
    return names.map(componentCss).join('\n');
  } finally {
    resetConfig();
  }
}

function componentCss(name: ComponentName): string {
  const component: ComponentStyles = COMPONENTS[name];
  const rules = [
    excludeNestedRoots(extract(`[data-uni="${name}"]`, component.styles), name),
  ];
  for (const [part, styles] of Object.entries(component.outside ?? {})) {
    rules.push(extract(`[data-uni-part="${name}-${part}"]`, styles));
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
