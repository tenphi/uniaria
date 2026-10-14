import { describe, expect, it } from 'vitest';

/** The adapter must import in Node without a DOM (design decision 7). */
describe('SSR safety', () => {
  it('imports @tenphi/sous-react without a DOM', async () => {
    expect(typeof document).toBe('undefined');
    await expect(import('./index')).resolves.toBeDefined();
  });
});
