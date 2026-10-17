/**
 * Platform checks for the interactions that differ by platform. They read
 * `navigator.platform`, which tests can mock, rather than the user agent,
 * except for Android, whose platform is just "Linux".
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

export function isIPhone(view: Window): boolean {
  return /^iPhone/i.test(view.navigator.platform);
}

export function isAndroid(view: Window): boolean {
  const navigator = view.navigator as Navigator & {
    userAgentData?: { platform: string };
  };
  // Chromium reports the platform in client hints; Firefox only in the user
  // agent.
  return (
    navigator.userAgentData?.platform === 'Android' ||
    /Android/i.test(navigator.userAgent)
  );
}
