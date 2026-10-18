import { describe, expect, it } from 'vitest';

/**
 * Every public entry must import in Node without a DOM: nothing may touch
 * `document` or `window` at module scope (design decision 7). Add each new
 * entry from tsdown.config.ts here.
 */
const entries = {
  '@uniaria/core': () => import('./index'),
  '@uniaria/core/dom': () => import('./dom/index'),
  '@uniaria/core/collections': () => import('./collections/index'),
  '@uniaria/core/button': () => import('./components/button/index'),
  '@uniaria/core/toggle-button': () =>
    import('./components/toggle-button/index'),
  '@uniaria/core/field': () => import('./components/field/index'),
  '@uniaria/core/text-field': () => import('./components/text-field/index'),
  '@uniaria/core/checkbox': () => import('./components/checkbox/index'),
  '@uniaria/core/checkbox-group': () =>
    import('./components/checkbox-group/index'),
  '@uniaria/core/switch': () => import('./components/switch/index'),
  '@uniaria/core/radio': () => import('./components/radio/index'),
  '@uniaria/core/radio-group': () => import('./components/radio-group/index'),
  '@uniaria/core/dialog': () => import('./components/dialog/index'),
  '@uniaria/core/popover': () => import('./components/popover/index'),
  '@uniaria/core/tooltip': () => import('./components/tooltip/index'),
  '@uniaria/core/number-field': () => import('./components/number-field/index'),
  '@uniaria/core/listbox': () => import('./components/listbox/index'),
  '@uniaria/core/select': () => import('./components/select/index'),
};

describe('SSR safety', () => {
  it('runs without a DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it.each(Object.entries(entries))('imports %s', async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });
});
