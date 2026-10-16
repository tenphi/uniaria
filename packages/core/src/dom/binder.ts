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
  /** Subscribes to the store and writes the current part props. */
  start(): void;
  stop(): void;
  /** Writes the current part props to every attached element. */
  apply(): void;
}

interface Bound {
  readonly element: Element;
  readonly attrs: Set<string>;
  readonly style: Set<string>;
}

export function createBinder<D extends AnyDefinition>(
  instance: Instance<D>,
  options: BinderOptions = {},
): Binder {
  const { host } = options;
  const bound = new Map<string, Bound>();
  const parts = new Map<Element, string>();
  const delegated = new Set<string>();
  let unsubscribe: (() => void) | undefined;

  /**
   * The parts an event reaches, innermost first: every part on the path from
   * the target up to the host for a bubbling event, as the bubble phase
   * would, and only the target's own part for one that doesn't bubble.
   */
  const partsOf = (event: Event): string[] => {
    let node = event.target as Node | null;
    if (!event.bubbles) {
      const part = node ? parts.get(node as Element) : undefined;
      return part === undefined ? [] : [part];
    }
    const path: string[] = [];
    while (node && node !== host) {
      const part = parts.get(node as Element);
      if (part !== undefined) path.push(part);
      node = node.parentNode;
    }
    return path;
  };

  const dispatch = (event: Event): void => {
    for (const part of partsOf(event)) {
      // Fresh props for each part: a handler may have changed state.
      const props = instance.connect() as Readonly<Record<string, PartProps>>;
      props[part]?.on?.[event.type]?.(event as never);
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
    if (!props) return;
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
  };

  return {
    attach(part, element) {
      const current = bound.get(part);
      if (current?.element === element) return;
      if (current) {
        parts.delete(current.element);
        bound.delete(part);
      }
      instance.attach(part as never, element);
      if (!element) return;
      const entry: Bound = { element, attrs: new Set(), style: new Set() };
      bound.set(part, entry);
      parts.set(element, part);
      if (unsubscribe) write(part, entry);
    },
    start() {
      if (unsubscribe) return;
      unsubscribe = instance.subscribe(apply);
      apply();
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      for (const type of delegated)
        host?.removeEventListener(type, dispatch, true);
      delegated.clear();
    },
    apply,
  };
}
