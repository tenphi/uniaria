/**
 * Owners in React (decision 11): `OwnerProvider` makes an instance the owner
 * of the UniAria components rendered inside it, through a React context that
 * holds only the stable instance, so it re-renders nothing. A component
 * finds its owner during render, which gives the first render and the server
 * HTML the owner's state. Contexts nest: each component takes the nearest
 * owner of the definition it names, and of each inherited link key it takes.
 */

import type { AnyDefinition, Instance, LinkKey } from '@uniaria/core';
import { answers } from '@uniaria/core';
import type { ReactNode } from 'react';
import { createContext, createElement, useContext, useMemo } from 'react';

interface Scope {
  readonly instance: Instance;
  readonly parent: Scope | null;
}

export const OwnerContext = createContext<Scope | null>(null);

export interface OwnerProviderProps<D extends AnyDefinition = AnyDefinition> {
  /** The owner: an instance, or the handle `useBehavior` returned. */
  readonly owner: Instance<D> | { readonly instance: Instance<D> };
  readonly children?: ReactNode;
}

// Generic, since an `Instance<D>` isn't an `Instance`: its typed callback
// props don't take `unknown`.
export function OwnerProvider<D extends AnyDefinition>({
  owner,
  children,
}: OwnerProviderProps<D>) {
  const parent = useContext(OwnerContext);
  const instance = ('instance' in owner ? owner.instance : owner) as Instance;
  const scope = useMemo(() => ({ instance, parent }), [instance, parent]);
  return createElement(OwnerContext.Provider, { value: scope }, children);
}

/**
 * The nearest owner of `wanted` in the context, if any: an instance of the
 * owner's definition, or one answering a link key, as a form answers its
 * fields' inherited link (Form spec, Runtime changes 1).
 */
export function findOwner(
  scope: Scope | null,
  wanted: AnyDefinition | LinkKey,
): Instance | undefined {
  for (let current = scope; current; current = current.parent) {
    if (answers(current.instance.definition, wanted)) return current.instance;
  }
  return undefined;
}
