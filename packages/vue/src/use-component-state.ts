/**
 * `useComponentState` (Vue adapter spec): one selected value of an
 * instance's public state as a read-only ref. The ref reads the state when
 * it is read, so a render after a prop change already shows the new value,
 * and it triggers only when the store's notification changes the value a
 * render last read.
 */

import type { AnyDefinition, Instance, StateOf } from '@uniaria/core';
import { warn } from '@uniaria/core/dom';
import type { Ref } from 'vue';
import { customRef, getCurrentScope, onScopeDispose } from 'vue';

import type { ComponentHandle } from './use-component';

/**
 * Reads one value of an instance's public state as a ref that triggers only
 * when the value changes (`Object.is`, or `isEqual`). Takes the instance or
 * the handle `useComponent` returned.
 */
export function useComponentState<D extends AnyDefinition, T>(
  source: Instance<D> | ComponentHandle<D>,
  selector: (state: StateOf<D>) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): Readonly<Ref<T>> {
  const instance = 'instance' in source ? source.instance : source;
  let cache: { readonly state: StateOf<D>; readonly value: T } | null = null;

  // The selection stays the same object while the state object is, or while
  // the new selection is equal to the last one.
  const select = (): T => {
    const state = instance.getState();
    if (cache?.state === state) return cache.value;
    const value = selector(state);
    const stable = cache && isEqual(cache.value, value) ? cache.value : value;
    cache = { state, value: stable };
    return stable;
  };

  return customRef<T>((track, trigger) => {
    // The value a reader last got; a notification that brings the same one
    // (the sync after a prop change the render already showed) stays quiet.
    let read: { readonly value: T } | null = null;
    // Never on the server, where nothing would unsubscribe.
    if (typeof document !== 'undefined') {
      const unsubscribe = instance.subscribe(() => {
        if (!read || !Object.is(read.value, select())) trigger();
      });
      if (getCurrentScope()) onScopeDispose(unsubscribe);
    }
    return {
      get() {
        track();
        const value = select();
        read = { value };
        return value;
      },
      set() {
        warn(
          `${instance.definition.name}: useComponentState returns a read-only ref.`,
        );
      },
    };
  });
}
