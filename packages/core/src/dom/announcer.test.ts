import { describe, expect, it } from 'vitest';

import { announce, clearAnnouncer, destroyAnnouncer } from './announcer';

describe('announcer without a DOM', () => {
  it('does nothing on the server', () => {
    expect(typeof document).toBe('undefined');
    expect(() => {
      announce('Saved');
      clearAnnouncer();
      destroyAnnouncer();
    }).not.toThrow();
  });
});
