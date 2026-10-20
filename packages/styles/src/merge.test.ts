import { mergeStyles as tastyMergeStyles } from '@tenphi/tasty';
import type { Styles } from '@tenphi/tasty';
import { describe, expect, test } from 'vitest';

import { COMPONENTS } from './components';
import { mergeStyles } from './merge';

/** Each case merges an override into a base, as `buildCss()` does. */
const CASES: readonly (readonly [string, Styles, Styles])[] = [
  ['a property replaces the base’s', { padding: '1x', gap: 0 }, { gap: '2x' }],
  [
    'a state map without `""` extends the base’s',
    { fill: { '': '#a', hovered: '#b' } },
    { fill: { pressed: '#c', hovered: '#d' } },
  ],
  [
    'a state map with `""` replaces the base’s',
    { fill: { '': '#a', hovered: '#b' } },
    { fill: { '': '#c', pressed: '#d' } },
  ],
  [
    'a state map extends a plain value',
    { fill: '#a' },
    { fill: { hovered: '#b' } },
  ],
  [
    '`null` drops a state, `@inherit` keeps the base’s',
    { fill: { '': '#a', hovered: '#b', pressed: '#c' } },
    { fill: { hovered: null, pressed: '@inherit', disabled: '#d' } },
  ],
  [
    '`@inherit` in a replacing map',
    { fill: { '': '#a', hovered: '#b' } },
    { fill: { '': '#c', hovered: '@inherit' } },
  ],
  ['`null` removes a property', { fill: '#a', color: '#b' }, { fill: null }],
  [
    'a sub-element merges one level deep',
    { Indicator: { radius: '1r', fill: { '': '#a', selected: '#b' } } },
    { Indicator: { radius: '0.5r', fill: { disabled: '#c' } } },
  ],
  [
    '`null` or `false` removes a sub-element',
    { Indicator: { radius: '1r' }, Label: { color: '#a' } },
    { Indicator: null, Label: false },
  ],
  [
    'a pseudo-element is a sub-element',
    { '&::before': { content: '""', fill: '#a' } },
    { '&::before': { fill: { hovered: '#b' } } },
  ],
  [
    'an undefined value keeps the base’s',
    { fill: '#a', Indicator: { radius: '1r' } },
    { fill: undefined, Indicator: undefined },
  ],
];

describe('mergeStyles', () => {
  test.each(CASES)('as Tasty’s: %s', (_name, base, override) => {
    expect(mergeStyles(base, override)).toStrictEqual(
      tastyMergeStyles(base, override),
    );
  });

  test('as Tasty’s on every component, with a change to each part', () => {
    for (const { styles } of Object.values(COMPONENTS)) {
      const override: Record<string, unknown> = {
        fill: { hovered: '#x', '@uni-forced-colors': null },
        padding: { '': '2x' },
      };
      for (const key of Object.keys(styles)) {
        if (/^[A-Z&]/.test(key)) override[key] = { radius: '0.5r' };
      }
      expect(mergeStyles(styles, override as Styles)).toStrictEqual(
        tastyMergeStyles(styles, override as Styles),
      );
    }
  });
});
