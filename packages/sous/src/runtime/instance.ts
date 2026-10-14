/**
 * One running component: its props, store, the actions `setup()` returned,
 * and the lifecycle both adapters drive (design decisions 7 and 9).
 *
 * Adapters call `setProps()` with every new set of props — silently, because
 * notifying during a React render triggers React's update-while-rendering
 * warning — then `sync()` once the new props are committed. `start()` and
 * `stop()` bracket the time the instance is live in a document; both are
 * idempotent, because React StrictMode mounts twice.
 */

import type {
  AnyDefinition,
  ApiOf,
  Bindable,
  Cell,
  ConnectedParts,
  Env,
  PartHandler,
  PartOf,
  PartProps,
  PropsOf,
  SetupContext,
  StateOf,
  ViewContext,
} from './define';
import type { EventsSchema, PropsSchema } from './schema';
import { callbackName } from './schema';
import { createStore } from './store';

export interface InstanceOptions<D extends AnyDefinition> {
  readonly props?: PropsOf<D>;
  /** Base for part ids. Adapters pass a stable one (`useId` in React). */
  readonly id?: string;
  readonly env?: Env;
}

export interface Instance<D extends AnyDefinition = AnyDefinition> {
  readonly definition: D;
  readonly id: string;
  readonly ids: Readonly<Record<PartOf<D>, string>>;
  /** What `setup()` returned. */
  readonly api: ApiOf<D>;
  getProps(): PropsOf<D>;
  /** Stores new props without notifying. Call `sync()` once they are committed. */
  setProps(props: PropsOf<D>): void;
  /** Notifies for props changed since the last sync, so watchers and the binder run. */
  sync(): void;
  start(): void;
  stop(): void;
  isStarted(): boolean;
  /** The store version: stable between changes (`useSyncExternalStore`). */
  getSnapshot(): number;
  subscribe(listener: () => void): () => void;
  /** What `expose()` returns, cached until state or props change. */
  getState(): StateOf<D>;
  /**
   * Part props from `connect()`, cached until state or props change, with
   * `data-scope` and `data-part` added and every handler run in a batch.
   */
  connect(): ConnectedParts<PartOf<D>>;
  /** Registers the element for a part (`null` removes it). */
  attach(part: PartOf<D>, element: unknown): void;
  element(part: PartOf<D>): unknown;
  batch<T>(fn: () => T): T;
}

interface Watcher {
  read(): unknown;
  callback(value: unknown, previous: unknown): void;
  value: unknown;
}

type Callback = ((value: unknown) => void) | undefined;

let counter = 0;

/** True when a value other than a callback differs. Callbacks change every render. */
function havePropsChanged(
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): boolean {
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const a = previous[key];
    const b = next[key];
    if (typeof a === 'function' && typeof b === 'function') continue;
    if (!Object.is(a, b)) return true;
  }
  return false;
}

export function createInstance<D extends AnyDefinition>(
  definition: D,
  options: InstanceOptions<D> = {},
): Instance<D> {
  const store = createStore();
  // Counts every change, even inside a batch where the store version waits
  // for the flush, so cached connect() and expose() results are never stale.
  let changes = 0;
  const changed = () => {
    changes++;
    store.notify();
  };
  let props = (options.props ?? {}) as Readonly<Record<string, unknown>>;
  let propsVersion = 0;
  let hasUnsyncedProps = false;
  let isStarted = false;
  const id = options.id ?? `sous-${++counter}`;
  const ids: Record<string, string> = {};
  for (const part of definition.parts) ids[part] = `${id}-${part}`;
  const elements = new Map<string, unknown>();
  const watchers: Watcher[] = [];
  const effects: (() => void | (() => void))[] = [];
  let cleanups: (() => void)[] = [];

  const runEffect = (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  };

  const readers: Record<string, (() => unknown) | Bindable<unknown>> = {};
  for (const info of definition.schema.props) {
    const { key, defaultValue } = info;
    if (info.kind === 'prop') {
      readers[key] = () => props[key] ?? defaultValue;
      continue;
    }
    // Like a form control's value attribute, the default applies until the
    // first uncontrolled change ("dirty"), so a default that arrives late (an
    // element's attribute after construction) still seeds the value.
    const defaultKey = info.defaultKey!;
    let isDirty = false;
    let inner: unknown;
    const onChange = callbackName(info.changeEvent!);
    const isControlled = () => props[key] !== undefined;
    const get = () => {
      if (isControlled()) return props[key];
      if (isDirty) return inner;
      return props[defaultKey] ?? defaultValue;
    };
    readers[key] = {
      get,
      isControlled,
      set(value) {
        if (Object.is(value, get())) return;
        store.batch(() => {
          if (!isControlled()) {
            inner = value;
            isDirty = true;
            changed();
          }
          (props[onChange] as Callback)?.(value);
        });
      },
    };
  }

  // The readers match the schema by construction; the generic types can't
  // see that, so they are cast once here.
  const ctx: SetupContext<string, PropsSchema, EventsSchema> = {
    props: readers as never,
    ids,
    env: options.env ?? {},
    state<T>(initial: T): Cell<T> {
      let value = initial;
      return {
        get: () => value,
        set(next) {
          if (Object.is(next, value)) return;
          value = next;
          changed();
        },
      };
    },
    memo(deps, compute) {
      let last: readonly unknown[] | undefined;
      let value: unknown;
      return () => {
        const next = deps();
        const hasChanged =
          last === undefined ||
          next.length !== last.length ||
          next.some((dep, index) => !Object.is(dep, last![index]));
        if (hasChanged) {
          last = next;
          value = compute(...next);
        }
        return value as never;
      };
    },
    effect(effect) {
      effects.push(effect);
      if (isStarted) store.batch(() => runEffect(effect));
    },
    watch(read, callback) {
      const watcher: Watcher = {
        read,
        callback: callback as Watcher['callback'],
        value: isStarted ? read() : undefined,
      };
      watchers.push(watcher);
    },
    emit(name, detail) {
      (props[callbackName(name)] as Callback)?.(detail);
    },
    element: (part) => elements.get(part) ?? null,
    batch: store.batch,
  };

  const api: unknown = definition.setup(ctx);
  const view: ViewContext<string, PropsSchema, unknown> = {
    props: readers as never,
    ids,
    api,
  };

  // Subscribed before any adapter, so watchers settle state before the
  // binder and selectors read it.
  store.subscribe(() => {
    if (!isStarted || watchers.length === 0) return;
    store.batch(() => {
      for (const watcher of watchers) {
        const next = watcher.read();
        if (Object.is(next, watcher.value)) continue;
        const previous = watcher.value;
        watcher.value = next;
        watcher.callback(next, previous);
      }
    });
  });

  const batched = (on: NonNullable<PartProps['on']>) => {
    const result: Record<string, PartHandler> = {};
    for (const [type, handler] of Object.entries(on)) {
      if (handler) {
        result[type] = (event: never) => store.batch(() => handler(event));
      }
    }
    return result;
  };

  let connected:
    | {
        changes: number;
        propsVersion: number;
        parts: Record<string, PartProps>;
      }
    | undefined;
  let exposed:
    { changes: number; propsVersion: number; state: unknown } | undefined;

  const instance: Instance<AnyDefinition> = {
    definition,
    id,
    ids,
    api,
    getProps: () => props as never,
    setProps(next) {
      const previous = props;
      props = next as Readonly<Record<string, unknown>>;
      if (havePropsChanged(previous, props)) {
        propsVersion++;
        hasUnsyncedProps = true;
      }
    },
    sync() {
      if (!hasUnsyncedProps) return;
      hasUnsyncedProps = false;
      store.notify();
    },
    start() {
      if (isStarted) return;
      isStarted = true;
      store.batch(() => {
        for (const watcher of watchers) watcher.value = watcher.read();
        for (const effect of effects) runEffect(effect);
      });
    },
    stop() {
      if (!isStarted) return;
      isStarted = false;
      const list = cleanups;
      cleanups = [];
      store.batch(() => {
        for (let index = list.length - 1; index >= 0; index--) list[index]!();
      });
    },
    isStarted: () => isStarted,
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    getState() {
      if (
        exposed?.changes !== changes ||
        exposed.propsVersion !== propsVersion
      ) {
        exposed = { changes, propsVersion, state: definition.expose(view) };
      }
      return exposed.state;
    },
    connect() {
      if (
        connected?.changes === changes &&
        connected.propsVersion === propsVersion
      ) {
        return connected.parts;
      }
      const raw = definition.connect(view) as Record<string, PartProps>;
      const parts: Record<string, PartProps> = {};
      for (const part of definition.parts) {
        const { attrs, on, style } = raw[part]!;
        parts[part] = {
          attrs: { ...attrs, 'data-scope': definition.name, 'data-part': part },
          ...(on ? { on: batched(on) } : {}),
          ...(style ? { style } : {}),
        };
      }
      connected = { changes, propsVersion, parts };
      return parts;
    },
    attach(part, element) {
      if (element == null) elements.delete(part);
      else elements.set(part, element);
    },
    element: (part) => elements.get(part) ?? null,
    batch: store.batch,
  };
  return instance as unknown as Instance<D>;
}
