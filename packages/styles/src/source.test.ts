/**
 * What the source may use (spec: Source of truth, Web platform baseline,
 * Specificity and overrides), checked on the style objects and the CSS
 * built from them.
 */

import type { Styles } from '@tenphi/tasty';
import { partElement } from '@uniaria/core';
import { button } from '@uniaria/core/button';
import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { combobox } from '@uniaria/core/combobox';
import { dialog } from '@uniaria/core/dialog';
import { field } from '@uniaria/core/field';
import { listbox } from '@uniaria/core/listbox';
import { numberField } from '@uniaria/core/number-field';
import { popover } from '@uniaria/core/popover';
import { radio } from '@uniaria/core/radio';
import { radioGroup } from '@uniaria/core/radio-group';
import { select } from '@uniaria/core/select';
import { toggleSwitch } from '@uniaria/core/switch';
import { textField } from '@uniaria/core/text-field';
import { toggleButton } from '@uniaria/core/toggle-button';
import { tooltip } from '@uniaria/core/tooltip';
import { describe, expect, test } from 'vitest';

import { buildCss, componentsCss } from './build';
import { COMPONENT_NAMES, COMPONENTS } from './components';
import type { ComponentName } from './components';
import { baseCss, createPalette, paletteCss } from './palette';
import { STATES } from './tokens';

const DEFINITIONS: Record<
  ComponentName,
  {
    readonly parts: readonly string[];
    readonly itemParts?: readonly string[];
  }
> = {
  button,
  'toggle-button': toggleButton,
  checkbox,
  switch: toggleSwitch,
  radio,
  'checkbox-group': checkboxGroup,
  'radio-group': radioGroup,
  field,
  'text-field': textField,
  'number-field': numberField,
  listbox,
  select,
  combobox,
  dialog,
  popover,
  tooltip,
};

/** Elements of the consumer's own that the styles expect, by component. */
const OWN_ELEMENTS: Partial<Record<ComponentName, readonly string[]>> = {
  // The thumb inside the track (spec: Components).
  switch: ['Thumb'],
};

/** The state attributes UniAria writes, in Tasty's names. */
const UNIARIA_STATES = new Set([
  'selected',
  'hovered',
  'pressed',
  'focused',
  'focus-visible',
  'focus-within',
  'disabled',
  'readonly',
  'invalid',
  'required',
  'indeterminate',
  'open',
  'entering',
  'exiting',
  'placement',
  'orientation',
  'placeholder',
  'empty',
  'virtualized',
  'instant',
]);

/** Attributes the consumer writes, which the styles read. */
const CONSUMER_STATES = new Set(['variant']);

type StyleValue = Styles[string];

/** Every state key in a style object, sub-elements included. */
function stateKeys(styles: Styles): string[] {
  const keys: string[] = [];
  for (const [name, value] of Object.entries(styles) as [
    string,
    StyleValue,
  ][]) {
    if (typeof value !== 'object' || value === null) continue;
    if (/^[A-Z&]/.test(name)) keys.push(...stateKeys(value as Styles));
    else keys.push(...Object.keys(value).filter((key) => key !== ''));
  }
  return keys;
}

/** The rule preludes in a stylesheet, at-rules left out. */
function selectors(css: string): string[] {
  return [...css.matchAll(/(?:^|[{}])([^{}]*)(?=\{)/g)]
    .map((match) => (match[1] ?? '').trim())
    .filter((prelude) => prelude && !prelude.startsWith('@'));
}

/** A selector list's selectors: its commas outside any parentheses. */
function splitList(list: string): string[] {
  const parts = [''];
  let depth = 0;
  for (const char of list) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ',' && depth === 0) parts.push('');
    else parts[parts.length - 1] += char;
  }
  return parts.map((part) => part.trim());
}

/** A selector without its `:where()` groups, which count for nothing. */
function withoutWhere(selector: string): string {
  let counted = '';
  for (let i = 0; i < selector.length;) {
    if (!selector.startsWith(':where(', i)) {
      counted += selector[i++];
      continue;
    }
    let depth = 0;
    for (i += ':where'.length; i < selector.length; i++) {
      if (selector[i] === '(') depth++;
      else if (selector[i] === ')' && --depth === 0) break;
    }
    i++;
  }
  return counted;
}

/** A selector's specificity, as [ids, classes, elements]. */
function specificity(selector: string): [number, number, number] {
  const counted = withoutWhere(selector);
  const count = (pattern: RegExp) => counted.match(pattern)?.length ?? 0;
  return [
    count(/#[\w-]+/g),
    count(/\[[^\]]*\]/g) + count(/\.[a-z_][\w-]*/gi) + count(/(?<!:):[\w-]+/g),
    count(/::[\w-]+/g),
  ];
}

describe.each(COMPONENT_NAMES)('%s', (name) => {
  const { styles } = COMPONENTS[name];

  test('styles only the parts of its definition', () => {
    const elements = [
      ...[...DEFINITIONS[name].parts, ...(DEFINITIONS[name].itemParts ?? [])]
        .filter((part) => part !== 'root')
        .map(partElement),
      ...(OWN_ELEMENTS[name] ?? []),
    ];
    const subElements = Object.keys(styles).filter((key) => /^[A-Z]/.test(key));
    for (const element of subElements) expect(elements).toContain(element);
  });

  test('reads only the states UniAria writes, data-variant and its aliases', () => {
    for (const key of stateKeys(styles)) {
      const terms = key
        .replaceAll('@own(', '(')
        .split(/[\s&|!^()]+/)
        .filter(Boolean);
      for (const term of terms) {
        if (term.startsWith('@')) {
          expect(Object.keys(STATES), key).toContain(term);
          continue;
        }
        const [state = ''] = term.split('=');
        expect(
          UNIARIA_STATES.has(state) || CONSUMER_STATES.has(state),
          `${term} in "${key}"`,
        ).toBe(true);
      }
    }
  });

  test('keeps every rule flat: a root (0,1,0), a part (0,2,0)', () => {
    for (const prelude of selectors(componentsCss([name]))) {
      for (const selector of splitList(prelude)) {
        const isPart = withoutWhere(selector).includes('[data-element=');
        const [ids, classes] = specificity(selector);
        expect([ids, classes], selector).toEqual([0, isPart ? 2 : 1]);
      }
    }
  });
});

describe('the built CSS', () => {
  const css = buildCss();

  test('has no syntax the web platform baseline rules out', () => {
    expect(css).not.toMatch(/@starting-style/);
    expect(css).not.toMatch(/light-dark\(/);
    // Relative color syntax, which `#token.N` alpha compiles to.
    expect(css).not.toMatch(
      /\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(\s*from\b/,
    );
    expect(css).not.toMatch(/@property/);
    expect(css).not.toMatch(/allow-discrete/);
    expect(css).not.toMatch(/@keyframes/);
    expect(css).not.toMatch(/@scope/);
  });

  test('reads only the custom properties tokens.css, UniAria or a component defines', () => {
    const defined = new Set([
      ...[
        ...`${baseCss()}${paletteCss(createPalette())}${componentsCss(COMPONENT_NAMES)}`.matchAll(
          /(--[\w-]+):/g,
        ),
      ].map((match) => match[1]),
      // A popover's room, which UniAria measures (Popover spec).
      '--anchor-width',
      '--available-width',
      '--available-height',
    ]);
    const used = new Set(
      [...componentsCss(COMPONENT_NAMES).matchAll(/var\((--[\w-]+)/g)].map(
        (match) => match[1],
      ),
    );
    for (const property of used) expect(defined).toContain(property);
  });

  test('keeps every part rule off the parts of a nested root', () => {
    for (const name of COMPONENT_NAMES) {
      const exclusion = `:where(:not([data-uni="${name}"] [data-uni]:not([data-uni="${name}"]) *))`;
      for (const prelude of selectors(componentsCss([name]))) {
        const parts = prelude.match(
          /\[data-element="[^"]+"\]:where\(:not\(\[data-uni=/g,
        );
        const bare = [
          ...prelude.matchAll(
            /\[data-element="[^"]+"\](?!:where\(:not\(\[data-uni=)/g,
          ),
        ]
          // A part a state tests inside `:has()` is left as it is.
          .filter((match) => !prelude.slice(0, match.index).includes(':has('));
        expect(bare, prelude).toEqual([]);
        if (parts) expect(prelude).toContain(exclusion);
      }
    }
  });
});
