/**
 * Media emulation for browser tests, through the `uniEmulateMedia` command
 * in `../commands.ts`: forced colors (Chromium only), `prefers-contrast`,
 * reduced motion and the color scheme.
 */

import { commands } from 'vitest/browser';

import type { MediaFeatures } from './commands';

export type { MediaFeatures } from './commands';

declare module 'vitest/browser' {
  interface BrowserCommands {
    uniEmulateMedia(features: MediaFeatures): Promise<void>;
  }
}

/**
 * Emulates media features for the whole page until set again; `null` ends
 * a feature's emulation. Reset what you set after each test, since the
 * page outlives it.
 */
export function emulateMedia(features: MediaFeatures): Promise<void> {
  return commands.uniEmulateMedia(features);
}
