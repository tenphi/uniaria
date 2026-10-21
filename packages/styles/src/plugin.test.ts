import {
  configure,
  extractStylesForSelector,
  resetConfig,
} from '@tenphi/tasty/zero';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createPalette } from './palette/create';
import { BASE_TOKENS } from './palette/css';
import { uniaria } from './plugin';
import { STATES } from './tokens';

const SELECTORS = [
  ':root',
  ':root:not([data-uni-scheme="light"])',
  '[data-uni-scheme="light"]',
  '[data-uni-scheme="dark"]',
];

afterEach(() => resetConfig());

describe('uniaria()', () => {
  test('brings the state aliases and no units', () => {
    const plugin = uniaria();
    expect(plugin.name).toBe('uniaria');
    expect(plugin.states).toEqual(STATES);
    expect(plugin.units).toBeUndefined();
  });

  test('brings the token blocks as global styles, one per scheme selector', () => {
    const palette = createPalette();
    const styles = uniaria().globalStyles ?? {};
    expect(Object.keys(styles)).toEqual(SELECTORS);
    expect(styles[':root']).toMatchObject({
      '$uni-gap': BASE_TOKENS['$uni-gap'],
      colorScheme: 'light',
      '#uni-surface': {
        '': palette.light['#uni-surface'],
        '@media(prefers-contrast: more)': palette.lightContrast['#uni-surface'],
      },
    });
    expect(styles['[data-uni-scheme="dark"]']).toMatchObject({
      colorScheme: 'dark',
      '#uni-surface': {
        '': palette.dark['#uni-surface'],
        '@media(prefers-contrast: more)': palette.darkContrast['#uni-surface'],
      },
    });
  });

  test('renders every block with Tasty, every token included', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    configure({});
    const styles = uniaria().globalStyles ?? {};
    const blocks = SELECTORS.map(
      (selector) =>
        extractStylesForSelector(selector, styles[selector] ?? {}).css,
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(blocks[0]).toContain('--uni-gap: 0.5rem;');
    // Tasty writes a token once where two schemes give it one value.
    for (const token of Object.keys(createPalette().light)) {
      for (const css of blocks) {
        expect(css).toContain(`--${token.slice(1)}-color:`);
      }
    }
  });

  test('palette: false leaves the colors out', () => {
    const styles = uniaria({ palette: false }).globalStyles ?? {};
    expect(Object.keys(styles)).toEqual([':root']);
    expect(Object.keys(styles[':root'] ?? {})).toEqual(
      Object.keys(BASE_TOKENS),
    );
  });

  test('takes a token for every scheme, or one per scheme', () => {
    const styles =
      uniaria({
        tokens: {
          '$uni-radius': '4px',
          '#uni-accent-outline': '#0a7',
          '#uni-surface': { dark: '#111' },
        },
      }).globalStyles ?? {};
    expect(styles[':root']).toMatchObject({
      '$uni-radius': '4px',
      '#uni-accent-outline': {
        '': '#0a7',
        '@media(prefers-contrast: more)': '#0a7',
      },
    });
    expect(styles['[data-uni-scheme="dark"]']).toMatchObject({
      '#uni-surface': { '': '#111' },
    });
  });
});
