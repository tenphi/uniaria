/**
 * The style objects in Tasty's runtime with `uniaria()` (spec: Outputs →
 * Tasty style objects, Configuration at run time), without the prebuilt
 * CSS: the plugin's token blocks resolve to the palette in every scheme,
 * and a component styles itself from its object.
 */

import { configure, tasty } from '@tenphi/tasty';
import { emulateMedia } from '@uniaria/testing/browser';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, test } from 'vitest';

import { checkboxStyles } from './components/checkbox';
import { DEFAULT_PALETTE } from './palette/default';
import type { Scheme } from './palette/themes';
import { uniaria } from './plugin';
import { rgba } from './testing/browser';

// Before the first style, as the plugin's docs say.
configure({ plugins: [uniaria()] });

const Checkbox = tasty({ as: 'label', styles: checkboxStyles });

const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
flushSync(() =>
  root.render(
    <>
      <Checkbox mods={{ selected: true }}>
        <span data-element="Indicator" />
      </Checkbox>
      <div id="forced-light" data-uni-scheme="light">
        <i />
      </div>
      <div id="forced-dark" data-uni-scheme="dark">
        <i />
      </div>
      <i id="page" />
    </>,
  ),
);

afterEach(() => emulateMedia({ colorScheme: null, contrast: null }));
afterAll(() => {
  root.unmount();
  container.remove();
});

/** The color a value resolves to on an element. */
function resolve(on: Element, value: string): string {
  const probe = document.createElement('i');
  probe.style.color = value;
  on.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

const TOKENS = ['#uni-surface', '#uni-text', '#uni-border', '#uni-accent-fill'];

describe.each([
  ['light', 'no-preference', 'light', 'light', 'dark'],
  ['dark', 'no-preference', 'dark', 'light', 'dark'],
  ['light', 'more', 'lightContrast', 'lightContrast', 'darkContrast'],
  ['dark', 'more', 'darkContrast', 'lightContrast', 'darkContrast'],
] as const)(
  'with the OS %s and contrast %s',
  (colorScheme, contrast, page, forcedLight, forcedDark) => {
    test.each([
      ['the page', '#page', page],
      ['forced light', '#forced-light', forcedLight],
      ['forced dark', '#forced-dark', forcedDark],
    ] as const)('%s takes the %s scheme', async (_name, selector, scheme) => {
      await emulateMedia({ colorScheme, contrast });
      const element = container.querySelector(selector);
      if (!element) throw new Error(`No ${selector}.`);
      for (const token of TOKENS) {
        expect(
          rgba(resolve(element, `var(--${token.slice(1)}-color)`)),
        ).toEqual(
          rgba(
            resolve(element, DEFAULT_PALETTE[scheme as Scheme][token] ?? ''),
          ),
        );
      }
      expect(getComputedStyle(element).colorScheme).toBe(
        scheme.startsWith('dark') ? 'dark' : 'light',
      );
    });
  },
);

test('a system color token holds the system color', () => {
  expect(
    rgba(resolve(document.body, 'var(--uni-system-highlight-color)')),
  ).toEqual(rgba(resolve(document.body, 'Highlight')));
});

test('a component styles itself from its object, its states included', () => {
  const indicator = container.querySelector('[data-element="Indicator"]');
  if (!indicator) throw new Error('No indicator.');
  // The schemes above changed its colors, through its transitions.
  for (const animation of document.getAnimations()) animation.finish();
  expect(rgba(getComputedStyle(indicator).backgroundColor)).toEqual(
    rgba(
      resolve(document.body, DEFAULT_PALETTE.light['#uni-accent-fill'] ?? ''),
    ),
  );
});
