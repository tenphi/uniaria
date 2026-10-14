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
  PartOf,
  PartProps,
  PropsOf,
  StateOf,
} from '@tenphi/sous';
import { createInstance } from '@tenphi/sous';
import type { Binder } from '@tenphi/sous/dom';
import { createBinder, isDevelopment, warn } from '@tenphi/sous/dom';
import type { SyntheticEvent } from 'react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

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

interface Internal<D extends AnyDefinition> {
  readonly instance: Instance<D>;
  readonly binder: Binder;
  readonly handlers: Map<string, (event: SyntheticEvent) => void>;
  readonly refs: Map<string, (element: Element | null) => void>;
  rendered?: {
    readonly connected: unknown;
    readonly parts: Record<string, ReactPartProps>;
  };
}

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
  const { instance, binder, handlers, refs } = internal;
  const parts: Record<string, ReactPartProps> = {};
  for (const [part, props] of Object.entries(connected)) {
    const result: Record<string, unknown> = {};
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
        if (element && isDevelopment()) checkOwnership(internal, part, element);
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
  props: PropsOf<D>,
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
    };
  } else {
    ref.current.instance.setProps(props);
  }
  const internal = ref.current;
  const { instance, binder } = internal;

  useIsomorphicLayoutEffect(() => {
    instance.start();
    binder.start();
    return () => {
      binder.stop();
      instance.stop();
    };
  }, [instance, binder]);

  useIsomorphicLayoutEffect(() => {
    instance.sync();
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

  return useSyncExternalStore(instance.subscribe, getSnapshot, getSnapshot);
}
