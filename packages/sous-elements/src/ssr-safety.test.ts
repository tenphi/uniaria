import { describe, expect, it } from 'vitest';

/**
 * The adapter must import in Node without a DOM: element classes extend
 * `HTMLElement`, so they are created inside `defineElement()`, never at module
 * scope (design decision 7).
 */
describe('SSR safety', () => {
  it('imports @tenphi/sous-elements without a DOM', async () => {
    expect(typeof HTMLElement).toBe('undefined');
    await expect(import('./index')).resolves.toBeDefined();
  });
});
