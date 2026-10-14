/**
 * Platform checks for the interactions that differ by platform. They read
 * `navigator.platform`, which tests can mock, rather than the user agent.
 */

export function isMac(view: Window): boolean {
  return /^Mac/i.test(view.navigator.platform);
}

export function isIOS(view: Window): boolean {
  const { platform, maxTouchPoints } = view.navigator;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return (
    /^(iPhone|iPad)/i.test(platform) ||
    (/^Mac/i.test(platform) && maxTouchPoints > 1)
  );
}
