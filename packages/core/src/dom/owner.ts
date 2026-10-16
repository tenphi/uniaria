/**
 * Finding an owner through the DOM (decision 11): the steps both adapters
 * share after the explicit `owner` prop and React's context.
 *
 * - **Nearest ancestor.** A child dispatches a bubbling, composed request
 *   event from its element, in the shape of the Context Community Protocol
 *   (`references/community-protocols/proposals/context.md`). The nearest
 *   element providing an owner of the requested definition answers and stops
 *   the event.
 * - **By id.** An attribute such as `<uni-checkbox group="plan">` names the
 *   owner's element, looked up in the child's root node.
 * - **Late owners.** A request nobody answered waits; an owner that starts
 *   providing later answers the waiting requests it matches, so upgrade and
 *   mount order don't matter.
 * - **Leaving.** An owner that stops providing releases its children, which
 *   ask again: another owner may answer.
 */

import type { AnyDefinition, Instance } from '../runtime';

const REQUEST = 'uni-owner-request';

/** An owner providing on an element. */
interface Provider {
  readonly instance: Instance;
  /** Remembers a child's release; returns the function that forgets it. */
  track(release: () => void): () => void;
}

interface RequestDetail {
  readonly definition: AnyDefinition;
  answer(provider: Provider): void;
}

interface Waiting {
  readonly definition: AnyDefinition;
  /** Whether an owner providing on `element` answers this request. */
  matches(element: Element): boolean;
  ask(): void;
}

/** Requests nobody has answered yet. */
const waiting = new Set<Waiting>();

/** The owners provided on each element, for lookups by id. */
const providers = new WeakMap<Element, Provider[]>();

/**
 * Answers owner requests for `instance` that reach `element`: those from
 * inside it, and those naming it by id. The returned cleanup releases every
 * child it answered.
 */
export function provideOwner(instance: Instance, element: Element): () => void {
  const releases = new Set<() => void>();
  const provider: Provider = {
    instance,
    track(release) {
      releases.add(release);
      return () => releases.delete(release);
    },
  };
  const onRequest = (event: Event) => {
    const detail = (event as CustomEvent<RequestDetail | undefined>).detail;
    if (detail?.definition !== instance.definition) return;
    event.stopImmediatePropagation();
    detail.answer(provider);
  };
  element.addEventListener(REQUEST, onRequest);
  const list = providers.get(element) ?? [];
  list.push(provider);
  providers.set(element, list);
  for (const request of [...waiting]) {
    if (
      request.definition === instance.definition &&
      request.matches(element)
    ) {
      request.ask();
    }
  }
  return () => {
    element.removeEventListener(REQUEST, onRequest);
    list.splice(list.indexOf(provider), 1);
    const released = [...releases];
    releases.clear();
    for (const release of released) release();
  };
}

/**
 * Keeps `onChange` told of the owner of `definition` for `element`: the one
 * whose element has the id `ownerId` when given, else the nearest providing
 * ancestor. `undefined` while there is none. Returns the cleanup.
 */
export function requestOwner(
  element: Element,
  definition: AnyDefinition,
  onChange: (owner: Instance | undefined) => void,
  ownerId?: string,
): () => void {
  let isDone = false;
  let forget: (() => void) | undefined;

  const accept = (provider: Provider) => {
    waiting.delete(request);
    forget = provider.track(() => {
      forget = undefined;
      onChange(undefined);
      ask();
    });
    onChange(provider.instance);
  };

  const byId = (): Provider | undefined => {
    const root = element.getRootNode() as Partial<DocumentOrShadowRoot> & Node;
    const target =
      'getElementById' in root
        ? (root as Document).getElementById(ownerId!)
        : null;
    return target
      ? providers
          .get(target)
          ?.find((provider) => provider.instance.definition === definition)
      : undefined;
  };

  const ask = () => {
    if (isDone) return;
    if (ownerId !== undefined) {
      const provider = byId();
      if (provider) accept(provider);
      else waiting.add(request);
      return;
    }
    let isAnswered = false;
    const detail: RequestDetail = {
      definition,
      answer(provider) {
        isAnswered = true;
        accept(provider);
      },
    };
    element.dispatchEvent(
      new CustomEvent(REQUEST, { bubbles: true, composed: true, detail }),
    );
    if (!isAnswered) waiting.add(request);
  };

  const request: Waiting = {
    definition,
    matches: (owner) =>
      ownerId === undefined
        ? owner.contains(element)
        : owner.id === ownerId && owner.getRootNode() === element.getRootNode(),
    ask,
  };

  ask();
  return () => {
    isDone = true;
    waiting.delete(request);
    forget?.();
    forget = undefined;
  };
}
