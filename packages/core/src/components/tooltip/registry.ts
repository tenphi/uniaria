/**
 * The tooltips of a window (`./spec.md`, Warm-up), shared by every copy of
 * UniAria on the page through `Symbol.for('@uniaria/tooltips/v1')`, as React
 * Stately's module state is for Cube UI Kit: one open at a time, and a warm
 * page that opens the next one without its delay.
 */

/** An open tooltip, as the registry closes it when another opens. */
export interface ShownTooltip {
  /** Closes it at once, without its closing phase. */
  close(): void;
}

/** A tooltip waiting for its delay. */
export interface WaitingTooltip {
  cancel(): void;
}

/** The window property; part of the contract between copies of UniAria. */
interface Registry {
  open: ShownTooltip | null;
  /** `Date.now()` until which the page stays warm with none open. */
  warmUntil: number;
  waiting: WaitingTooltip | null;
}

const KEY = Symbol.for('@uniaria/tooltips/v1');

/** The least time the page stays warm after a tooltip starts closing. */
const COOLDOWN = 500;

function registryOf(view: Window): Registry {
  let registry = Reflect.get(view, KEY) as Registry | undefined;
  if (!registry) {
    registry = { open: null, warmUntil: 0, waiting: null };
    Reflect.set(view, KEY, registry);
  }
  return registry;
}

/** A tooltip is open, or one started closing less than its cooldown ago. */
export function isWarm(view: Window): boolean {
  const registry = registryOf(view);
  return registry.open !== null || Date.now() < registry.warmUntil;
}

/** Marks `tooltip` open, closing the one that was. */
export function showTooltip(view: Window, tooltip: ShownTooltip): void {
  const registry = registryOf(view);
  const previous = registry.open;
  registry.open = tooltip;
  if (previous && previous !== tooltip) previous.close();
}

/**
 * Marks `tooltip` closing; the page stays warm for `max(500, closeDelay)`
 * milliseconds (React Stately's cooldown). A tooltip another one replaced
 * no longer counts.
 */
export function hideTooltip(
  view: Window,
  tooltip: ShownTooltip,
  closeDelay: number,
): void {
  const registry = registryOf(view);
  if (registry.open !== tooltip) return;
  registry.open = null;
  registry.warmUntil = Date.now() + Math.max(COOLDOWN, closeDelay);
}

/** Starts a wait, cancelling another tooltip's: the pointer moved on. */
export function waitForTooltip(view: Window, tooltip: WaitingTooltip): void {
  const registry = registryOf(view);
  const previous = registry.waiting;
  registry.waiting = tooltip;
  if (previous && previous !== tooltip) previous.cancel();
}

/** Ends `tooltip`'s wait, if it is still the one waiting. */
export function stopWaiting(view: Window, tooltip: WaitingTooltip): void {
  const registry = registryOf(view);
  if (registry.waiting === tooltip) registry.waiting = null;
}
