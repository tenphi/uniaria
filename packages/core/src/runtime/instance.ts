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
  ActionsOf,
  AnyDefinition,
  ApiOf,
  Bindable,
  BindableKeyOf,
  Cell,
  ConnectedParts,
  Env,
  ItemPartOf,
  LinkKey,
  Owned,
  PartHandler,
  PartOf,
  PartProps,
  PropsOf,
  ResetOptions,
  SetupContext,
  StateOf,
  ViewContext,
} from './define';
import { partMarker } from './define';
import type { BindableSpec, EventsSchema, PropsSchema } from './schema';
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
  /**
   * Each part's id now: the id the consumer gave its element (`adoptId()`),
   * else the prop that names it (`idOf`, such as Field's `controlId`), else
   * `<id>-<part>`.
   */
  readonly ids: Readonly<Record<PartOf<D>, string>>;
  /**
   * Internal: what `setup()` returned, for composing definitions, owned
   * components, adapters and tests. Consumers call `actions` and read
   * `getState()` instead.
   */
  readonly api: ApiOf<D>;
  /**
   * The definition's public actions (its `actions`), such as an overlay's
   * `open()` and `close()`. Each runs in a batch, so it notifies once.
   */
  readonly actions: ActionsOf<D>;
  getProps(): PropsOf<D>;
  /**
   * The current value of the bindable `key`: the consumer's while
   * controlled, else the instance's own, as `setup()` reads it. A custom
   * element's property reads it, like a native input's `value`.
   */
  getValue<K extends BindableKeyOf<D>>(
    key: K,
  ): D['props'][K] extends BindableSpec<infer T, infer _Event> ? T : never;
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
   * the part markers added (the root's `data-uni`, an outside part's
   * `data-uni-part`, every other part's `data-element`) and every handler
   * run in a batch.
   */
  connect(): ConnectedParts<PartOf<D>>;
  /**
   * Registers the element for a part (`null` removes it). While started, a
   * different element counts as a state change, so watchers see it: a
   * custom element's parts can arrive after it connects.
   */
  attach(part: PartOf<D>, element: unknown): void;
  element(part: PartOf<D>): unknown;
  /**
   * Keeps the id the consumer gave a part's element (owner, 2026-10-19), so
   * `ids` and every reference to the part follow it; `undefined`, or the id
   * the part has anyway, gives the part back its own. The DOM binder calls
   * it as an element attaches and when its id changes. It counts as a
   * change of state, and notifies even before `start()`: an instance that
   * reads the id may follow this one already. Item ids made from it are
   * written again.
   */
  adoptId(part: PartOf<D>, id: string | undefined): void;
  /**
   * Props for one item part of one item from the definition's
   * `connectItem()`, with `data-element` added and every
   * handler run in a batch; cached per part and key until the key is
   * invalidated (`ctx.invalidateItems()`, a change of props, or one of the
   * key's item parts attached or detached). A key whose last element
   * detaches drops its cache, so a long list scrolled end to end keeps
   * entries only for the rows rendered.
   */
  connectItem(part: ItemPartOf<D>, key: string): PartProps;
  /**
   * Registers (or with `null`, removes) the element for an item part. While
   * started it counts as a change of state, so `connect()` runs again for
   * named parts that refer to an item (an input's active descendant), and
   * the definition's item effects run for it.
   */
  attachItem(part: ItemPartOf<D>, key: string, element: unknown): void;
  itemElement(part: ItemPartOf<D>, key: string): unknown;
  /**
   * Calls `listener` with the keys of items invalidated, or `null` when
   * every item was, so the binder rewrites only those after the flush.
   */
  subscribeItems(
    listener: (keys: readonly string[] | null) => void,
  ): () => void;
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

/** `ctx.itemEffect()`: its part, and the cleanup per key it ran for. */
interface ItemEffect {
  readonly part: string;
  readonly effect: (key: string, element: unknown) => void | (() => void);
  readonly cleanups: Map<string, () => void>;
}

type Callback = ((value: unknown) => void) | undefined;

let counter = 0;

/** Each part a prop names the id of (`idOf`), with that prop. */
function idProps(definition: AnyDefinition): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const info of definition.schema.props) {
    if (info.idOf !== undefined) result.set(info.idOf, info.key);
  }
  return result;
}

/** The id `values` give `part` through its `idOf` prop, if set. */
function idFrom(
  keys: ReadonlyMap<string, string>,
  values: Readonly<Record<string, unknown>>,
  part: string,
): string | undefined {
  const key = keys.get(part);
  const value = key === undefined ? undefined : values[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

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
  // Item parts: elements per part and key, and connectItem() results cached
  // per part and key until every item (`allVersion`) or the key is
  // invalidated.
  const itemElements = new Map<string, Map<string, unknown>>();
  const itemCache = new Map<
    string,
    { all: number; key: number; props: PartProps }
  >();
  const keyVersions = new Map<string, number>();
  let allVersion = 0;
  const itemListeners = new Set<(keys: readonly string[] | null) => void>();
  const markItems = (keys: readonly string[] | null) => {
    if (keys === null) allVersion++;
    else {
      for (const key of keys) {
        keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
      }
    }
    for (const listener of Array.from(itemListeners)) listener(keys);
  };
  // Not a change of state: connect() and expose() stay cached, and the
  // flush only lets the binder write the items.
  const invalidateItems = (keys?: Iterable<string>) => {
    if (!definition.itemParts) return;
    const list = keys === undefined ? null : Array.from(keys);
    if (list?.length === 0) return;
    markItems(list);
    store.notify();
  };
  let props = (options.props ?? {}) as Readonly<Record<string, unknown>>;
  let propsVersion = 0;
  let hasUnsyncedProps = false;
  let isStarted = false;
  const id = options.id ?? `uni-${++counter}`;
  // Part ids (root AGENTS.md → DOM, lifecycle and SSR): the consumer's id on
  // the element, else the prop that names it, else one made from `id`.
  const adoptedIds = new Map<string, string>();
  const ownIdProps = idProps(definition);
  /** The id a part has without the consumer's. */
  const ownId = (part: string) =>
    idFrom(ownIdProps, props, part) ?? `${id}-${part}`;
  const ids: Record<string, string> = {};
  for (const part of definition.parts) {
    Object.defineProperty(ids, part, {
      enumerable: true,
      get: () => adoptedIds.get(part) ?? ownId(part),
    });
  }
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

  const itemEffects: ItemEffect[] = [];
  /** Ends an item effect's run for `key`, then starts one for `element`. */
  const runItemEffect = (entry: ItemEffect, key: string, element: unknown) => {
    const cleanup = entry.cleanups.get(key);
    entry.cleanups.delete(key);
    cleanup?.();
    if (element == null) return;
    const next = entry.effect(key, element);
    if (typeof next === 'function') entry.cleanups.set(key, next);
  };
  const runItemEffects = (entry: ItemEffect) => {
    for (const [key, element] of itemElements.get(entry.part) ?? []) {
      runItemEffect(entry, key, element);
    }
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

  /** A definition's public actions on `api`, each run in a batch. */
  const actionsOf = (scoped: AnyDefinition, api: unknown) => {
    const result: Record<string, (...args: unknown[]) => unknown> = {};
    for (const name of scoped.actions ?? []) {
      const action = (api as Record<string, unknown>)[name];
      if (typeof action !== 'function') {
        throw new Error(
          `[uniaria] ${scoped.name}: action "${name}" is not a function setup() returns.`,
        );
      }
      result[name] = (...args) => store.batch(() => action(...args));
    }
    return result;
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
      // (an element's attribute after construction) still seeds the value,
      // and again after a reset.
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
        reset({
          fallback,
          readDefault = (value) => value,
          isEqual = Object.is,
          beforeReport,
        }: ResetOptions<unknown> = {}) {
          const isControlledNow = isControlled();
          // A composed definition's controlled value is its composer's, and
          // the composer resets it (composition spec, Runtime changes 4).
          if (isControlledNow && scoped !== definition) return get();
          // A null default reads as none, as in `get()`.
          const own = readProps()[defaultKey] ?? undefined;
          const previous =
            isControlledNow || isDirty ? get() : readDefault(get());
          const next =
            own !== undefined
              ? readDefault(own)
              : isControlledNow && fallback !== undefined
                ? fallback
                : readDefault(defaultValue);
          return store.batch(() => {
            if (!isControlledNow && isDirty) {
              isDirty = false;
              inner = undefined;
              changed();
            }
            if (!isEqual(previous, next)) {
              beforeReport?.(next);
              (readProps()[onChange] as Callback)?.(next);
            }
            return next;
          });
        },
      };
    }

    // A composed definition's ids are its parts' here, its own `idOf`
    // props coming after the consumer's id and before the outer's.
    const scopedIdProps = idProps(scoped);
    const scopedIds: Record<string, string> = {};
    for (const part of scoped.parts) {
      const own = partOf(part);
      Object.defineProperty(scopedIds, part, {
        enumerable: true,
        get: () =>
          // A part left out still gets an id of its own, which nothing
          // renders.
          own === null
            ? `${id}-${scoped.name}-${part}`
            : (adoptedIds.get(own) ??
              (scoped === definition
                ? undefined
                : idFrom(scopedIdProps, readProps(), part)) ??
              ids[own]!),
      });
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
      itemElement: (part, key) => itemElements.get(part)?.get(key) ?? null,
      itemEffect(part, effect) {
        const entry: ItemEffect = { part, effect, cleanups: new Map() };
        itemEffects.push(entry);
        if (isStarted) store.batch(() => runItemEffects(entry));
      },
      invalidateItems,
      batch: store.batch,
      afterFlush: store.afterFlush,
      owner(ownerDefinition) {
        const owner = currentOwner();
        return owner?.definition === ownerDefinition
          ? (handleOf(owner) as never)
          : undefined;
      },
      link(key) {
        // Links are the instance's own: a composed definition, such as the
        // Button in a Popover's trigger, never takes one.
        if (scoped !== definition) return undefined;
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
          actions: actionsOf(child, composed.api),
          state: () => child.expose(composed.view),
          connect: () => child.connect(composed.view),
          connectItem: (part: string, key: string) =>
            child.connectItem!(composed.view, part, key),
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

  // Part markers (root AGENTS.md): `data-uni` on the root, `data-uni-part`
  // on each part outside it, `data-element` on every other part.
  const outside = new Set<string>(definition.outsideParts ?? []);
  const marked = (part: string, attrs: PartProps['attrs']) => {
    const [attribute, value] = partMarker(
      definition.name,
      part,
      outside.has(part),
    );
    return { ...attrs, [attribute]: value };
  };

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

  const actions = actionsOf(definition, api);

  const instance: Instance<AnyDefinition> = {
    definition,
    id,
    ids,
    api,
    actions,
    getProps: () => props as never,
    getValue(key) {
      // Plain props read as functions, bindables as objects.
      const reader = (view.props as Record<string, unknown>)[key];
      if (typeof reader !== 'object' || reader === null) {
        throw new Error(
          `[uniaria] ${definition.name}: "${key}" is not a bindable.`,
        );
      }
      return (reader as Bindable<never>).get();
    },
    setProps(next) {
      const previous = props;
      props = next as Readonly<Record<string, unknown>>;
      if (havePropsChanged(previous, props)) {
        propsVersion++;
        hasUnsyncedProps = true;
        if (definition.itemParts) markItems(null);
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
      // What connect() and expose() read from an owner or a linked instance
      // may have changed while this one didn't follow it (an id it adopted
      // as its elements attached), so their caches go.
      if (following.size > 0) changes++;
      store.batch(() => {
        for (const watcher of watchers) watcher.value = watcher.read();
        for (const effect of effects) runEffect(effect);
        for (const entry of itemEffects) runItemEffects(entry);
      });
    },
    stop() {
      if (!isStarted) return;
      isStarted = false;
      follow();
      const list = cleanups;
      cleanups = [];
      store.batch(() => {
        for (const entry of itemEffects) {
          for (const key of Array.from(entry.cleanups.keys())) {
            runItemEffect(entry, key, null);
          }
        }
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
          attrs: marked(part, attrs),
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
    adoptId(part, value) {
      const next =
        value === undefined || value === '' || value === ownId(part)
          ? undefined
          : value;
      if (adoptedIds.get(part) === next) return;
      if (next === undefined) adoptedIds.delete(part);
      else adoptedIds.set(part, next);
      // Item ids may be made from it (Listbox's from the list's).
      if (definition.itemParts) markItems(null);
      // Even before start: an instance that reads these ids (a radio its
      // group's error, a button its tooltip's root) may already follow it.
      changed();
    },
    connectItem(part, key) {
      const id = `${part}\n${key}`;
      const version = keyVersions.get(key) ?? 0;
      const cached = itemCache.get(id);
      if (cached?.all === allVersion && cached.key === version) {
        return cached.props;
      }
      const raw = definition.connectItem!(view, part, key);
      const { attrs, on, style, properties } = raw;
      const result: PartProps = {
        attrs: marked(part, attrs),
        ...(on ? { on: batched(on) } : {}),
        ...(style ? { style } : {}),
        ...(properties ? { properties } : {}),
      };
      itemCache.set(id, { all: allVersion, key: version, props: result });
      return result;
    },
    attachItem(part, key, element) {
      let byKey = itemElements.get(part);
      if ((byKey?.get(key) ?? null) === (element ?? null)) return;
      if (element == null) {
        byKey?.delete(key);
        itemCache.delete(`${part}\n${key}`);
      } else {
        if (!byKey) itemElements.set(part, (byKey = new Map()));
        byKey.set(key, element);
      }
      // The key's other parts may point at this one (an option at its
      // label), so all of them are written again.
      markItems([key]);
      // A key no part renders any more drops its cached props and version
      // together, so a later version can't match a stale entry.
      if (
        element == null &&
        definition.itemParts!.every((each) => !itemElements.get(each)?.has(key))
      ) {
        keyVersions.delete(key);
        for (const each of definition.itemParts!) {
          itemCache.delete(`${each}\n${key}`);
        }
      }
      if (!isStarted) return;
      store.batch(() => {
        for (const entry of itemEffects) {
          if (entry.part === part) runItemEffect(entry, key, element);
        }
        changed();
      });
    },
    itemElement: (part, key) => itemElements.get(part)?.get(key) ?? null,
    subscribeItems(listener) {
      itemListeners.add(listener);
      return () => {
        itemListeners.delete(listener);
      };
    },
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
      if (definition.itemParts) markItems(null);
    },
    owner: currentOwner,
    linked: currentLink,
  };
  return instance as unknown as Instance<D>;
}
