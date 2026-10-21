import { describe, expect, test } from 'vitest';

import { buildCss, componentsCss, excludeNestedRoots } from './build';
import type { BuildCssOptions } from './build';
import { COMPONENT_NAMES } from './components';
import { defaultPaletteModule, stylesheets } from './generate';
import { createPalette, paletteCss } from './palette';
import { BASE_TOKENS, baseCss } from './palette/css';

const files = stylesheets();
const file = (name: string): string => {
  const css = files[name];
  if (css === undefined) throw new Error(`No ${name}.`);
  return css;
};

describe('the prebuilt stylesheets', () => {
  // A Tasty upgrade that changes the output shows up here.
  test.each(['tokens.css', ...COMPONENT_NAMES.map((name) => `${name}.css`)])(
    '%s matches its snapshot',
    async (name) => {
      await expect(file(name)).toMatchFileSnapshot(`./__snapshots__/${name}`);
    },
  );

  test('index.css is tokens.css and every component file', () => {
    const components = COMPONENT_NAMES.map((name) => file(`${name}.css`));
    expect(file('index.css')).toBe(
      [file('tokens.css'), ...components].join('\n'),
    );
  });

  test('components.css has the size tokens and every component, no palette', () => {
    expect(file('components.css')).toBe(
      [baseCss(), componentsCss(COMPONENT_NAMES)].join('\n'),
    );
    expect(file('components.css')).not.toContain('--uni-surface-color:');
  });

  test('layered.css is index.css inside `@layer uniaria`', () => {
    const layered = file('layered.css');
    expect(layered.startsWith('@layer uniaria {\n')).toBe(true);
    expect(layered.endsWith('\n}\n')).toBe(true);
    const inner = layered
      .slice('@layer uniaria {\n'.length, -'\n}\n'.length)
      .split('\n')
      .map((line) => line.replace(/^ {2}/, ''))
      .join('\n');
    expect(inner).toBe(file('index.css').trimEnd());
  });

  test('tokens.css is the base tokens and the default palette', () => {
    expect(file('tokens.css')).toBe(
      [baseCss(), paletteCss(createPalette())].join('\n'),
    );
  });

  test('a build is deterministic', () => {
    expect(buildCss()).toBe(buildCss());
  });

  test('palette: false leaves every color token out', () => {
    expect(buildCss({ palette: false, components: [] })).toBe(baseCss());
  });
});

describe('buildCss options', () => {
  const tokensCss = (options: BuildCssOptions) =>
    buildCss({ components: [], ...options });
  /** Every value a stylesheet gives a custom property, in order. */
  const values = (css: string, property: string) =>
    [...css.matchAll(new RegExp(`${property}: ([^;]+);`, 'g'))].map(
      ([, value]) => value,
    );
  // `:root`, the OS's dark, forced light and dark, then their high
  // contrast: the palette's eight scheme blocks.
  const SCHEME_BLOCKS = 8;

  test('a size token stays on `:root`', () => {
    const css = tokensCss({ tokens: { '$uni-radius': '4px' } });
    expect(values(css, '--uni-radius')).toEqual(['4px']);
  });

  test('a color token with one value goes into every scheme’s block', () => {
    const css = tokensCss({ tokens: { '#uni-accent-outline': '#0a7' } });
    expect(values(css, '--uni-accent-outline-color')).toEqual(
      Array.from({ length: SCHEME_BLOCKS }, () => '#0a7'),
    );
  });

  test('a token with a value per scheme goes into those schemes’ blocks', () => {
    const palette = createPalette();
    const css = tokensCss({
      tokens: { '#uni-accent-outline': { light: 'red', darkContrast: 'blue' } },
    });
    expect(values(css, '--uni-accent-outline-color')).toEqual([
      'red',
      palette.dark['#uni-accent-outline'],
      'red',
      palette.dark['#uni-accent-outline'],
      palette.lightContrast['#uni-accent-outline'],
      palette.lightContrast['#uni-accent-outline'],
      'blue',
      'blue',
    ]);
  });

  test('without a palette, a color token with one value goes on `:root`', () => {
    expect(
      tokensCss({ palette: false, tokens: { '#uni-surface': 'white' } }),
    ).toBe(baseCss({ ...BASE_TOKENS, '#uni-surface': 'white' }));
  });

  test('without a palette, a role points at a property of yours', () => {
    const css = buildCss({
      palette: false,
      components: ['checkbox'],
      tokens: { '#uni-accent-fill': 'var(--brand-600)' },
    });
    expect(css).toContain('--uni-accent-fill-color: var(--brand-600);');
    expect(css).toContain('background-color: var(--uni-accent-fill-color)');
  });

  test('a name that is no token throws', () => {
    expect(() => tokensCss({ tokens: { 'uni-radius': '4px' } })).toThrow(
      'Not a Tasty token',
    );
  });

  test('extraThemes keeps only the status themes listed', () => {
    const warning = tokensCss({ extraThemes: ['warning'] });
    expect(warning).toContain('--uni-warning-surface-color:');
    expect(warning).not.toContain('--uni-note-');
    const none = tokensCss({ extraThemes: [] });
    expect(none).not.toMatch(/--uni-(warning|note)-/);
    expect(none).toContain('--uni-danger-surface-color:');
  });

  test('schemes leaves out the dark or the high-contrast blocks', () => {
    const light = tokensCss({ schemes: { dark: false } });
    expect(light).not.toContain('prefers-color-scheme');
    expect(light).not.toContain('data-uni-scheme');
    expect(values(light, '--uni-surface-color')).toHaveLength(2);
    const normal = tokensCss({ schemes: { highContrast: false } });
    expect(normal).not.toContain('prefers-contrast');
    expect(values(normal, '--uni-surface-color')).toHaveLength(4);
    expect(tokensCss({ schemes: { dark: false, highContrast: false } })).toBe(
      [
        baseCss(),
        paletteCss(createPalette(), { dark: false, highContrast: false }),
      ].join('\n'),
    );
  });

  test('overrides merge into a component and a part outside its root', () => {
    const options: BuildCssOptions = {
      palette: false,
      components: ['checkbox', 'popover'],
    };
    const css = buildCss({
      ...options,
      overrides: {
        checkbox: { Indicator: { radius: '2r' } },
        'popover-trigger': { fill: { hovered: '#uni-note-fill' } },
      },
    });
    expect(buildCss(options)).not.toContain('calc(2 * var(--uni-radius))');
    expect(css).toMatch(
      /\[data-uni="checkbox"\] \[data-element="Indicator"\][^{]* \{[^}]*border-radius: calc\(2 \* var\(--uni-radius\)\)/,
    );
    expect(css).toMatch(
      /\[data-uni-part="popover-trigger"\]:where\(\[data-hovered\][^{]*\{ background-color: var\(--uni-note-fill-color\)/,
    );
  });
});

describe('the default palette’s data', () => {
  test('is the default palette', async () => {
    const url = `data:text/javascript,${encodeURIComponent(defaultPaletteModule())}`;
    const { DEFAULT_PALETTE } = (await import(/* @vite-ignore */ url)) as {
      DEFAULT_PALETTE: unknown;
    };
    expect(DEFAULT_PALETTE).toStrictEqual(createPalette());
  });
});

describe('excludeNestedRoots', () => {
  const exclusion =
    ':where(:not([data-uni="x"] [data-uni]:not([data-uni="x"]) *))';

  test('marks each part a rule styles, before a pseudo-element', () => {
    expect(
      excludeNestedRoots(
        '[data-uni="x"] [data-element="A"]::before { color: red; }',
        'x',
      ),
    ).toBe(
      `[data-uni="x"] [data-element="A"]${exclusion}::before { color: red; }`,
    );
  });

  test('marks the rules inside an at-rule, not the at-rule', () => {
    expect(
      excludeNestedRoots(
        '@media (forced-colors: active) {\n  [data-uni="x"] [data-element="A"] { color: red; }\n}',
        'x',
      ),
    ).toBe(
      `@media (forced-colors: active) {\n  [data-uni="x"] [data-element="A"]${exclusion} { color: red; }\n}`,
    );
  });

  test('leaves a part a state tests inside parentheses', () => {
    const css =
      '[data-uni="x"]:where(:has([data-element="Input"]:checked)) { color: red; }';
    expect(excludeNestedRoots(css, 'x')).toBe(css);
  });

  test('leaves the root rules', () => {
    const css =
      '[data-uni="x"] { color: red; }\n[data-uni="x"]:where([data-selected]) { color: blue; }';
    expect(excludeNestedRoots(css, 'x')).toBe(css);
  });
});
