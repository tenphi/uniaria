import { describe, expect, it } from 'vitest';

/**
 * The adapter must import in Node without a DOM: element classes extend
 * `HTMLElement`, so they are created inside `defineElement()`, never at module
 * scope (design decision 7).
 */
const entries = {
  '@tenphi/sous-elements': () => import('./index'),
  '@tenphi/sous-elements/button': () => import('./button'),
  '@tenphi/sous-elements/toggle-button': () => import('./toggle-button'),
  '@tenphi/sous-elements/field': () => import('./field'),
  '@tenphi/sous-elements/text-field': () => import('./text-field'),
};

describe('SSR safety', () => {
  it('runs without a DOM', () => {
    expect(typeof HTMLElement).toBe('undefined');
  });

  it.each(Object.entries(entries))('imports %s', async (_name, load) => {
    await expect(load()).resolves.toBeDefined();
  });

  it('registers nothing where there are no custom elements', async () => {
    const { SousButton } = await import('./button');
    expect(SousButton).toBeUndefined();
    const { SousToggleButton } = await import('./toggle-button');
    expect(SousToggleButton).toBeUndefined();
    const { SousField } = await import('./field');
    expect(SousField).toBeUndefined();
    const { SousTextField } = await import('./text-field');
    expect(SousTextField).toBeUndefined();
  });
});
