/**
 * Finding an owner through the DOM (decision 11): the steps both adapters
 * share after the explicit `owner` prop and React's context.
 *
 * - **Nearest ancestor.** A child dispatches a bubbling, composed request
 *   event from its element, in the shape of the Context Community Protocol
 *   (`references/community-protocols/proposals/context.md`). The nearest
 *   element providing an owner of the requested definition answers and stops
 *   the event. Composed, so a child in a wrapper's shadow root finds the
 *   owner around the wrapper (owner decision, 2026-10-19).
 * - **By id.** An attribute such as `<uni-checkbox group="plan">` names the
 *   owner's element, looked up in the child's root node.
 * - **Late owners.** A request nobody answered waits; an owner that starts
 *   providing later answers the waiting requests it matches, so upgrade and
 *   mount order don't matter.
 * - **Leaving.** An owner that stops providing releases its children, which
 *   ask again: another owner may answer.
 * - **Links** (Tooltip spec, Resolved questions 2) are asked for by key
 *   rather than definition, and only of the nearest UniAria host around the
 *   child: a button in a popover inside a tooltip isn't the tooltip's. An
 *   element around the child whose tag is defined later may turn out to be
 *   that nearest host, so the link is asked for again then.
 * - **Inherited links** (Form spec, Runtime changes 1), a field's form, are
 *   asked for by key as owners are: the nearest provider around the child
 *   answers, across other hosts. One that starts providing later and sits
 *   nearer than the one that answered takes over.
 * - Ids are read with `getAttribute('id')`: a form's `id` property is a
 *   control named `id`, if it has one.
 */

import type { AnyDefinition, Instance, LinkKey } from '../runtime';
import { answers } from '../runtime';
import { isUniHost, whenDefined } from './parts';

const REQUEST = 'uni-owner-request';

/**
 * Whether `node` is inside `owner`, through the shadow roots between them,
 * as the composed request event travels.
 */
function isAround(owner: Element, node: Node): boolean {
  let at: Node | undefined = node;
  while (at) {
    if (owner.contains(at)) return true;
    at = (at.getRootNode() as Partial<ShadowRoot>).host;
  }
  return false;
}

/** An owner providing on an element. */
interface Provider {
  readonly instance: Instance;
  readonly element: Element;
  /** Remembers a child's release; returns the function that forgets it. */
  track(release: () => void): () => void;
}

/** An owner's definition, or a link's key. */
type Wanted = AnyDefinition | LinkKey;

interface RequestDetail {
  readonly wanted: Wanted;
  answer(provider: Provider): void;
}

interface Waiting {
  readonly wanted: Wanted;
  /** Whether an owner providing on `element` answers this request. */
  matches(element: Element): boolean;
  ask(): void;
}

/** An inherited link's request, answered or not. */
interface Inheriting extends Waiting {
  /** The element of the provider that answered, if one did. */
  answeredBy(): Element | undefined;
  /** Asks again, letting go of the provider that answered. */
  askAgain(): void;
}

/** Requests nobody has answered yet. */
const waiting = new Set<Waiting>();

/** Inherited links' requests, which a nearer provider may take over. */
const inheriting = new Set<Inheriting>();

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
    element,
    track(release) {
      releases.add(release);
      return () => releases.delete(release);
    },
  };
  const onRequest = (event: Event) => {
    const detail = (event as CustomEvent<RequestDetail | undefined>).detail;
    if (!detail || !answers(instance.definition, detail.wanted)) return;
    event.stopImmediatePropagation();
    detail.answer(provider);
  };
  element.addEventListener(REQUEST, onRequest);
  const list = providers.get(element) ?? [];
  list.push(provider);
  providers.set(element, list);
  for (const request of [...waiting]) {
    if (
      answers(instance.definition, request.wanted) &&
      request.matches(element)
    ) {
      request.ask();
    }
  }
  for (const request of [...inheriting]) {
    const current = request.answeredBy();
    if (
      current &&
      current !== element &&
      isAround(current, element) &&
      answers(instance.definition, request.wanted) &&
      request.matches(element)
    ) {
      request.askAgain();
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

/** The nearest UniAria host around `element`. */
function hostAround(element: Element): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (isUniHost(node)) return node;
  }
  return null;
}

/**
 * Keeps `onChange` told of the owner of `wanted` for `element`, an owner's
 * definition or a link's key: the one whose element has the id `ownerId`
 * when given, else the nearest providing ancestor (for a link, only the
 * nearest UniAria host). `undefined` while there is none. Returns the
 * cleanup.
 */
export function requestOwner(
  element: Element,
  wanted: Wanted,
  onChange: (owner: Instance | undefined) => void,
  ownerId?: string,
): () => void {
  const isLink = !('setup' in wanted);
  // Inherited links are found as owners are; others only on the nearest
  // host.
  const isNearestHost = isLink && (wanted as LinkKey).isInherited !== true;
  let isDone = false;
  let forget: (() => void) | undefined;
  let answeredBy: Element | undefined;
  /** A link's nearest host when it last asked. */
  let host: Element | null = null;
  /** Stops waiting for the tags around the child still undefined. */
  let unwait: (() => void)[] = [];

  const accept = (provider: Provider) => {
    waiting.delete(request);
    answeredBy = provider.element;
    forget = provider.track(() => {
      forget = undefined;
      answeredBy = undefined;
      onChange(undefined);
      ask();
    });
    onChange(provider.instance);
  };

  const providerOn = (target: Element | null): Provider | undefined =>
    target
      ? providers
          .get(target)
          ?.find((provider) => answers(provider.instance.definition, wanted))
      : undefined;

  const byId = (): Provider | undefined => {
    const root = element.getRootNode() as Partial<DocumentOrShadowRoot> & Node;
    return providerOn(
      'getElementById' in root
        ? (root as Document).getElementById(ownerId!)
        : null,
    );
  };

  /** Lets go of the provider that answered, and asks again. */
  const askAgain = () => {
    if (isDone) return;
    if (forget) {
      forget();
      forget = undefined;
      answeredBy = undefined;
      onChange(undefined);
    }
    waiting.delete(request);
    ask();
  };

  // A tag defined between the child and its host may make a nearer host.
  const onDefined = () => {
    if (isDone || hostAround(element) === host) return;
    askAgain();
  };

  const waitForHosts = () => {
    for (const stop of unwait) stop();
    unwait = [];
    const registry = element.ownerDocument.defaultView?.customElements;
    if (!registry) return;
    for (
      let node = element.parentElement;
      node && node !== host;
      node = node.parentElement
    ) {
      if (node.localName.includes('-') && !node.matches(':defined')) {
        unwait.push(whenDefined(registry, node.localName, onDefined));
      }
    }
  };

  const ask = () => {
    if (isDone) return;
    if (ownerId !== undefined || isNearestHost) {
      if (isNearestHost && ownerId === undefined) {
        host = hostAround(element);
        waitForHosts();
      }
      const provider = ownerId !== undefined ? byId() : providerOn(host);
      if (provider) accept(provider);
      else waiting.add(request);
      return;
    }
    let isAnswered = false;
    const detail: RequestDetail = {
      wanted,
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

  const request: Inheriting = {
    wanted,
    matches: (owner) =>
      ownerId !== undefined
        ? owner.getAttribute('id') === ownerId &&
          owner.getRootNode() === element.getRootNode()
        : isNearestHost
          ? owner === hostAround(element)
          : isAround(owner, element),
    ask,
    answeredBy: () => answeredBy,
    askAgain,
  };

  if (isLink && !isNearestHost && ownerId === undefined) {
    inheriting.add(request);
  }
  ask();
  return () => {
    isDone = true;
    waiting.delete(request);
    inheriting.delete(request);
    forget?.();
    forget = undefined;
    for (const stop of unwait) stop();
    unwait = [];
  };
}
