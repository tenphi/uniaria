/**
 * Colors of your own in Tasty's runtime (spec: Tokens → Glaze is opt-out),
 * as the Theming guide shows them: `uniaria({ palette: false })` and the
 * roles set as tokens in the project's global styles, pointing at its own
 * tokens, which change with its scheme.
 */

import { configure, tasty } from '@tenphi/tasty';
import { emulateMedia } from '@uniaria/testing/browser';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, expect, test } from 'vitest';

import { checkboxStyles } from './components/checkbox';
import { uniaria } from './plugin';
import { rgba } from './testing/browser';

const BRAND = 'rgb(0 128 96)';
const DARK_BRAND = 'rgb(64 200 160)';

// Before the first style, as the plugin's docs say.
configure({
  plugins: [uniaria({ palette: false })],
  // The project's own tokens, on `:root`, with its own dark scheme.
  tokens: {
    '#brand-600': {
      '': BRAND,
      '@media(prefers-color-scheme: dark)': DARK_BRAND,
    },
  },
  globalStyles: {
    body: { '#uni-accent-fill': '#brand-600' },
  },
});

const Checkbox = tasty({ as: 'label', styles: checkboxStyles });

const container = document.createElement('div');
document.body.append(container);
const root = createRoot(container);
flushSync(() =>
  root.render(
    <Checkbox mods={{ selected: true }}>
      <span data-element="Indicator" />
    </Checkbox>,
  ),
);

afterEach(() => emulateMedia({ colorScheme: null }));
afterAll(() => {
  root.unmount();
  container.remove();
});

/** The selected indicator's fill, its transition finished. */
function indicatorFill(): [number, number, number, number] {
  const indicator = container.querySelector('[data-element="Indicator"]');
  if (!indicator) throw new Error('No indicator.');
  for (const animation of document.getAnimations()) animation.finish();
  return rgba(getComputedStyle(indicator).backgroundColor);
}

test('the plugin writes no palette', () => {
  expect(
    getComputedStyle(document.body).getPropertyValue('--uni-surface-color'),
  ).toBe('');
});

test('a role set in body styles takes the project’s token', async () => {
  await emulateMedia({ colorScheme: 'light' });
  expect(indicatorFill()).toEqual(rgba(BRAND));
});

test('and follows it into the project’s dark scheme', async () => {
  await emulateMedia({ colorScheme: 'dark' });
  expect(indicatorFill()).toEqual(rgba(DARK_BRAND));
});
