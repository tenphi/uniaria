/**
 * The palette as the page resolves it (spec: Testing → Contrast): every
 * token in every scheme selector, and every role's contrast floor in the
 * Tokens table, read from rendered colors.
 */

import { emulateMedia } from '@uniaria/testing/browser';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { colorToken, createPalette, ROLES, THEMES } from './palette';
import type { Role, Scheme, Theme } from './palette';
import {
  contrast,
  cssMatches,
  loadStyles,
  resolveToken,
  rgba,
} from './testing/browser';
import { tokenProperty } from './tokens';

const palette = createPalette();

let unload: () => void;
beforeAll(async () => {
  unload = await loadStyles({ components: [] });
});
afterAll(async () => {
  unload();
  await emulateMedia({ contrast: null, colorScheme: null });
});

/** A role's floors: [role, the color behind it, the ratio]. */
function floors(theme: Theme): [Role, readonly [Theme, Role], number][] {
  const page = ['default', 'surface'] as const;
  const text = theme === 'disabled' ? 3 : 4.5;
  const list: [Role, readonly [Theme, Role], number][] = [
    ['text', [theme, 'surface'], text],
    ['text', page, text],
    ['text-soft', [theme, 'surface'], text],
    ['text-soft', page, text],
    ['fill-text', [theme, 'fill'], text],
    ['fill-text', [theme, 'fill-hover'], text],
    ['fill-text', [theme, 'fill-pressed'], text],
  ];
  // WCAG exempts disabled controls: their text, and nothing more.
  if (theme === 'disabled') return list;
  // A fill needs none against the page: its text or mark identifies it.
  return [
    ...list,
    ['border', page, 3],
    ['outline', [theme, 'surface'], 3],
    ['outline', page, 3],
  ];
}

function scoped(scheme: 'light' | 'dark'): HTMLElement {
  const scope = document.createElement('div');
  scope.dataset.uniScheme = scheme;
  document.body.append(scope);
  return scope;
}

const color = (scope: Element, theme: Theme, role: string) =>
  resolveToken(scope, tokenProperty(colorToken(theme, role)));

describe.each([
  ['no-preference', 'light', 'light'],
  ['no-preference', 'dark', 'dark'],
  ['more', 'light', 'lightContrast'],
  ['more', 'dark', 'darkContrast'],
] as const)(
  'prefers-contrast: %s, data-uni-scheme="%s"',
  (preference, forced, scheme: Scheme) => {
    let scope: HTMLElement;
    let isEmulated = true;
    beforeAll(async () => {
      await emulateMedia({ contrast: preference });
      isEmulated = cssMatches(`(prefers-contrast: ${preference})`);
      scope = scoped(forced);
    });
    afterAll(() => scope.remove());

    test('every token resolves to its color in the palette', (context) => {
      if (!isEmulated) context.skip();
      for (const [token, value] of Object.entries(palette[scheme])) {
        expect(rgba(resolveToken(scope, tokenProperty(token))), token).toEqual(
          rgba(value),
        );
      }
      expect(getComputedStyle(scope).colorScheme).toBe(forced);
    });

    test.for(THEMES)(
      'the %s theme meets its contrast floors',
      (theme, context) => {
        if (!isEmulated) context.skip();
        for (const [role, [behindTheme, behind], ratio] of floors(theme)) {
          const value = contrast(
            color(scope, theme, role),
            color(scope, behindTheme, behind),
          );
          expect(
            value,
            `${colorToken(theme, role)} on ${colorToken(behindTheme, behind)}`,
          ).toBeGreaterThanOrEqual(ratio - 0.02);
        }
      },
    );

    // The disabled theme has no hover or press: each is its rest color.
    test.for(THEMES.filter((theme) => theme !== 'disabled'))(
      'the %s theme steps away from its surface and fill for hover and press',
      (theme, context) => {
        if (!isEmulated) context.skip();
        for (const rest of ['surface', 'fill']) {
          const ramp = [rest, `${rest}-hover`, `${rest}-pressed`].map((role) =>
            rgba(color(scope, theme, role)).join(),
          );
          expect(new Set(ramp).size, colorToken(theme, rest)).toBe(3);
        }
      },
    );

    test('a tooltip, the default fill, stands off the page', (context) => {
      if (!isEmulated) context.skip();
      expect(
        contrast(
          color(scope, 'default', 'fill'),
          color(scope, 'default', 'surface'),
        ),
      ).toBeGreaterThanOrEqual(1.3);
    });

    test('the backdrop dims the page, unless the page is black', (context) => {
      if (!isEmulated) context.skip();
      const page = rgba(color(scope, 'default', 'surface'));
      const [red, green, blue, alpha] = rgba(
        color(scope, 'default', 'backdrop'),
      );
      const over = [red, green, blue].map(
        (channel, index) => alpha * channel + (1 - alpha) * (page[index] ?? 0),
      );
      const ratio = contrast(
        `rgb(${over.join(' ')})`,
        `rgb(${page.join(' ')})`,
      );
      if (page.slice(0, 3).every((channel) => channel === 0)) {
        expect(ratio).toBeCloseTo(1, 1);
      } else {
        // Darker in every channel, never lighter, as a fixed color was.
        over.forEach((channel, index) =>
          expect(channel).toBeLessThanOrEqual(page[index] ?? 0),
        );
        expect(ratio).toBeGreaterThanOrEqual(1.1);
      }
    });
  },
);

describe('without data-uni-scheme', () => {
  afterAll(() => emulateMedia({ colorScheme: null }));

  test.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ] as const)('the page follows a %s OS', async (os, scheme) => {
    await emulateMedia({ colorScheme: os, contrast: 'no-preference' });
    expect(rgba(color(document.body, 'default', 'surface'))).toEqual(
      rgba(palette[scheme]['#uni-surface'] ?? ''),
    );
    expect(getComputedStyle(document.documentElement).colorScheme).toBe(os);
  });

  test('an element forces its own scheme in a page that follows the OS', async () => {
    await emulateMedia({ colorScheme: 'dark', contrast: 'no-preference' });
    const scope = scoped('light');
    expect(rgba(color(scope, 'accent', 'fill'))).toEqual(
      rgba(palette.light['#uni-accent-fill'] ?? ''),
    );
    scope.remove();
  });

  test('every role is in every theme', () => {
    for (const theme of THEMES) {
      for (const role of ROLES) {
        expect(palette.light[colorToken(theme, role)]).toBeDefined();
      }
    }
  });
});
