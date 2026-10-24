/**
 * The React adapter (design decisions 2 and 9). Internal state never
 * re-renders: each part renders once with its current props and a ref, and
 * the DOM binder from `@uniaria/core/dom` writes later changes straight to the
 * element. A component re-renders for state only through
 * `useBehaviorState`, and only when the selected value changes.
 */

import type {
  ActionsOf,
  AnyDefinition,
  Instance,
  ItemPartOf,
  LinkKey,
  OwnerLink,
  PartOf,
  PartProps,
  PropsOf,
  StateOf,
} from '@uniaria/core';
import { createInstance, isOwnerDefinition } from '@uniaria/core';
import type { Binder } from '@uniaria/core/dom';
import {
  createBinder,
  isDevelopment,
  provideOwner,
  requestOwner,
  warn,
} from '@uniaria/core/dom';
import type { SyntheticEvent } from 'react';
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import { OwnerContext, findOwner } from './owner';
import {
  reactEventName,
  reactPropName,
  reactPropValue,
  reactStyleName,
} from './props';

/** Props to spread onto a part element: attributes, stable handlers, a ref. */
export type ReactPartProps = Readonly<Record<string, unknown>> & {
  readonly ref: (element: Element | null) => void;
};

export interface BehaviorHandle<D extends AnyDefinition> {
  /** The stable instance: pass it to `useBehaviorState` or as an `owner`. */
  readonly instance: Instance<D>;
  /** The component's public actions, such as a popover's `open()` and `close()`. */
  readonly actions: ActionsOf<D>;
  /** Props for each part, from this render. */
  readonly parts: Readonly<Record<PartOf<D>, ReactPartProps>>;
  /**
   * Props for one item part of one item (Listbox spec, Item parts), from
   * this render. Later changes reach the element through the binder, so the
   * component rendering the rows doesn't render again for them. Item parts
   * take no live DOM properties as React defaults.
   */
  getItemProps(part: ItemPartOf<D>, key: string): ReactPartProps;
}

/**
 * Live DOM properties React renders once as defaults, so it never controls
 * the element; the binder sets them after that.
 */
const DEFAULT_PROPS: Readonly<Record<string, string>> = {
  value: 'defaultValue',
  checked: 'defaultChecked',
};

interface Internal<D extends AnyDefinition> {
  readonly instance: Instance<D>;
  readonly binder: Binder;
  readonly handlers: Map<string, (event: SyntheticEvent) => void>;
  readonly refs: Map<string, (element: Element | null) => void>;
  /** Per item part and event type; the key comes from the element. */
  readonly itemHandlers: Map<string, (event: SyntheticEvent) => void>;
  /** Per item part and key: its ref, and the props it last rendered. */
  readonly items: Map<
    string,
    {
      readonly ref: (element: Element | null) => void;
      rendered?: { readonly props: PartProps; readonly react: ReactPartProps };
    }
  >;
  readonly getItemProps: (part: string, key: string) => ReactPartProps;
  /**
   * Item elements React attached or detached since the last flush, per part
   * and key: each row has its own ref, so a commit that swaps a range of
   * rows reaches the binder as one batch, in a microtask.
   */
  readonly attaching: Map<
    string,
    { readonly part: string; readonly key: string; element: Element | null }
  >;
  /** Default props from the first render, kept stable after it. */
  readonly defaults: Map<string, Readonly<Record<string, unknown>>>;
  /** Elements whose attributes were checked against the render. */
  readonly checked: WeakSet<Element>;
  /** Whether the instance's owner came from React context. */
  isLinkedByContext: boolean;
  /** The inherited links that came from React context. */
  readonly keysLinkedByContext: Set<LinkKey>;
  rendered?: {
    readonly connected: unknown;
    readonly parts: Record<string, ReactPartProps>;
  };
}

/**
 * Instances whose new props `useBehavior` is syncing after a commit. React's
 * `useSyncExternalStore` records the snapshot it rendered only in a passive
 * effect, so a notification from this layout-effect sync is compared with the
 * previous snapshot, and a component whose render already showed the new
 * props would render again with the same value.
 */
const syncing = new WeakSet<object>();

// Layout effects attach the binder before paint; on the server they never
// run, and React 18 would warn about them.
const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Warns when the element's attributes differ from the part props React just
 * rendered: the consumer wrote an attribute the binder owns, which the binder
 * would silently overwrite.
 */
function checkOwnership<D extends AnyDefinition>(
  internal: Internal<D>,
  part: string,
  element: Element,
  rendered: PartProps | undefined = (
    internal.rendered?.connected as
      Readonly<Record<string, PartProps>> | undefined
  )?.[part],
): void {
  // A named part keeps an id the JSX gives it after the spread, and the
  // binder points every reference at it; an item's id is made from its key.
  const isItem =
    internal.instance.definition.itemParts?.includes(part) ?? false;
  for (const [name, value] of Object.entries(rendered?.attrs ?? {})) {
    if (name === 'id' && !isItem) continue;
    const actual = element.getAttribute(name);
    if (actual === (value ?? null)) continue;
    warn(
      `${internal.instance.definition.name}: "${name}" on the ${part} part is ` +
        `written by UniAria, but the element has ${actual === null ? 'none' : `"${actual}"`}. ` +
        'Pass it as a prop, or drop it from the JSX.',
    );
  }
}

/** Attributes and style as React props. */
function toReactAttrs(
  props: PartProps,
  result: Record<string, unknown>,
): Record<string, unknown> {
  for (const [name, value] of Object.entries(props.attrs)) {
    if (value === undefined) continue;
    const prop = reactPropName(name);
    result[prop] = reactPropValue(prop, value);
  }
  if (props.style) {
    const style: Record<string, string> = {};
    for (const [name, value] of Object.entries(props.style)) {
      if (value !== undefined) style[reactStyleName(name)] = value;
    }
    result.style = style;
  }
  return result;
}

/**
 * Hands the binder every item element attached or detached since the last
 * flush: in a microtask, or before the owner's layout effects when the
 * owner rendered in the same commit, so its instance starts and syncs with
 * its items attached.
 */
function flushAttaching<D extends AnyDefinition>(internal: Internal<D>): void {
  if (internal.attaching.size === 0) return;
  const list = Array.from(internal.attaching.values());
  internal.attaching.clear();
  internal.instance.batch(() => {
    for (const { part, key, element } of list) {
      internal.binder.attachItem(part, key, element);
    }
  });
}

/**
 * `getItemProps` for one instance: React props from the cached
 * `connectItem()`, reused while it returns the same object, with handlers
 * stable per part and event type and a ref stable per part and key.
 */
function createGetItemProps<D extends AnyDefinition>(
  internal: () => Internal<D>,
): (part: string, key: string) => ReactPartProps {
  return (part, key) => {
    const { instance, binder, itemHandlers, items } = internal();
    const props = instance.connectItem(part as never, key);
    const id = `${part}\n${key}`;
    let item = items.get(id);
    if (!item) {
      const ref = (element: Element | null) => {
        const current = internal();
        const entry = current.items.get(id);
        if (element && isDevelopment() && !current.checked.has(element)) {
          current.checked.add(element);
          checkOwnership(current, part, element, entry?.rendered?.props);
        }
        const pending = current.attaching.get(id);
        if (pending) pending.element = element;
        else {
          if (current.attaching.size === 0) {
            queueMicrotask(() => flushAttaching(current));
          }
          current.attaching.set(id, { part, key, element });
        }
        // An item that unmounts takes its cache with it; a remount gets a
        // new ref.
        if (!element && entry?.ref === ref) current.items.delete(id);
      };
      item = { ref };
      items.set(id, item);
    }
    if (item.rendered?.props === props) return item.rendered.react;
    const result = toReactAttrs(props, {});
    for (const type of Object.keys(props.on ?? {})) {
      const handlerKey = `${part}:${type}`;
      let handler = itemHandlers.get(handlerKey);
      if (!handler) {
        handler = (event: SyntheticEvent) => {
          const target = binder.itemOf(event.currentTarget as Element);
          if (!target) return;
          instance
            .connectItem(target.part as never, target.key)
            .on?.[type]?.(event.nativeEvent as never);
        };
        itemHandlers.set(handlerKey, handler);
      }
      result[reactEventName(type)] = handler;
    }
    const react = { ...result, ref: item.ref } as ReactPartProps;
    item.rendered = { props, react };
    return react;
  };
}

function toReactParts<D extends AnyDefinition>(
  internal: Internal<D>,
  connected: Readonly<Record<string, PartProps>>,
): Record<string, ReactPartProps> {
  const { instance, binder, handlers, refs, defaults } = internal;
  const parts: Record<string, ReactPartProps> = {};
  for (const [part, props] of Object.entries(connected)) {
    const result: Record<string, unknown> = {};
    // From the first render only: a later default would reset the value
    // attribute, which a form reset goes back to.
    let initial = defaults.get(part);
    if (!initial) {
      const first: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(props.properties ?? {})) {
        const prop = DEFAULT_PROPS[name];
        if (prop && value !== undefined) first[prop] = value;
      }
      initial = first;
      defaults.set(part, initial);
    }
    Object.assign(result, initial);
    toReactAttrs(props, result);
    // Handlers keep their identity across renders and call the handler from
    // the latest connect() with the native event.
    for (const type of Object.keys(props.on ?? {})) {
      const key = `${part}:${type}`;
      let handler = handlers.get(key);
      if (!handler) {
        handler = (event: SyntheticEvent) => {
          const latest = instance.connect() as Readonly<
            Record<string, PartProps>
          >;
          latest[part]?.on?.[type]?.(event.nativeEvent as never);
        };
        handlers.set(key, handler);
      }
      result[reactEventName(type)] = handler;
    }
    let ref = refs.get(part);
    if (!ref) {
      ref = (element: Element | null) => {
        // Once per element: one attached again (StrictMode does) carries
        // what the binder wrote since the render.
        if (element && isDevelopment() && !internal.checked.has(element)) {
          internal.checked.add(element);
          checkOwnership(internal, part, element);
        }
        binder.attach(part, element);
      };
      refs.set(part, ref);
    }
    parts[part] = { ...result, ref };
  }
  return parts;
}

/**
 * Creates an instance of `definition` for this component and returns props
 * for its parts. Props are stored silently during render and synced after
 * commit; internal state changes never re-render this component.
 */
export function useBehavior<D extends AnyDefinition>(
  definition: D,
  props: NoInfer<PropsOf<D>>,
): BehaviorHandle<D> {
  const id = useId();
  const ref = useRef<Internal<D> | null>(null);
  if (ref.current?.instance.definition !== definition) {
    const instance = createInstance(definition, { props, id });
    ref.current = {
      instance,
      binder: createBinder(instance),
      handlers: new Map(),
      refs: new Map(),
      itemHandlers: new Map(),
      items: new Map(),
      getItemProps: createGetItemProps(() => ref.current!),
      attaching: new Map(),
      defaults: new Map(),
      checked: new WeakSet(),
      isLinkedByContext: false,
      keysLinkedByContext: new Set(),
    };
  } else {
    ref.current.instance.setProps(props);
  }
  const internal = ref.current;
  const { instance, binder } = internal;

  // Decision 11: the `owner` prop, else React context during render (so the
  // first render and SSR have it), else the DOM after mount.
  const scope = useContext(OwnerContext);
  const ownerLink = (definition as { owner?: OwnerLink }).owner;
  const contextOwner = ownerLink
    ? findOwner(scope, ownerLink.definition)
    : undefined;
  if (contextOwner) {
    instance.link(contextOwner);
    internal.isLinkedByContext = true;
  } else if (internal.isLinkedByContext) {
    instance.link(undefined);
    internal.isLinkedByContext = false;
  }
  const isLinkedByDom =
    ownerLink !== undefined &&
    contextOwner === undefined &&
    (props as { owner?: unknown }).owner === undefined;

  // Inherited links (a field's form) the same way, unless the key's prop
  // gives the instance, or `null` for none (Form spec, Runtime changes 1).
  const keysByDom: LinkKey[] = [];
  for (const key of (definition.links ?? []) as readonly LinkKey[]) {
    if (!key.isInherited) continue;
    const own = (props as Readonly<Record<string, unknown>>)[key.name];
    const found = own === undefined ? findOwner(scope, key) : undefined;
    if (found) {
      instance.link(found, key);
      internal.keysLinkedByContext.add(key);
    } else {
      if (internal.keysLinkedByContext.delete(key)) {
        instance.link(undefined, key);
      }
      if (own === undefined) keysByDom.push(key);
    }
  }
  const keysByDomName = keysByDom.map((key) => key.name).join(' ');

  useIsomorphicLayoutEffect(() => {
    flushAttaching(internal);
    // In one batch, so the start's element effects run once the binder has
    // written the parts: an overlay open from the start is `data-entering`
    // as it shows.
    instance.batch(() => {
      instance.start();
      binder.start();
    });
    // Answers owner requests from custom elements and React components that
    // find their owner through the DOM.
    const unprovide = isOwnerDefinition(definition)
      ? definition.parts.flatMap((part: string) => {
          const element = instance.element(part as PartOf<D>);
          return element
            ? [
                provideOwner(
                  instance as unknown as Instance,
                  element as Element,
                ),
              ]
            : [];
        })
      : [];
    return () => {
      for (const stop of unprovide) stop();
      binder.stop();
      instance.stop();
    };
  }, [instance, binder]);

  useIsomorphicLayoutEffect(() => {
    if (!isLinkedByDom) return;
    const element = definition.parts
      .map((part: string) => instance.element(part as PartOf<D>))
      .find(Boolean) as Element | undefined;
    if (!element) return;
    const forget = requestOwner(element, ownerLink!.definition, (owner) => {
      instance.link(owner);
      instance.sync();
    });
    return () => {
      forget();
      instance.link(undefined);
      instance.sync();
    };
  }, [instance, isLinkedByDom]);

  useIsomorphicLayoutEffect(() => {
    if (keysByDom.length === 0) return;
    const element = definition.parts
      .map((part: string) => instance.element(part as PartOf<D>))
      .find(Boolean) as Element | undefined;
    if (!element) return;
    const forgets = keysByDom.map((key) =>
      requestOwner(element, key, (target) => {
        instance.link(target, key);
        instance.sync();
      }),
    );
    return () => {
      for (const forget of forgets) forget();
      for (const key of keysByDom) instance.link(undefined, key);
      instance.sync();
    };
    // By name: `keysByDom` is a new array every render.
  }, [instance, keysByDomName]);

  useIsomorphicLayoutEffect(() => {
    flushAttaching(internal);
    syncing.add(instance);
    try {
      instance.sync();
    } finally {
      syncing.delete(instance);
    }
  });

  const connected = instance.connect();
  if (internal.rendered?.connected !== connected) {
    internal.rendered = {
      connected,
      parts: toReactParts(internal, connected),
    };
  }

  return {
    instance,
    actions: instance.actions,
    parts: internal.rendered.parts as BehaviorHandle<D>['parts'],
    getItemProps: internal.getItemProps as BehaviorHandle<D>['getItemProps'],
  };
}

/**
 * Reads one value of an instance's public state and re-renders only when it
 * changes (`Object.is`, or `isEqual`). Takes the instance or the handle
 * `useBehavior` returned.
 */
export function useBehaviorState<D extends AnyDefinition, T>(
  source: Instance<D> | BehaviorHandle<D>,
  selector: (state: StateOf<D>) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const instance = 'instance' in source ? source.instance : source;
  const cache = useRef<{
    state: StateOf<D>;
    selector: (state: StateOf<D>) => T;
    value: T;
  } | null>(null);

  // The selected value is the snapshot, so it must be stable between
  // changes: reuse it while the state object is the same, or while the new
  // selection is equal to the last one.
  const getSnapshot = (): T => {
    const state = instance.getState();
    const last = cache.current;
    if (last?.state === state && last.selector === selector) return last.value;
    const value = selector(state);
    const stable = last && isEqual(last.value, value) ? last.value : value;
    cache.current = { state, selector, value: stable };
    return stable;
  };

  // The committed value and snapshot function. Insertion effects run before
  // every layout effect, so they are current when `useBehavior` syncs.
  const committed = useRef<{ value: T; getSnapshot: () => T } | null>(null);

  // Skips the notification from the prop sync after a commit when this hook
  // already rendered the value it would bring (see `syncing`). A change the
  // sync itself makes, such as hover ending on disable, still re-renders.
  const subscribe = useCallback(
    (onChange: () => void) =>
      instance.subscribe(() => {
        const last = committed.current;
        if (
          syncing.has(instance) &&
          last &&
          Object.is(last.value, last.getSnapshot())
        ) {
          return;
        }
        onChange();
      }),
    [instance],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useInsertionEffect(() => {
    committed.current = { value, getSnapshot };
  });
  return value;
}
