/**
 * Owners in Vue (decision 11, Vue adapter spec: Owners and links): every
 * `useBehavior` provides its instance to the component's descendants, slot
 * content included, through `provide()`, which holds only the stable
 * instance and renders nothing. A component finds its owner during setup,
 * so the first render and the server HTML have the owner's state. Scopes
 * nest: each component takes the nearest owner of the definition it names.
 */

import type { AnyDefinition, Instance } from '@uniaria/core';
import type { InjectionKey } from 'vue';
import { getCurrentInstance, inject, provide } from 'vue';

export interface Scope {
  readonly instance: Instance;
  readonly parent: Scope | null;
}

/** Shared by duplicate installs, like the core's global singletons. */
export const OWNER_SCOPE: InjectionKey<Scope | null> = Symbol.for(
  '@uniaria/vue owner',
) as InjectionKey<Scope | null>;

/**
 * The scope each component provides last. `inject()` reads the parent's
 * provides, so a second `useBehavior` in one component chains onto the
 * first through this, not through `inject()`.
 */
const provided = new WeakMap<object, Scope>();

/** The scope the current component's parent provides, if any. */
export function injectScope(): Scope | null {
  return inject(OWNER_SCOPE, null);
}

/** Provides `instance` to the current component's descendants. */
export function provideScope(instance: Instance, parent: Scope | null): void {
  const component = getCurrentInstance();
  const scope: Scope = {
    instance,
    parent: (component && provided.get(component)) ?? parent,
  };
  if (component) provided.set(component, scope);
  provide(OWNER_SCOPE, scope);
}

/** The nearest owner of `definition` in the scope, if any. */
export function findOwner(
  scope: Scope | null,
  definition: AnyDefinition,
): Instance | undefined {
  for (let current = scope; current; current = current.parent) {
    if (current.instance.definition === definition) return current.instance;
  }
  return undefined;
}
