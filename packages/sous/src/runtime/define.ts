/**
 * `defineComponent` (design decision 9): a component is one definition, and
 * both adapters are generic over it.
 *
 * - `parts` — the named parts the component exposes.
 * - `props` / `events` — the schema (`./schema`).
 * - `setup(ctx)` — runs once per instance; returns the actions and readers
 *   `expose()` and `connect()` use, available to consumers as `api`.
 * - `expose()` — the public state selectors read. It is public API.
 * - `connect()` — a pure function from current state to part props, re-run
 *   after every flush, so keep it cheap.
 * - `owner` — for a component that works inside another instance, such as a
 *   checkbox in its group (decision 11): `ctx.owner()` reads that instance.
 */

import type {
  BindableSpec,
  EventSpec,
  EventsSchema,
  PropSpec,
  PropsSchema,
  ResolvedSchema,
  StateName,
} from './schema';
import { capitalize, resolveSchema } from './schema';
import type { Instance } from './instance';

/**
 * A handler on a part. The runtime is DOM-free, so the event type is left
 * open: `dom/` types handlers with real DOM events, and adapters call them
 * with the native event.
 */
export type PartHandler = (event: never) => void;

/** Framework-neutral props for one part (root AGENTS.md → Part props). */
export interface PartProps {
  /** ARIA values are strings; `undefined` removes the attribute. */
  readonly attrs: Readonly<Record<string, string | undefined>>;
  /** Handlers keyed by DOM event name: `click`, `keydown`, `focusin`. */
  readonly on?: Readonly<Record<string, PartHandler | undefined>>;
  /** CSS custom properties only. */
  readonly style?: Readonly<Record<`--${string}`, string | undefined>>;
  /**
   * Live DOM properties no attribute holds once the user acts: an input's
   * `value`, a checkbox's `checked` and `indeterminate`. The binder sets each
   * when it differs from the element; `undefined` leaves it alone. React
   * renders `value` and `checked` once, as `defaultValue` and
   * `defaultChecked`, so it never controls the element.
   */
  readonly properties?: Readonly<
    Record<string, string | number | boolean | undefined>
  >;
}

/** Host objects the component may need, supplied by the adapter. */
export interface Env {
  /** The document the instance lives in, when the adapter knows it. */
  readonly document?: unknown;
}

/** A piece of internal state: `ctx.state(initial)`. */
export interface Cell<T> {
  get(): T;
  /** Notifies the store when the value changes (`Object.is`). */
  set(value: T): void;
}

/** A bindable prop as `setup()` sees it (design decision 1). */
export interface Bindable<T> {
  get(): T;
  /**
   * Requests a change. Uncontrolled: commits it and notifies. Controlled:
   * only calls the change callback; the value changes when props do.
   */
  set(value: T): void;
  isControlled(): boolean;
}

type ValueOf<Spec> =
  Spec extends BindableSpec<infer T, infer _Event>
    ? T
    : Spec extends PropSpec<infer T>
      ? T
      : never;

type DetailOf<Spec> = Spec extends EventSpec<infer Detail> ? Detail : never;

type ChangeEventOf<Key extends string, Spec> =
  Spec extends BindableSpec<infer _T, infer Event>
    ? Event extends string
      ? Event
      : `${StateName<Key>}Change`
    : never;

/** How definitions read props: a getter per prop, a `Bindable` per bindable. */
export type PropReaders<P extends PropsSchema> = {
  readonly [K in keyof P]: P[K] extends BindableSpec<infer T, infer _Event>
    ? Bindable<T>
    : P[K] extends PropSpec<infer T>
      ? () => T
      : never;
};

/** The props adapters accept for a definition's schema. */
export type InputProps<P extends PropsSchema, E extends EventsSchema> = {
  readonly [K in keyof P & string]?: ValueOf<P[K]>;
} & {
  readonly [
    K in keyof P & string as P[K] extends BindableSpec<infer _T, infer _Event>
      ? `default${Capitalize<StateName<K>>}`
      : never
  ]?: ValueOf<P[K]>;
} & {
  readonly [
    K in keyof P & string as P[K] extends BindableSpec<infer _T, infer _Event>
      ? `on${Capitalize<ChangeEventOf<K, P[K]>>}`
      : never
  ]?: (value: ValueOf<P[K]>) => void;
} & {
  readonly [K in keyof E & string as `on${Capitalize<K>}`]?: (
    detail: DetailOf<E[K]>,
  ) => void;
};

export interface SetupContext<
  Part extends string,
  P extends PropsSchema,
  E extends EventsSchema,
> {
  readonly props: PropReaders<P>;
  /** Stable ids per part, from the adapter (`useId` in React). */
  readonly ids: Readonly<Record<Part, string>>;
  readonly env: Env;
  /** Internal state. Setting it notifies the store. */
  state<T>(initial: T): Cell<T>;
  /** A derived value, recomputed only when a dependency changes (`Object.is`). */
  memo<const D extends readonly unknown[], T>(
    deps: () => D,
    compute: (...deps: D) => T,
  ): () => T;
  /** Runs on `start()`; the returned cleanup runs on `stop()`. Never on the server. */
  effect(effect: () => void | (() => void)): void;
  /**
   * Calls `callback` when `read()` changes, compared with `Object.is` after
   * each flush. Active only between `start()` and `stop()`.
   */
  watch<T>(read: () => T, callback: (value: T, previous: T) => void): void;
  /** Reports an event: calls the consumer's `on<Name>` callback. */
  emit<K extends keyof E & string>(name: K, detail: DetailOf<E[K]>): void;
  /**
   * The element registered for a part, or `null`. Opaque here: `dom/`
   * helpers type it.
   */
  element(part: Part): unknown;
  /** Groups changes so the store flushes once. */
  batch<T>(fn: () => T): T;
  /**
   * Composes another definition into this instance (decision 9): its
   * `setup()` runs here, on this instance's store and lifecycle, and reads
   * its props from `props()` on every access, so pass this component's props
   * and callbacks through. Its parts are this component's parts of the same
   * name, unless `options.parts` maps them. Call it during `setup()`, and
   * fold what it returns into `expose()` and `connect()`.
   */
  use<D extends AnyDefinition>(
    definition: D,
    props: () => NoInfer<PropsOf<D>>,
    options?: ComposeOptions<NoInfer<PartOf<D>>, Part>,
  ): Composed<D>;
  /**
   * The instance of `definition` this one works inside (decision 11), or
   * `undefined` until the adapter finds it: the `owner` prop, else the
   * adapter's link. Read it where it is used (`connect()`, `expose()`, a
   * watch): while started, the owner's changes re-run them.
   */
  owner<D extends AnyDefinition>(definition: D): Owned<D> | undefined;
}

export interface ComposeOptions<Inner extends string, Outer extends string> {
  /** This component's part for each of the composed one's; same name by default. */
  readonly parts?: Readonly<Partial<Record<Inner, Outer>>>;
}

/** A definition composed with `ctx.use()`. */
export interface Composed<D extends AnyDefinition> {
  /** What its `setup()` returned. */
  readonly api: ApiOf<D>;
  /** Its `expose()` now. */
  state(): StateOf<D>;
  /** Its `connect()` now, keyed by its own part names, without data-scope. */
  connect(): ConnectedParts<PartOf<D>>;
}

/** What `expose()` and `connect()` read. */
export interface ViewContext<Part extends string, P extends PropsSchema, Api> {
  readonly props: PropReaders<P>;
  readonly ids: Readonly<Record<Part, string>>;
  readonly api: Api;
}

export type ConnectedParts<Part extends string> = Readonly<
  Record<Part, PartProps>
>;

export interface ComponentConfig<
  Part extends string,
  P extends PropsSchema,
  E extends EventsSchema,
  Api,
  State,
> {
  /** kebab-case; becomes `data-scope` and the element name. */
  readonly name: string;
  readonly parts: readonly Part[];
  readonly props: P;
  readonly events?: E;
  /** The instance this component works inside, when it has one. */
  readonly owner?: OwnerLink;
  setup(ctx: SetupContext<Part, P, E>): Api;
  expose(ctx: ViewContext<Part, P, Api>): State;
  connect(ctx: ViewContext<Part, P, Api>): ConnectedParts<Part>;
}

export interface Definition<
  Part extends string = string,
  P extends PropsSchema = PropsSchema,
  E extends EventsSchema = EventsSchema,
  Api = unknown,
  State = unknown,
> extends ComponentConfig<Part, P, E, Api, State> {
  readonly events: E;
  /** The schema resolved for adapters: attributes, types, events. */
  readonly schema: ResolvedSchema;
}

// Generic code (adapters, the instance) accepts definitions of any shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDefinition = Definition<string, any, any, any, any>;

// Read from the definition's members rather than inferred through its
// generics: methods mention every type parameter, which muddies inference.
export type PartOf<D extends AnyDefinition> = D['parts'][number];
export type ApiOf<D extends AnyDefinition> = ReturnType<D['setup']>;
export type StateOf<D extends AnyDefinition> = ReturnType<D['expose']>;
export type PropsOf<D extends AnyDefinition> = InputProps<
  D['props'],
  D['events']
> &
  OwnerProps<D>;

/** An owned component takes its owner instance as the `owner` prop. */
type OwnerProps<D extends AnyDefinition> = [NonNullable<D['owner']>] extends [
  never,
]
  ? unknown
  : NonNullable<D['owner']> extends OwnerLink<infer O>
    ? { readonly owner?: Instance<O> }
    : unknown;

/**
 * How a component finds its owner (decision 11): the owner's definition, and
 * the element attribute that names the owner's host by id.
 */
export interface OwnerLink<D extends AnyDefinition = AnyDefinition> {
  readonly definition: D;
  /** `group`: `<sous-checkbox group="plan">`. */
  readonly attribute: string;
}

/** The owner as `ctx.owner()` returns it. */
export interface Owned<D extends AnyDefinition> {
  readonly instance: Instance<D>;
  /** What the owner's `setup()` returned. */
  readonly api: ApiOf<D>;
  /** The owner's `expose()` now. */
  state(): StateOf<D>;
}

const owners = new WeakSet<AnyDefinition>();

/**
 * Whether a defined component names `definition` as its owner, so adapters
 * answer owner lookups only for instances that can be owners.
 */
export function isOwnerDefinition(definition: AnyDefinition): boolean {
  return owners.has(definition);
}

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineComponent<
  const Part extends string,
  P extends PropsSchema,
  Api,
  State,
  E extends EventsSchema = Record<never, EventSpec<unknown>>,
  O extends OwnerLink | undefined = undefined,
>(
  config: ComponentConfig<Part, P, E, Api, State> & { readonly owner?: O },
): Definition<Part, P, E, Api, State> & { readonly owner: O } {
  if (!NAME.test(config.name)) {
    throw new Error(
      `[sous] Component name "${config.name}" must be kebab-case.`,
    );
  }
  const events = config.events ?? ({} as E);
  const schema = resolveSchema(config.props, events);
  const seen = new Set<string>();
  const callback = (name: string) => {
    if (seen.has(name)) {
      throw new Error(
        `[sous] ${config.name}: "${name}" is defined twice by its props and events.`,
      );
    }
    seen.add(name);
  };
  for (const info of schema.props) {
    callback(info.key);
    if (info.defaultKey) callback(info.defaultKey);
  }
  for (const name of schema.events) callback(`on${capitalize(name)}`);
  if (config.owner) {
    callback('owner');
    owners.add(config.owner.definition);
  }
  return { ...config, events, schema } as Definition<Part, P, E, Api, State> & {
    readonly owner: O;
  };
}
