import { describe, expect, test } from 'vitest';

import { buildCss, componentsCss, excludeNestedRoots } from './build';
import { COMPONENT_NAMES } from './components';
import { stylesheets } from './generate';
import { baseCss, createPalette, paletteCss } from './palette';

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
