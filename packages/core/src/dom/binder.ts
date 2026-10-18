/**
 * The DOM binder both adapters share (design decision 2, root AGENTS.md →
 * No re-renders for internal state).
 *
 * An adapter renders each part once and hands the binder the element. From
 * then on the binder subscribes to the instance's store, re-runs `connect()`
 * after every flush and writes only the attributes and CSS variables that
 * differ from the element, so internal state never re-renders a framework
 * component.
 *
 * The binder owns every attribute `connect()` has ever returned for a part:
 * `undefined` removes it. It compares with the element itself rather than
 * with what it wrote last, so a framework writing the same attributes from a
 * render never leaves the two out of step. Live DOM properties (an input's
 * `value`) are set only when they differ from the element, so an input's
 * caret stays put while the two agree; `undefined` leaves one alone.
 *
 * Item parts (Listbox spec, Item parts) are bound per part and key. After a
 * flush the binder writes only the items the instance reports invalidated,
 * so moving focus in a long list rewrites two rows, not all of them.
 *
 * Custom elements also pass their host: the binder then delegates each
 * part's listeners from it (capture phase, so events that don't bubble, like
 * `pointerenter`, are seen too). A bubbling event reaches every part on its
 * path, innermost first, as React's listeners on each part element would; one
 * that doesn't bubble reaches only its target's part. React attaches its own
 * listeners.
 */

import type { AnyDefinition, Instance, PartProps } from '../runtime';

export interface BinderOptions {
  /** The custom-element host to delegate part listeners from. */
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
}

interface BoundItem extends Bound {
  readonly part: string;
  readonly key: string;
  /** The props written last: unchanged cached props need no write. */
  last?: PartProps;
}

/** A part element, or an item part's with its key. */
type Target = string | ItemTarget;

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
  let unsubscribe: (() => void) | undefined;
  let unsubscribeItems: (() => void) | undefined;
  /** Keys of items to write on the next apply, or `'all'`. */
  let pending: Set<string> | 'all' = 'all';

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
      host.addEventListener(type, dispatch, true);
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
    const { element } = entry;
    for (const name of Object.keys(props.attrs)) entry.attrs.add(name);
    for (const name of entry.attrs) {
      const value = props.attrs[name];
      if (value === undefined) {
        if (element.hasAttribute(name)) element.removeAttribute(name);
      } else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
      }
    }
    const style = (element as HTMLElement).style as
      CSSStyleDeclaration | undefined;
    if (style) {
      for (const name of Object.keys(props.style ?? {})) entry.style.add(name);
      for (const name of entry.style) {
        const value = props.style?.[name as `--${string}`];
        if (value === undefined) style.removeProperty(name);
        else if (style.getPropertyValue(name) !== value) {
          style.setProperty(name, value);
        }
      }
    }
    for (const [name, value] of Object.entries(props.properties ?? {})) {
      if (value === undefined) continue;
      const target = element as unknown as Record<string, unknown>;
      if (target[name] !== value) target[name] = value;
    }
    if (props.on) delegate(Object.keys(props.on));
  };

  const apply = (): void => {
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
  };

  return {
    attach(part, element) {
      const current = bound.get(part);
      if (current?.element === element) return;
      if (current) {
        targets.delete(current.element);
        bound.delete(part);
      }
      instance.attach(part as never, element);
      if (!element) return;
      const entry: Bound = { element, attrs: new Set(), style: new Set() };
      bound.set(part, entry);
      targets.set(element, part);
      if (unsubscribe) write(part, entry);
    },
    attachItem(part, key, element) {
      const current = items.get(itemEntryId(part, key));
      if (current?.element === element) return;
      if (current) detachItem(current);
      if (element) {
        const entry: BoundItem = {
          element,
          part,
          key,
          attrs: new Set(),
          style: new Set(),
        };
        items.set(itemEntryId(part, key), entry);
        let siblings = itemsByKey.get(key);
        if (!siblings) itemsByKey.set(key, (siblings = new Set()));
        siblings.add(entry);
        targets.set(element, { part, key });
      }
      // Invalidates the key, so its other parts are written on the flush.
      instance.attachItem(part as never, key, element);
      const entry = items.get(itemEntryId(part, key));
      if (unsubscribe && entry) writeItem(entry);
    },
    itemOf(element) {
      const target = targets.get(element);
      return typeof target === 'object' ? target : undefined;
    },
    start() {
      if (unsubscribe) return;
      pending = 'all';
      unsubscribeItems = instance.subscribeItems((keys) => {
        if (pending === 'all') return;
        if (keys === null) pending = 'all';
        else for (const key of keys) pending.add(key);
      });
      unsubscribe = instance.subscribe(apply);
      apply();
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      unsubscribeItems?.();
      unsubscribeItems = undefined;
      for (const type of delegated)
        host?.removeEventListener(type, dispatch, true);
      delegated.clear();
    },
    apply,
  };
}
