import { describe, expect, it } from 'vitest';

/**
 * Every public entry must import in Node without a DOM: nothing may touch
 * `document` or `window` at module scope (design decision 7). Add each new
 * entry from tsdown.config.ts here.
 */
const entries = {
  '@tenphi/sous': () => import('./index'),
  '@tenphi/sous/dom': () => import('./dom/index'),
  '@tenphi/sous/collections': () => import('./collections/index'),
  '@tenphi/sous/button': () => import('./components/button/index'),
  '@tenphi/sous/toggle-button': () =>
    import('./components/toggle-button/index'),
  '@tenphi/sous/field': () => import('./components/field/index'),
};

describe('SSR safety', () => {
  it('runs without a DOM', () => {
    expect(typeof document).toBe('undefined');
  });

  it.each(Object.entries(entries))('imports %s', async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });
});
