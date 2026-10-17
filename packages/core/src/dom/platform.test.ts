import { describe, expect, it } from 'vitest';

import { isAndroid, isIOS, isIPhone } from './platform';

function view(navigator: Partial<Navigator> & { userAgentData?: unknown }) {
  return {
    navigator: { platform: '', userAgent: '', maxTouchPoints: 0, ...navigator },
  } as unknown as Window;
}

describe('platform', () => {
  it('tells an iPhone from an iPad', () => {
    expect(isIPhone(view({ platform: 'iPhone' }))).toBe(true);
    expect(isIPhone(view({ platform: 'iPad' }))).toBe(false);
    expect(isIOS(view({ platform: 'iPad' }))).toBe(true);
    expect(isIOS(view({ platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
  });

  it('finds Android in client hints or the user agent', () => {
    const chrome = view({
      platform: 'Linux armv81',
      userAgentData: { platform: 'Android' },
    });
    const firefox = view({
      platform: 'Linux aarch64',
      userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Firefox/140.0',
    });
    expect(isAndroid(chrome)).toBe(true);
    expect(isAndroid(firefox)).toBe(true);
    expect(isAndroid(view({ platform: 'Linux x86_64' }))).toBe(false);
  });
});
