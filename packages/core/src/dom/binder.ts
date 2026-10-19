/**
 * The DOM binder both adapters share (design decision 2, root AGENTS.md →
 * No re-renders for internal state).
 *
 * An adapter renders each part once and hands the binder the element. From
 * then on the binder subscribes to the instance's store, re-runs `connect()`
 * after every flush and writes only the attributes and styles that differ
 * from the element, so internal state never re-renders a framework
 * component.
 *
 * The binder owns every attribute `connect()` has ever returned for a part:
 * `undefined` removes it. It compares with the element itself rather than
 * with what it wrote last, so a framework writing the same attributes from a
 * render never leaves the two out of step. Live DOM properties (an input's
 * `value`) are set only when they differ from the element, so an input's
 * caret stays put while the two agree; `undefined` leaves one alone.
 *
 * Except `id` (owner, 2026-10-19): a part keeps an id the consumer gave its
 * element. The binder reads it as the element attaches, before each write
 * and whenever it changes (a mutation observer, while started), and hands it
 * to the instance (`adoptId()`), so `ids` and every reference follow it; it
 * writes the part's own id only where the element has none. Item parts keep
 * the ids made from their key.
 *
 * When an element stops being a part (another element takes the part, or
 * none), the binder removes the attributes and styles it wrote there and
 * that still hold what it wrote, unless another part bound to the element,
 * of this instance or another, writes them too. What it never wrote stays:
 * the markers the consumer authored (`data-element`, `data-key`, the root's
 * class), an id the consumer gave, and what a framework rendered from the
 * part props, which React removes itself.
 *
 * Except while the browser's own change is on its way to the instance: the
 * browser changes an input's `value`, or a checkbox's or radio's `checked`,
 * before the `input` or `click` event that tells the instance. A consumer's
 * listener on the path that flushes the instance (by setting an attribute of
 * the host) would write the old value back, and the user's keystroke or
 * toggle would be lost. From a custom element's root capturing such an event
 * until the root's bubble phase, where the instance hears of it, the binder
 * writes only a property the instance changed since it last wrote it.
 *
 * Item parts (Listbox spec, Item parts) are bound per part and key. After a
 * flush the binder writes only the items the instance reports invalidated,
 * so moving focus in a long list rewrites two rows, not all of them.
 *
 * Custom elements also pass their host: the binder then delegates each
 * part's listeners for it from the host's root, the document or a shadow
 * root, as React delegates from its root container (owner, 2026-10-19): in
 * the bubble phase for events that bubble, so the consumer's listeners on the
 * path run first and can prevent one, and in the capture phase for those that
 * don't, like `pointerenter`. A bubbling event reaches every part on its path,
 * innermost first, as React's listeners on each part element would; one that
 * doesn't bubble reaches only its target's part. React attaches its own
 * listeners.
 *
 * Never from the host itself: Chromium exposes an element with a `click` or
 * `mousedown` listener as clickable, and NVDA then says "clickable" before
 * every control inside it (probed; listeners on the document are not
 * reported). One pair of listeners per event type and root serves every host
 * in it, and none after a handler stops propagation.
 */

import type { AnyDefinition, Instance, PartProps } from '../runtime';

export interface BinderOptions {
  /** The custom-element host to delegate part listeners for. */
  readonly host?: HTMLElement;
}

export interface Binder {
  /** Registers (or with `null`, removes) a part's element; the ref target. */
  attach(part: string, element: Element | null): void;
  /** Registers (or with `null`, removes) the element of an item part. */
  attachItem(part: string, key: string, element: Element | null): void;
  /** The item part and key an element is attached for. */
  itemOf(element: Element): ItemTarget | undefined;
  /** Subscribes to the store and writes the current part props. */
  start(): void;
  stop(): void;
  /** Writes the current part props to every attached element. */
  apply(): void;
}

export interface ItemTarget {
  readonly part: string;
  readonly key: string;
}

interface Bound {
  readonly element: Element;
  readonly attrs: Set<string>;
  readonly style: Set<string>;
  /** Each live property as the binder last wrote or found it. */
  readonly properties: Map<string, unknown>;
  /** Attributes the binder set on the element, with the value it set. */
  readonly written: Map<string, string>;
  /** Styles the binder set, with the value the element then held. */
  readonly writtenStyle: Map<string, string>;
  /**
   * The part's id when the element last held it, written or rendered from
   * the part props: still the part's own while the id changes.
   */
  partId?: string;
}

const newBound = (element: Element): Bound => ({
  element,
  attrs: new Set(),
  style: new Set(),
  properties: new Map(),
  written: new Map(),
  writtenStyle: new Map(),
});

/** Every part bound to each element, by any binder. */
const boundOn = new WeakMap<Element, Set<Bound>>();

function register(entry: Bound): void {
  let entries = boundOn.get(entry.element);
  if (!entries) boundOn.set(entry.element, (entries = new Set()));
  entries.add(entry);
}

/**
 * Removes what the binder wrote on an element that stopped being this part
 * (see the module comment): only what still holds the value it wrote, and
 * nothing another part bound to the element writes too.
 */
function release(entry: Bound): void {
  const { element } = entry;
  const others = boundOn.get(element);
  others?.delete(entry);
  if (others?.size === 0) boundOn.delete(element);
  const isClaimed = (name: string, kind: 'attrs' | 'style') => {
    for (const other of others ?? []) if (other[kind].has(name)) return true;
    return false;
  };
  for (const [name, value] of entry.written) {
    if (element.getAttribute(name) === value && !isClaimed(name, 'attrs')) {
      element.removeAttribute(name);
    }
  }
  const style = (element as HTMLElement).style as
    CSSStyleDeclaration | undefined;
  for (const [name, value] of entry.writtenStyle) {
    if (style?.getPropertyValue(name) === value && !isClaimed(name, 'style')) {
      style.removeProperty(name);
    }
  }
  entry.written.clear();
  entry.writtenStyle.clear();
}

interface BoundItem extends Bound {
  readonly part: string;
  readonly key: string;
  /** The props written last: unchanged cached props need no write. */
  last?: PartProps;
}

/** A part element, or an item part's with its key. */
type Target = string | ItemTarget;

type Dispatch = (event: Event) => void;

/**
 * One event type's listeners on a root, and the hosts they serve: with no
 * dispatch, a host that only guards its properties from the type's events.
 */
interface RootListener {
  readonly hosts: Map<Node, Dispatch | undefined>;
  readonly capture: Dispatch;
  readonly bubble: Dispatch;
}

const rootListeners = new WeakMap<Node, Map<string, RootListener>>();

/** Event types that come after the browser changed a live property. */
const CHANGING = new Set(['click', 'input', 'change']);

/** Per root, such events between its capture and bubble phases. */
const changingEvents = new WeakMap<Node, Set<Event>>();

/**
 * Whether an event of a `CHANGING` type is on its way to the hosts of
 * `root`. One whose propagation a listener stopped never reaches the bubble
 * phase, and counts until its dispatch ends.
 */
function isChanging(root: Node): boolean {
  const events = changingEvents.get(root);
  if (!events) return false;
  for (const event of events) {
    if (event.eventPhase === Event.NONE) events.delete(event);
  }
  return events.size > 0;
}

/** The browser treats these as passive on the document unless told not to. */
const PASSIVE_BY_DEFAULT = new Set([
  'touchstart',
  'touchmove',
  'wheel',
  'mousewheel',
]);

/**
 * Hands `event` to every host on its path: innermost first for one that
 * bubbles, as the bubble phase reaches them, outermost first for one that
 * doesn't, as the capture phase does. None after a handler stops it.
 */
function dispatchToHosts(
  hosts: Map<Node, Dispatch | undefined>,
  event: Event,
): void {
  const reached: Dispatch[] = [];
  for (let node = event.target as Node | null; node; node = node.parentNode) {
    const dispatch = hosts.get(node);
    if (dispatch) reached.push(dispatch);
  }
  if (!event.bubbles) reached.reverse();
  for (const dispatch of reached) {
    dispatch(event);
    if (event.cancelBubble) return;
  }
}

/** Listens for `host`; with no `dispatch`, only to guard its properties. */
function listenFromRoot(
  root: Node,
  type: string,
  host: Node,
  dispatch?: Dispatch,
): void {
  let types = rootListeners.get(root);
  if (!types) rootListeners.set(root, (types = new Map()));
  let entry = types.get(type);
  if (!entry) {
    const hosts = new Map<Node, Dispatch | undefined>();
    entry = {
      hosts,
      // Events that don't bubble reach the root only while capturing, and
      // reach the hosts before any consumer's listener.
      capture: (event) => {
        if (!event.bubbles) dispatchToHosts(hosts, event);
        else if (CHANGING.has(type)) {
          let events = changingEvents.get(root);
          if (!events) changingEvents.set(root, (events = new Set()));
          events.add(event);
        }
      },
      // Bubbling ones once every listener on their path has run, so a
      // consumer's listener can prevent one first, as with React.
      bubble: (event) => {
        changingEvents.get(root)?.delete(event);
        dispatchToHosts(hosts, event);
      },
    };
    types.set(type, entry);
    const passive = PASSIVE_BY_DEFAULT.has(type) ? { passive: false } : {};
    root.addEventListener(type, entry.capture, { ...passive, capture: true });
    root.addEventListener(type, entry.bubble, passive);
  }
  if (dispatch || !entry.hosts.has(host)) entry.hosts.set(host, dispatch);
}

function unlistenFromRoot(root: Node, type: string, host: Node): void {
  const types = rootListeners.get(root);
  const entry = types?.get(type);
  if (!types || !entry) return;
  entry.hosts.delete(host);
  if (entry.hosts.size > 0) return;
  root.removeEventListener(type, entry.capture, true);
  root.removeEventListener(type, entry.bubble);
  types.delete(type);
}

const itemEntryId = (part: string, key: string) => `${part}\n${key}`;

export function createBinder<D extends AnyDefinition>(
  instance: Instance<D>,
  options: BinderOptions = {},
): Binder {
  const { host } = options;
  const bound = new Map<string, Bound>();
  const items = new Map<string, BoundItem>();
  const itemsByKey = new Map<string, Set<BoundItem>>();
  const targets = new Map<Element, Target>();
  const delegated = new Set<string>();
  /** The root the listeners are on, from the first one to the last. */
  let root: Node | undefined;
  let unsubscribe: (() => void) | undefined;
  let unsubscribeItems: (() => void) | undefined;
  /** Keys of items to write on the next apply, or `'all'`. */
  let pending: Set<string> | 'all' = 'all';
  /** Watches the parts' ids while started. */
  let idObserver: MutationObserver | undefined;

  /**
   * Hands the instance the id the consumer gave a part's element: one that
   * differs from the part's id and from the one the element last held for
   * it, or none.
   */
  const readId = (part: string, entry: Bound): void => {
    const value = entry.element.getAttribute('id') || undefined;
    if (value === (instance.ids as Readonly<Record<string, string>>)[part]) {
      entry.partId = value;
      return;
    }
    // The part's id as it was (its id prop changed): the write that follows
    // brings it up to date.
    if (value !== undefined && value === entry.partId) return;
    entry.written.delete('id');
    instance.adoptId(part as never, value);
    entry.partId = value;
  };

  const readIds = (): void => {
    instance.batch(() => {
      for (const [part, entry] of bound) readId(part, entry);
    });
  };

  const observeId = (element: Element): void => {
    if (!unsubscribe) return;
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    idObserver ??= new view.MutationObserver((records) => {
      instance.batch(() => {
        for (const { target } of records) {
          const part = targets.get(target as Element);
          if (typeof part !== 'string') continue;
          const entry = bound.get(part);
          if (entry?.element === target) readId(part, entry);
        }
      });
    });
    idObserver.observe(element, { attributes: true, attributeFilter: ['id'] });
  };

  /**
   * The parts an event reaches, innermost first: every part on the path from
   * the target up to the host for a bubbling event, as the bubble phase
   * would, and only the target's own part for one that doesn't bubble.
   */
  const partsOf = (event: Event): Target[] => {
    let node = event.target as Node | null;
    if (!event.bubbles) {
      const target = node ? targets.get(node as Element) : undefined;
      return target === undefined ? [] : [target];
    }
    const path: Target[] = [];
    while (node && node !== host) {
      const target = targets.get(node as Element);
      if (target !== undefined) path.push(target);
      node = node.parentNode;
    }
    return path;
  };

  const dispatch = (event: Event): void => {
    for (const target of partsOf(event)) {
      // Fresh props for each part: a handler may have changed state.
      const props =
        typeof target === 'string'
          ? (instance.connect() as Readonly<Record<string, PartProps>>)[target]
          : instance.connectItem(target.part as never, target.key);
      props?.on?.[event.type]?.(event as never);
    }
  };

  const delegate = (types: readonly string[]): void => {
    if (!host || !unsubscribe) return;
    for (const type of types) {
      if (delegated.has(type)) continue;
      delegated.add(type);
      root ??= host.getRootNode();
      listenFromRoot(root, type, host, dispatch);
    }
  };

  const write = (part: string, entry: Bound): void => {
    const props = (instance.connect() as Readonly<Record<string, PartProps>>)[
      part
    ];
    if (props) writeProps(entry, props);
  };

  const writeItem = (entry: BoundItem): void => {
    const props = instance.connectItem(entry.part as never, entry.key);
    if (props === entry.last) return;
    entry.last = props;
    writeProps(entry, props);
  };

  const writeProps = (entry: Bound, props: PartProps): void => {
    const { element, written, writtenStyle } = entry;
    for (const name of Object.keys(props.attrs)) entry.attrs.add(name);
    for (const name of entry.attrs) {
      const value = props.attrs[name];
      if (value === undefined) {
        if (element.hasAttribute(name)) element.removeAttribute(name);
        written.delete(name);
      } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
        written.set(name, value);
        if (name === 'id') entry.partId = value;
      }
    }
    const style = (element as HTMLElement).style as
      CSSStyleDeclaration | undefined;
    if (style) {
      for (const name of Object.keys(props.style ?? {})) entry.style.add(name);
      for (const name of entry.style) {
        const value = props.style?.[name];
        if (value === undefined) {
          style.removeProperty(name);
          writtenStyle.delete(name);
        } else if (style.getPropertyValue(name) !== value) {
          style.setProperty(name, value);
          writtenStyle.set(name, style.getPropertyValue(name));
        }
      }
    }
    const changing = root !== undefined && isChanging(root);
    const target = element as unknown as Record<string, unknown>;
    for (const [name, value] of Object.entries(props.properties ?? {})) {
      if (value === undefined) continue;
      const known = changing ? entry.properties.get(name) : target[name];
      if (known !== value) target[name] = value;
      entry.properties.set(name, value);
    }
    if (props.on) delegate(Object.keys(props.on));
  };

  const apply = (): void => {
    // An id the consumer changed is the part's from now on, not overwritten:
    // the observer hears of it only after a flush that comes first.
    readIds();
    for (const [part, entry] of bound) write(part, entry);
    const keys = pending;
    pending = new Set();
    if (keys === 'all') {
      for (const entry of items.values()) writeItem(entry);
      return;
    }
    for (const key of keys) {
      for (const entry of itemsByKey.get(key) ?? []) writeItem(entry);
    }
  };

  const detachItem = (entry: BoundItem): void => {
    items.delete(itemEntryId(entry.part, entry.key));
    targets.delete(entry.element);
    const siblings = itemsByKey.get(entry.key);
    siblings?.delete(entry);
    if (siblings?.size === 0) itemsByKey.delete(entry.key);
    release(entry);
  };

  return {
    attach(part, element) {
      const current = bound.get(part);
      if ((current?.element ?? null) === element) return;
      const entry = element ? newBound(element) : undefined;
      // One flush for the element and its id, which references follow.
      instance.batch(() => {
        if (current) {
          targets.delete(current.element);
          bound.delete(part);
          release(current);
        }
        if (entry) {
          bound.set(part, entry);
          targets.set(entry.element, part);
          register(entry);
          observeId(entry.element);
          readId(part, entry);
        } else {
          // The element that gave the part an id is gone.
          instance.adoptId(part as never, undefined);
        }
        instance.attach(part as never, element);
      });
      if (unsubscribe && entry) write(part, entry);
    },
    attachItem(part, key, element) {
      const current = items.get(itemEntryId(part, key));
      if (current?.element === element) return;
      if (current) detachItem(current);
      if (element) {
        const entry: BoundItem = { ...newBound(element), part, key };
        register(entry);
        items.set(itemEntryId(part, key), entry);
        let siblings = itemsByKey.get(key);
        if (!siblings) itemsByKey.set(key, (siblings = new Set()));
        siblings.add(entry);
        targets.set(element, { part, key });
      }
      // Written before the instance hears of it, so its item effects see
      // the element with its attributes (a row focused as it attaches needs
      // its tabindex).
      const entry = items.get(itemEntryId(part, key));
      if (unsubscribe && entry) writeItem(entry);
      // Invalidates the key, so its other parts are written on the flush.
      instance.attachItem(part as never, key, element);
    },
    itemOf(element) {
      const target = targets.get(element);
      return typeof target === 'object' ? target : undefined;
    },
    start() {
      if (unsubscribe) return;
      if (host) {
        root ??= host.getRootNode();
        for (const type of CHANGING) listenFromRoot(root, type, host);
      }
      pending = 'all';
      unsubscribeItems = instance.subscribeItems((keys) => {
        if (pending === 'all') return;
        if (keys === null) pending = 'all';
        else for (const key of keys) pending.add(key);
      });
      unsubscribe = instance.subscribe(apply);
      for (const entry of bound.values()) observeId(entry.element);
      apply();
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      idObserver?.disconnect();
      idObserver = undefined;
      unsubscribeItems?.();
      unsubscribeItems = undefined;
      if (host && root) {
        for (const type of [...delegated, ...CHANGING]) {
          unlistenFromRoot(root, type, host);
        }
      }
      delegated.clear();
      root = undefined;
    },
    apply,
  };
}
