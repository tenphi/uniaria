/**
 * The palette as the page resolves it (spec: Testing → Contrast): every
 * token in every scheme selector, and every role's contrast floor in the
 * Tokens table, read from rendered colors.
 */

import { emulateMedia } from '@uniaria/testing/browser';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { colorToken, createPalette, ROLES, THEMES } from './palette';
import type { Role, Scheme, Theme } from './palette';
import { contrast, loadStyles, resolveToken, rgba } from './testing/browser';
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
  return [
    ...list,
    ['border', page, 3],
    ['fill', page, 3],
    ['fill-hover', page, 3],
    ['fill-pressed', page, 3],
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
      isEmulated = matchMedia(`(prefers-contrast: ${preference})`).matches;
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
