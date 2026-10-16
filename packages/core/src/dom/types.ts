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
  readonly style?: Readonly<Record<`--${string}`, string | undefined>>;
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
  const read = () => (isActive && !isActive() ? null : partElement(ctx, part));
  let cleanup: (() => void) | undefined;
  const run = (element: HTMLElement | null) => {
    const previous = cleanup;
    cleanup = undefined;
    previous?.();
    const next = element ? effect(element) : undefined;
    if (typeof next === 'function') cleanup = next;
  };
  ctx.effect(() => {
    run(read());
    return () => run(null);
  });
  ctx.watch(read, run);
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
