/**
 * The React adapter (design decisions 2 and 9). Internal state never
 * re-renders: each part renders once with its current props and a ref, and
 * the DOM binder from `@tenphi/sous/dom` writes later changes straight to the
 * element. A component re-renders for state only through
 * `useComponentState`, and only when the selected value changes.
 */

import type {
  AnyDefinition,
  ApiOf,
  Instance,
  OwnerLink,
  PartOf,
  PartProps,
  PropsOf,
  StateOf,
} from '@tenphi/sous';
import { createInstance, isOwnerDefinition } from '@tenphi/sous';
import type { Binder } from '@tenphi/sous/dom';
import {
  createBinder,
  isDevelopment,
  provideOwner,
  requestOwner,
  warn,
} from '@tenphi/sous/dom';
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
import { reactEventName, reactPropName, reactPropValue } from './props';

/** Props to spread onto a part element: attributes, stable handlers, a ref. */
export type ReactPartProps = Readonly<Record<string, unknown>> & {
  readonly ref: (element: Element | null) => void;
};

export interface ComponentHandle<D extends AnyDefinition> {
  /** The stable instance: pass it to `useComponentState` or as an `owner`. */
  readonly instance: Instance<D>;
  /** What the definition's `setup()` returned. */
  readonly api: ApiOf<D>;
  /** Props for each part, from this render. */
  readonly parts: Readonly<Record<PartOf<D>, ReactPartProps>>;
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
  /** Default props from the first render, kept stable after it. */
  readonly defaults: Map<string, Readonly<Record<string, unknown>>>;
  /** Elements whose attributes were checked against the render. */
  readonly checked: WeakSet<Element>;
  /** Whether the instance's owner came from React context. */
  isLinkedByContext: boolean;
  rendered?: {
    readonly connected: unknown;
    readonly parts: Record<string, ReactPartProps>;
  };
}

/**
 * Instances whose new props `useComponent` is syncing after a commit. React's
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
): void {
  const rendered = internal.rendered?.connected as
    Readonly<Record<string, PartProps>> | undefined;
  for (const [name, value] of Object.entries(rendered?.[part]?.attrs ?? {})) {
    const actual = element.getAttribute(name);
    if (actual === (value ?? null)) continue;
    warn(
      `${internal.instance.definition.name}: "${name}" on the ${part} part is ` +
        `written by Sous, but the element has ${actual === null ? 'none' : `"${actual}"`}. ` +
        'Pass it as a prop, or drop it from the JSX.',
    );
  }
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
    for (const [name, value] of Object.entries(props.attrs)) {
      if (value === undefined) continue;
      const prop = reactPropName(name);
      result[prop] = reactPropValue(prop, value);
    }
    if (props.style) {
      const style: Record<string, string> = {};
      for (const [name, value] of Object.entries(props.style)) {
        if (value !== undefined) style[name] = value;
      }
      result.style = style;
    }
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
export function useComponent<D extends AnyDefinition>(
  definition: D,
  props: NoInfer<PropsOf<D>>,
): ComponentHandle<D> {
  const id = useId();
  const ref = useRef<Internal<D> | null>(null);
  if (ref.current?.instance.definition !== definition) {
    const instance = createInstance(definition, { props, id });
    ref.current = {
      instance,
      binder: createBinder(instance),
      handlers: new Map(),
      refs: new Map(),
      defaults: new Map(),
      checked: new WeakSet(),
      isLinkedByContext: false,
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

  useIsomorphicLayoutEffect(() => {
    instance.start();
    binder.start();
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
    api: instance.api,
    parts: internal.rendered.parts as ComponentHandle<D>['parts'],
  };
}

/**
 * Reads one value of an instance's public state and re-renders only when it
 * changes (`Object.is`, or `isEqual`). Takes the instance or the handle
 * `useComponent` returned.
 */
export function useComponentState<D extends AnyDefinition, T>(
  source: Instance<D> | ComponentHandle<D>,
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
  // every layout effect, so they are current when `useComponent` syncs.
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
