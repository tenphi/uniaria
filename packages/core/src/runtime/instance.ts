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
  LinkKey,
  Owned,
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
  /**
   * Registers the element for a part (`null` removes it). While started, a
   * different element counts as a state change, so watchers see it: a
   * custom element's parts can arrive after it connects.
   */
  attach(part: PartOf<D>, element: unknown): void;
  element(part: PartOf<D>): unknown;
  batch<T>(fn: () => T): T;
  /**
   * Links the instance this one works inside, found by the adapter (React
   * context, the DOM), or `undefined` to unlink. With `key`, one of the
   * definition's `links`, links that instead. Silent like `setProps()`: call
   * `sync()` after it. The `owner` prop, or the key's, wins over the link.
   */
  link(owner: Instance | undefined, key?: LinkKey): void;
  /** The owner now: the `owner` prop, else the link. */
  owner(): Instance | undefined;
  /** The instance linked by `key` now: the key's prop, else the link. */
  linked(key: LinkKey): Instance | undefined;
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
  const id = options.id ?? `uni-${++counter}`;
  const ids: Record<string, string> = {};
  for (const part of definition.parts) ids[part] = `${id}-${part}`;
  const elements = new Map<string, unknown>();
  let linked: Instance | undefined;
  const currentOwner = () => (props.owner as Instance | undefined) ?? linked;
  const linkedByKey = new Map<LinkKey, Instance>();
  const currentLink = (key: LinkKey) =>
    (props[key.name] as Instance | undefined) ?? linkedByKey.get(key);
  // One handle per owner, so `ctx.owner()` is stable while it is the same.
  const handles = new WeakMap<Instance, Owned<AnyDefinition>>();
  const handleOf = (owner: Instance): Owned<AnyDefinition> => {
    let handle = handles.get(owner);
    if (!handle) {
      handle = {
        instance: owner,
        api: owner.api,
        state: () => owner.getState(),
      };
      handles.set(owner, handle);
    }
    return handle;
  };
  // While started, the owner's and linked instances' changes count as this
  // instance's, so the binder re-runs connect() and watchers see them;
  // nothing renders.
  const following = new Map<Instance, () => void>();
  const follow = () => {
    const next = new Set<Instance>();
    if (isStarted) {
      const owner = currentOwner();
      if (owner) next.add(owner);
      for (const key of definition.links ?? []) {
        const target = currentLink(key);
        if (target) next.add(target);
      }
    }
    for (const [target, stop] of following) {
      if (next.has(target)) continue;
      stop();
      following.delete(target);
    }
    for (const target of next) {
      if (!following.has(target)) {
        following.set(
          target,
          target.subscribe(() => changed()),
        );
      }
    }
  };
  const watchers: Watcher[] = [];
  const effects: (() => void | (() => void))[] = [];
  let cleanups: (() => void)[] = [];

  const runEffect = (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  };

  const state = <T>(initial: T): Cell<T> => {
    let value = initial;
    return {
      get: () => value,
      set(next) {
        if (Object.is(next, value)) return;
        value = next;
        changed();
      },
    };
  };

  const memo: SetupContext<string, PropsSchema, EventsSchema>['memo'] = (
    deps,
    compute,
  ) => {
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
  };

  /**
   * Runs one definition's `setup()` against this instance: the component
   * itself, or one it composes with `ctx.use()`. `readProps` returns its
   * props, and `partOf` names this instance's part for each of its parts,
   * or `null` for a part left out.
   */
  const scope = (
    scoped: AnyDefinition,
    readProps: () => Readonly<Record<string, unknown>>,
    partOf: (part: string) => string | null,
  ): { api: unknown; view: ViewContext<string, PropsSchema, unknown> } => {
    const readers: Record<string, (() => unknown) | Bindable<unknown>> = {};
    for (const info of scoped.schema.props) {
      const { key, defaultValue } = info;
      if (info.kind === 'prop') {
        readers[key] = () => readProps()[key] ?? defaultValue;
        continue;
      }
      // Like a form control's value attribute, the default applies until the
      // first uncontrolled change ("dirty"), so a default that arrives late
      // (an element's attribute after construction) still seeds the value.
      const defaultKey = info.defaultKey!;
      let isDirty = false;
      let inner: unknown;
      const onChange = callbackName(info.changeEvent!);
      const isControlled = () => readProps()[key] !== undefined;
      const get = () => {
        if (isControlled()) return readProps()[key];
        if (isDirty) return inner;
        return readProps()[defaultKey] ?? defaultValue;
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
            (readProps()[onChange] as Callback)?.(value);
          });
        },
      };
    }

    const scopedIds: Record<string, string> = {};
    for (const part of scoped.parts) {
      const own = partOf(part);
      // A part left out still gets an id of its own, which nothing renders.
      scopedIds[part] =
        own === null ? `${id}-${scoped.name}-${part}` : ids[own]!;
    }

    // The readers match the schema by construction; the generic types can't
    // see that, so they are cast once here.
    const ctx: SetupContext<string, PropsSchema, EventsSchema> = {
      props: readers as never,
      ids: scopedIds,
      env: options.env ?? {},
      state,
      memo,
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
        (readProps()[callbackName(name)] as Callback)?.(detail);
      },
      element: (part) => {
        const own = partOf(part);
        return own === null ? null : (elements.get(own) ?? null);
      },
      batch: store.batch,
      owner(ownerDefinition) {
        const owner = currentOwner();
        return owner?.definition === ownerDefinition
          ? (handleOf(owner) as never)
          : undefined;
      },
      link(key) {
        const target = currentLink(key);
        return target?.definition.provides?.includes(key)
          ? (handleOf(target) as never)
          : undefined;
      },
      use(child, childProps, composeOptions) {
        const map: Readonly<Record<string, string | null | undefined>> =
          composeOptions?.parts ?? {};
        for (const part of child.parts) {
          const own = map[part] === null ? null : (map[part] ?? part);
          if (own !== null && !scoped.parts.includes(own)) {
            throw new Error(
              `[uniaria] ${scoped.name} composes ${child.name}, whose "${part}" part has no "${own}" part to render on.`,
            );
          }
        }
        const composed = scope(
          child,
          childProps as () => Readonly<Record<string, unknown>>,
          (part) => {
            const own = map[part];
            return own === null ? null : partOf(own ?? part);
          },
        );
        return {
          api: composed.api,
          state: () => child.expose(composed.view),
          connect: () => child.connect(composed.view),
        } as never;
      },
    };

    const api = scoped.setup(ctx);
    return { api, view: { props: readers as never, ids: scopedIds, api } };
  };

  const { api, view } = scope(
    definition,
    () => props,
    (part) => part,
  );

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
      follow();
      store.notify();
    },
    start() {
      if (isStarted) return;
      isStarted = true;
      follow();
      store.batch(() => {
        for (const watcher of watchers) watcher.value = watcher.read();
        for (const effect of effects) runEffect(effect);
      });
    },
    stop() {
      if (!isStarted) return;
      isStarted = false;
      follow();
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
        const { attrs, on, style, properties } = raw[part]!;
        parts[part] = {
          attrs: { ...attrs, 'data-scope': definition.name, 'data-part': part },
          ...(on ? { on: batched(on) } : {}),
          ...(style ? { style } : {}),
          ...(properties ? { properties } : {}),
        };
      }
      connected = { changes, propsVersion, parts };
      return parts;
    },
    attach(part, element) {
      if ((elements.get(part) ?? null) === (element ?? null)) return;
      if (element == null) elements.delete(part);
      else elements.set(part, element);
      if (isStarted) changed();
    },
    element: (part) => elements.get(part) ?? null,
    batch: store.batch,
    link(owner, key) {
      const previous = key ? linkedByKey.get(key) : linked;
      if (owner === previous) return;
      if (!key) linked = owner;
      else if (owner) linkedByKey.set(key, owner);
      else linkedByKey.delete(key);
      // A new owner changes what connect() and expose() return.
      propsVersion++;
      hasUnsyncedProps = true;
    },
    owner: currentOwner,
    linked: currentLink,
  };
  return instance as unknown as Instance<D>;
}
