/**
 * DOM-typed versions of the runtime's neutral types, for writing definitions
 * and interactions. They are assignable to the runtime's `PartProps`.
 */

import type { Cell } from '../runtime';

/** Handlers keyed by DOM event name, each typed with its event. */
export type DomHandlers = {
  readonly [K in keyof HTMLElementEventMap]?: (
    event: HTMLElementEventMap[K],
  ) => void;
};

export interface DomPartProps {
  readonly attrs: Readonly<Record<string, string | undefined>>;
  readonly on?: DomHandlers;
  readonly style?: Readonly<Record<string, string | undefined>>;
  readonly properties?: Readonly<
    Record<string, string | number | boolean | undefined>
  >;
}

/**
 * The part of a definition's `setup()` context that interactions use. Any
 * `SetupContext` satisfies it.
 */
export interface InteractionContext {
  state<T>(initial: T): Cell<T>;
  effect(effect: () => void | (() => void)): void;
  watch<T>(read: () => T, callback: (value: T, previous: T) => void): void;
  element(part: string): unknown;
  batch<T>(fn: () => T): T;
  afterFlush(fn: () => void): void;
}

/** The element registered for a part, typed for the DOM. */
export function partElement(
  ctx: Pick<InteractionContext, 'element'>,
  part: string,
): HTMLElement | null {
  return (ctx.element(part) as HTMLElement | null) ?? null;
}

/**
 * Runs `effect` with the part's element while the instance is started (and
 * `isActive()` holds, when given), and again (after the previous cleanup)
 * whenever a different element is attached. A custom element connects before
 * the parser adds its children, so its parts often arrive after `start()`.
 */
export function partEffect(
  ctx: InteractionContext,
  part: string,
  effect: (element: HTMLElement) => void | (() => void),
  isActive?: () => boolean,
): void {
  elementEffect(
    ctx,
    () => (isActive && !isActive() ? null : partElement(ctx, part)),
    effect,
  );
}

/**
 * Runs `effect` with the element `read()` returns while the instance is
 * started, and again (after the previous cleanup) whenever it changes: any
 * element, such as another component's part. It runs once the store has
 * flushed (`ctx.afterFlush`), so the element already carries the state
 * attributes of the change: an overlay shown here is `data-entering` from
 * its first style. The cleanup runs at once on `stop()`.
 */
export function elementEffect(
  ctx: InteractionContext,
  read: () => HTMLElement | null,
  effect: (element: HTMLElement) => void | (() => void),
): void {
  let current: HTMLElement | null = null;
  let cleanup: (() => void) | undefined;
  let isLive = false;
  const run = (element: HTMLElement | null) => {
    if (element === current) return;
    current = element;
    const previous = cleanup;
    cleanup = undefined;
    previous?.();
    const next = element ? effect(element) : undefined;
    if (typeof next === 'function') cleanup = next;
  };
  // Read again when it runs: the element can change twice in one flush.
  const update = () =>
    ctx.afterFlush(() => {
      if (isLive) run(read());
    });
  ctx.effect(() => {
    isLive = true;
    update();
    return () => {
      isLive = false;
      run(null);
    };
  });
  ctx.watch(read, update);
}

/**
 * Combines the handlers of several interactions on one part: for each event
 * type, every handler runs, in argument order.
 */
export function mergeHandlers(...maps: readonly DomHandlers[]): DomHandlers {
  const merged: Record<string, (event: Event) => void> = {};
  for (const map of maps) {
    for (const [type, handler] of Object.entries(map)) {
      if (!handler) continue;
      const next = handler as (event: Event) => void;
      const previous = merged[type];
      merged[type] = previous
        ? (event) => {
            previous(event);
            next(event);
          }
        : next;
    }
  }
  return merged;
}
