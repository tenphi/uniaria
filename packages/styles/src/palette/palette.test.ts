import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  colorToken,
  createPalette,
  DEFAULT_ONLY,
  ROLES,
  SCHEMES,
  THEMES,
} from '.';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createPalette', () => {
  test('gives every theme every role, in every scheme', () => {
    const palette = createPalette();
    const expected = [
      ...THEMES.flatMap((theme) =>
        ROLES.map((role) => colorToken(theme, role)),
      ),
      ...DEFAULT_ONLY.map((name) => colorToken('default', name)),
    ].sort();
    for (const scheme of SCHEMES) {
      expect(Object.keys(palette[scheme]).sort(), scheme).toEqual(expected);
    }
  });

  test('meets every contrast floor it sets, so Glaze warns of none', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createPalette();
    expect(warn).not.toHaveBeenCalled();
  });

  test('takes a seed for one theme and keeps the others', () => {
    const base = createPalette();
    const purple = createPalette({ accent: { hue: 300 } });
    for (const scheme of SCHEMES) {
      expect(purple[scheme]['#uni-accent-fill']).not.toBe(
        base[scheme]['#uni-accent-fill'],
      );
      expect(purple[scheme]['#uni-danger-fill']).toBe(
        base[scheme]['#uni-danger-fill'],
      );
      expect(purple[scheme]['#uni-surface']).toBe(base[scheme]['#uni-surface']);
    }
  });

  test('changes the light scheme from the dark, and each from its high contrast', () => {
    const palette = createPalette();
    expect(palette.dark['#uni-surface']).not.toBe(
      palette.light['#uni-surface'],
    );
    expect(palette.lightContrast['#uni-text']).not.toBe(
      palette.light['#uni-text'],
    );
    expect(palette.darkContrast['#uni-text']).not.toBe(
      palette.dark['#uni-text'],
    );
  });
});
