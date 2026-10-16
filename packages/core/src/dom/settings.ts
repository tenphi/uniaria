/**
 * Page-wide settings (owner, 2026-10-16), shared by every copy of UniAria on
 * the page through `Symbol.for('@uniaria/settings/v1')` on `globalThis`.
 * Components read them when they place a part, so a change applies from the
 * next time a popover or tooltip opens.
 */

/**
 * How floating parts, such as popovers and tooltips, are placed:
 *
 * - `'script'` (the default): UniAria places them in every browser from their
 *   `positionArea` and `positionTryFallbacks` props, by CSS Anchor
 *   Positioning's rules, with the consumer's margins as gaps.
 * - `'css'`: the consumer's CSS anchor positioning places them. UniAria only
 *   links each part to its anchor (`position-anchor`) and reads back the side
 *   it landed on; the props are ignored, and a browser without anchor
 *   positioning is the consumer's to handle.
 */
export type Positioning = 'css' | 'script';

export interface Settings {
  readonly positioning: Positioning;
}

const SETTINGS = Symbol.for('@uniaria/settings/v1');

const DEFAULTS: Settings = { positioning: 'script' };

/** The settings now. */
export function getSettings(): Settings {
  const stored = Reflect.get(globalThis, SETTINGS) as
    Partial<Settings> | undefined;
  return { ...DEFAULTS, ...stored };
}

/** Changes the settings it is given; the rest stay. */
export function configure(settings: Partial<Settings>): void {
  Reflect.set(globalThis, SETTINGS, { ...getSettings(), ...settings });
}
