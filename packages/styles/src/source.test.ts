/**
 * What the source may use (spec: Source of truth, Web platform baseline,
 * Specificity and overrides), checked on the style objects and the CSS
 * built from them.
 */

import type { Styles } from '@tenphi/tasty';
import { partElement } from '@uniaria/core';
import { autocomplete } from '@uniaria/core/autocomplete';
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
import type { ComponentName, ComponentStyles } from './components';
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
  autocomplete,
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

/** How many parentheses are open at `end`. */
function depthAt(text: string, end: number): number {
  let depth = 0;
  for (let i = 0; i < end; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
  }
  return depth;
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

/** The end of the group a `(` at `start` opens. */
function groupEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return text.length;
}

/**
 * A state key without what tests the DOM rather than a state: structural
 * pseudo-classes, `@parent()` and attribute selectors.
 */
function withoutStructure(key: string): string {
  let rest = '';
  for (let i = 0; i < key.length;) {
    const match = /^(?::(?:has|is|not|where)|@parent)\(/.exec(key.slice(i));
    if (match) {
      i = groupEnd(key, i + match[0].length - 1) + 1;
      continue;
    }
    rest += key[i++];
  }
  return rest.replaceAll(/\[[^\]]*\]/g, '');
}

type Specificity = [number, number, number];

const larger = (a: Specificity, b: Specificity): Specificity =>
  a[0] !== b[0]
    ? a[0] > b[0]
      ? a
      : b
    : a[1] !== b[1]
      ? a[1] > b[1]
        ? a
        : b
      : a[2] >= b[2]
        ? a
        : b;

/**
 * A selector's specificity, as [ids, classes, elements]: `:where()` counts
 * nothing, and `:is()`, `:not()` and `:has()` their largest argument.
 */
function specificity(selector: string): Specificity {
  let total: Specificity = [0, 0, 0];
  let counted = '';
  for (let i = 0; i < selector.length;) {
    const match = /^:(has|is|not|where)\(/.exec(selector.slice(i));
    if (!match) {
      counted += selector[i++];
      continue;
    }
    const open = i + match[0].length - 1;
    const end = groupEnd(selector, open);
    if (match[1] !== 'where') {
      const inner = splitList(selector.slice(open + 1, end))
        .map((argument) => specificity(argument.replace(/^[>~+]\s*/, '')))
        .reduce(larger, [0, 0, 0]);
      total = [total[0] + inner[0], total[1] + inner[1], total[2] + inner[2]];
    }
    i = end + 1;
  }
  const count = (pattern: RegExp) => counted.match(pattern)?.length ?? 0;
  return [
    total[0] + count(/#[\w-]+/g),
    total[1] +
      count(/\[[^\]]*\]/g) +
      count(/\.[a-z_][\w-]*/gi) +
      count(/(?<!:):[\w-]+/g),
    total[2] + count(/::[\w-]+/g),
  ];
}

describe.each(COMPONENT_NAMES)('%s', (name) => {
  const component: ComponentStyles = COMPONENTS[name];
  const { styles, outside = {} } = component;

  test('styles only the parts of its definition', () => {
    const elements = [
      ...[...DEFINITIONS[name].parts, ...(DEFINITIONS[name].itemParts ?? [])]
        .filter((part) => part !== 'root')
        .map(partElement),
      ...(OWN_ELEMENTS[name] ?? []),
    ];
    // Keys with a `$` that names no part reach the consumer's elements in
    // a part (the item grid's), so the CSS is what counts.
    for (const prelude of selectors(componentsCss([name]))) {
      for (const match of prelude.matchAll(/\[data-element="(\w+)"\]/g)) {
        // A part a state tests inside a pseudo-class is an alias's own.
        if (depthAt(prelude, match.index) === 0)
          expect(elements).toContain(match[1]);
      }
    }
  });

  test('reads only the states UniAria writes, data-variant and its aliases', () => {
    const objects = [styles, ...Object.values(outside)];
    for (const key of objects.flatMap(stateKeys)) {
      const terms = withoutStructure(key)
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
    // Relative color syntax, which `#token.N` alpha compiled to before Tasty 3.12.
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
      ...[...css.matchAll(/(--[\w-]+):/g)].map((match) => match[1]),
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
          // A part a state tests inside a pseudo-class, such as `:has()`,
          // is left as it is.
          .filter((match) => depthAt(prelude, match.index) === 0);
        expect(bare, prelude).toEqual([]);
        if (parts) expect(prelude).toContain(exclusion);
      }
    }
  });
});
