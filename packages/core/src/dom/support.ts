/**
 * Detection for the platform features UniAria uses only where they exist
 * (AGENTS.md: newer than Baseline widely available means detection and a
 * fallback), and the development switch that forces a fallback in browsers
 * that have the feature, so tests can run both paths (Popover spec, Resolved
 * questions 2): a window property under
 * `Symbol.for('@uniaria/fallbacks/v1')`, `{ popover: false }` or
 * `{ anchorPositioning: false }`. Components read it when they start.
 * Positioning doesn't detect: the page picks its mode (`./settings.ts`), and
 * CSS mode only warns without anchor positioning.
 */

const FALLBACKS = Symbol.for('@uniaria/fallbacks/v1');

interface Fallbacks {
  readonly popover?: boolean;
  readonly anchorPositioning?: boolean;
}

function forced(view: Window): Fallbacks {
  return (Reflect.get(view, FALLBACKS) as Fallbacks | undefined) ?? {};
}

/** The Popover API (Baseline 2025-01). */
export function supportsPopover(view: Window & typeof globalThis): boolean {
  if (forced(view).popover === false) return false;
  return typeof view.HTMLElement.prototype.showPopover === 'function';
}

/**
 * CSS anchor positioning on a popover (Baseline 2026-01). No engine has it
 * without the Popover API, so a forced popover fallback turns it off too.
 */
export function supportsAnchorPositioning(
  view: Window & typeof globalThis,
): boolean {
  if (!supportsPopover(view) || forced(view).anchorPositioning === false) {
    return false;
  }
  const css = view.CSS as typeof CSS | undefined;
  return (
    typeof css?.supports === 'function' &&
    css.supports('anchor-name: --uni') &&
    css.supports('position-area: bottom span-right') &&
    css.supports('position-try-fallbacks: flip-block')
  );
}
