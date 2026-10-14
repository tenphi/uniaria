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
