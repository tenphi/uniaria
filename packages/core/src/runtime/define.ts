/**
 * `defineBehavior` (design decision 9): a component's behavior is one
 * definition, and every adapter is generic over it. The name says behavior
 * because a definition renders nothing; the framework component that uses it
 * does.
 *
 * - `parts` — the named parts the component exposes; `outsideParts` — those
 *   rendered outside the root, as an overlay's trigger is.
 * - `props` / `events` — the schema (`./schema`).
 * - `setup(ctx)` — runs once per instance; returns the definition's internal
 *   API (`api`): the actions and readers `expose()`, `connect()`, composing
 *   definitions and owned components use. Consumers never call it.
 * - `actions` — the members of `api` consumers may call, such as an
 *   overlay's `open` and `close` (owner, 2026-10-19). They are public API.
 * - `expose()` — the public state selectors read. It is public API.
 * - `connect()` — a pure function from current state to part props, re-run
 *   after every flush, so keep it cheap.
 * - `owner` — for a component that works inside another instance, such as a
 *   checkbox in its group (decision 11): `ctx.owner()` reads that instance.
 * - `links` / `provides` — links named by a small key rather than a
 *   definition, such as a button's link to its tooltip (Tooltip spec,
 *   Resolved questions 2): `ctx.link()` reads the linked instance.
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
import { capitalize, kebabCase, resolveSchema } from './schema';
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
  /**
   * CSS custom properties, and the kebab-case properties a definition lays
   * its parts out with (a virtualized list's rows: `position`, `translate`).
   * `undefined` removes one.
   */
  readonly style?: Readonly<Record<string, string | undefined>>;
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

/**
 * The attribute and value that mark a part of the component `name` (root
 * AGENTS.md → Part markers): the root `data-uni="<name>"`, a part outside
 * the root `data-uni-part="<name>-<part>"` (`dialog-trigger`, `hiddenInput`
 * → `hidden-input`), any other part `data-element` with its name
 * capitalized, as Tasty names a sub-element. A custom element finds its
 * parts by them, so its markup has them already.
 */
export function partMarker(
  name: string,
  part: string,
  isOutside = false,
): readonly [attribute: string, value: string] {
  if (part === 'root') return ['data-uni', name];
  if (isOutside) return ['data-uni-part', `${name}-${kebabCase(part)}`];
  return ['data-element', partElement(part)];
}

/**
 * The `data-element` that marks every other part, as Tasty names a
 * sub-element: `trigger` → `Trigger` (root AGENTS.md → Part markers).
 */
export function partElement(part: string): string {
  return capitalize(part);
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

/**
 * A bindable prop as `setup()` sees it (design decision 1). Like a form
 * control's value: while uncontrolled, `default<Name>` applies until the
 * first change, and `reset()` makes it apply again.
 */
export interface Bindable<T> {
  get(): T;
  /**
   * Requests a change. Uncontrolled: commits it and notifies. Controlled:
   * only calls the change callback; the value changes when props do.
   */
  set(value: T): void;
  isControlled(): boolean;
  /**
   * Puts the value back as a form's reset does a control's (owner,
   * 2026-10-19), and returns the value it goes back to. Uncontrolled, the
   * value follows `default<Name>` again, as before its first change, so a
   * default set later still applies. Controlled, it only asks for
   * `default<Name>`, or without one `options.fallback`. Either way the
   * change callback gets the value it goes back to, unless that is the
   * value now. In a definition composed with `ctx.use()`, a controlled value
   * is the composer's, which resets it, so this returns the value now and
   * does nothing (composition spec, Runtime changes 4).
   */
  reset(options?: ResetOptions<T>): T;
  /**
   * The consumer's `default<Name>`, or `undefined` without one: never the
   * schema's default. A field registers it with its form (Form spec,
   * Defaults).
   */
  getDefault(): T | undefined;
  /**
   * Reads and writes the value through the source `source()` returns, read
   * on every access, while it returns one (Form spec, Runtime changes 2):
   * the value is controlled, `set()` writes the source and then calls the
   * change callback, and `reset()` returns the value and does nothing. With
   * `null` the props hold the value again. A later call replaces `source`.
   */
  bind(source: () => BindableSource<T> | null): void;
}

/** Where a bound bindable reads and writes its value (`Bindable.bind()`). */
export interface BindableSource<T> {
  get(): T;
  set(value: T): void;
}

/** How `Bindable.reset()` puts a value back. */
export interface ResetOptions<T> {
  /**
   * What a controlled value without `default<Name>` goes back to: the value
   * the component mounted with. Without it, the schema's default.
   */
  readonly fallback?: T;
  /**
   * How the component reads a default (`default<Name>` or the schema's),
   * when it reads one otherwise than as it is: NumberField parses text
   * adopted from the markup, and a group without a default takes the values
   * its controls adopted. Applied to the value the reset goes back to, and
   * to the value now while it is still the default.
   */
  readonly readDefault?: (value: T) => T;
  /** Whether two values are the same, so nothing is reported. `Object.is` by default. */
  readonly isEqual?: (a: T, b: T) => boolean;
  /**
   * Runs right before the change callback, with the value it gets: a
   * component writes its form field here, so a listener's `FormData` holds
   * the value, as a native control's does in its `change`.
   */
  readonly beforeReport?: (value: T) => void;
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
  /**
   * Each part's id now (`Instance.ids`): the id the consumer gave its
   * element, else its `idOf` prop, else one made from the adapter's stable
   * id (`useId` in React). Read it where it is used, not once in `setup()`:
   * it changes when an element with an id of its own attaches.
   */
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
  /**
   * The element rendered for one of the definition's `itemParts` and an
   * item's key, or `null`.
   */
  itemElement(part: string, key: string): unknown;
  /**
   * Runs `effect` with each element rendered for one of the definition's
   * `itemParts`, as it attaches, while the instance is started; the
   * returned cleanup runs when the element detaches or the instance stops.
   * The element is opaque here: `dom/` helpers type it.
   */
  itemEffect(
    part: string,
    effect: (key: string, element: unknown) => void | (() => void),
  ): void;
  /**
   * Marks the items whose `connectItem()` props changed, so only they are
   * written again after the flush; with no keys, every item. A change of
   * props rewrites every item by itself; any other change needs this.
   */
  invalidateItems(keys?: Iterable<string>): void;
  /** Groups changes so the store flushes once. */
  batch<T>(fn: () => T): T;
  /**
   * Runs `fn` once the store has flushed: after every watcher and every
   * adapter's binder, so the parts carry the attributes of the state that
   * made the change; at once when no flush or batch is under way. For work
   * on elements that their state attributes affect, such as showing an
   * overlay (`partEffect` runs through it).
   */
  afterFlush(fn: () => void): void;
  /**
   * Composes another definition into this instance (decision 9): its
   * `setup()` runs here, on this instance's store and lifecycle, and reads
   * its props from `props()` on every access, so pass this component's props
   * and callbacks through. Its parts are this component's parts of the same
   * name, unless `options.parts` maps them; one with neither is left out.
   * `options.links` hands it links. Call it during `setup()`, and fold what
   * it returns into `expose()` and `connect()`.
   */
  use<D extends AnyDefinition>(
    definition: D,
    props: () => NoInfer<PropsOf<D>>,
    options?: ComposeOptions<NoInfer<PartOf<D>>, Part, NoInfer<LinkOf<D>>>,
  ): Composed<D>;
  /**
   * The instance of `definition` this one works inside (decision 11), or
   * `undefined` until the adapter finds it: the `owner` prop, else the
   * adapter's link. Read it where it is used (`connect()`, `expose()`, a
   * watch): while started, the owner's changes re-run them.
   */
  owner<D extends AnyDefinition>(definition: D): Owned<D> | undefined;
  /**
   * The instance linked by `key`, one of the definition's `links`, or
   * `undefined` until there is one: the prop of the key's name, else the
   * adapter's link; none while that prop is `null`. In a definition
   * composed with `ctx.use()`, only the links its composer passed on
   * (`ComposeOptions.links`); and once passed on, `undefined` in the
   * composer. Read it where it is used: while started, the linked
   * instance's changes re-run `connect()`, `expose()` and watches. With
   * `select`, only those that change what it returns from the linked
   * instance's `api` (`Object.is`), so a field follows its own record in a
   * form (Form spec, Runtime changes 3); the latest `select` for a key is
   * the one used.
   */
  link<Api>(
    key: LinkKey<string, Api>,
    select?: (api: Api) => unknown,
  ): Linked<Api> | undefined;
}

export interface ComposeOptions<
  Inner extends string,
  Outer extends string,
  Link extends LinkKey = LinkKey,
> {
  /**
   * This component's part for each of the composed one's; same name by
   * default. `null` leaves a part out: nothing renders it, and the composed
   * definition sees no element for it. A part with no mapping and no part of
   * its name is left out too, and the DOM binder warns about it in
   * development (composition spec, Runtime changes 1); a mapping to a part
   * this component lacks throws.
   */
  readonly parts?: Readonly<Partial<Record<Inner, Outer | null>>>;
  /**
   * Links handed to the composed definition, so its `ctx.link()` reads
   * them and drives the linked instance; the composer's `ctx.link()` reads
   * them no more. Each must be one both take (composition spec, Runtime
   * changes 3).
   */
  readonly links?: readonly Link[];
}

/** A definition composed with `ctx.use()`. */
export interface Composed<D extends AnyDefinition> {
  /**
   * What its `setup()` returned. Internal: only UniAria's own composites
   * read it (composition spec, What a composing definition may use).
   */
  readonly api: ApiOf<D>;
  /** Its public actions, each run in a batch, as on an instance. */
  readonly actions: ActionsOf<D>;
  /** Its `expose()` now. */
  state(): StateOf<D>;
  /** Its `connect()` now, keyed by its own part names, without part markers. */
  connect(): ConnectedParts<PartOf<D>>;
  /** Its `connectItem()` now, for a definition with item parts. */
  connectItem(part: ItemPartOf<D>, key: string): PartProps;
}

/** What `expose()` and `connect()` read. */
export interface ViewContext<Part extends string, P extends PropsSchema, Api> {
  readonly props: PropReaders<P>;
  /** Each part's id now, as `SetupContext.ids`. */
  readonly ids: Readonly<Record<Part, string>>;
  readonly api: Api;
}

export type ConnectedParts<Part extends string> = Readonly<
  Record<Part, PartProps>
>;

export interface BehaviorConfig<
  Part extends string,
  P extends PropsSchema,
  E extends EventsSchema,
  Api,
  State,
> {
  /**
   * kebab-case; becomes the root's `data-uni`, the start of each outside
   * part's `data-uni-part`, and the element name.
   */
  readonly name: string;
  readonly parts: readonly Part[];
  /**
   * Parts rendered outside the root, as an overlay's trigger is. Each is
   * marked by `data-uni-part="<name>-<part>"` instead of `data-element`, so
   * styles reach it without the root.
   */
  readonly outsideParts?: readonly Part[];
  readonly props: P;
  readonly events?: E;
  /**
   * The instance this component works inside, when it has one.
   * `defineBehavior()` types it `undefined` when there is none, which a
   * consumer's `exactOptionalPropertyTypes` accepts only with `| undefined`
   * here.
   */
  readonly owner?: OwnerLink | undefined;
  /**
   * Links this component takes, each through a prop of the key's name;
   * `undefined` when there are none, as `owner` is.
   */
  readonly links?: readonly LinkKey[] | undefined;
  /** Links this component answers, such as a tooltip's. */
  readonly provides?: readonly LinkKey[];
  /**
   * The functions in `setup()`'s result that consumers may call:
   * `instance.actions`, the React handle's `actions`, and methods on the
   * custom element. Everything else `setup()` returns stays internal.
   */
  readonly actions?: readonly (keyof Api & string)[];
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
> extends BehaviorConfig<Part, P, E, Api, State> {
  readonly events: E;
  /** The schema resolved for adapters: attributes, types, events. */
  readonly schema: ResolvedSchema;
  /**
   * Parts repeated once per item of a collection, keyed by the item's key
   * (Listbox spec, Item parts).
   */
  readonly itemParts?: readonly string[];
  /**
   * Props for one item part of one item. Called only for rendered items,
   * and cached until `ctx.invalidateItems()` names the key or props change.
   */
  connectItem?(
    ctx: ViewContext<Part, P, Api>,
    part: string,
    key: string,
  ): PartProps;
}

// Generic code (adapters, the instance) accepts definitions of any shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDefinition = Definition<string, any, any, any, any>;

// Read from the definition's members rather than inferred through its
// generics: methods mention every type parameter, which muddies inference.
export type PartOf<D extends AnyDefinition> = D['parts'][number];
export type ItemPartOf<D extends AnyDefinition> = NonNullable<
  D['itemParts']
>[number];
export type ApiOf<D extends AnyDefinition> = ReturnType<D['setup']>;
/** The link keys a definition takes. */
export type LinkOf<D extends AnyDefinition> =
  D['links'] extends readonly (infer K extends LinkKey)[] ? K : never;
/** The public actions: the members of `api` the definition lists in `actions`. */
export type ActionsOf<D extends AnyDefinition> = Pick<
  ApiOf<D>,
  Extract<NonNullable<D['actions']>[number], keyof ApiOf<D>>
>;
export type StateOf<D extends AnyDefinition> = ReturnType<D['expose']>;
/** The keys of a definition's bindables: `isOpen`, `value`. */
export type BindableKeyOf<D extends AnyDefinition> = {
  [K in keyof D['props'] & string]: D['props'][K] extends BindableSpec<
    infer _T,
    infer _Event
  >
    ? K
    : never;
}[keyof D['props'] & string];
export type PropsOf<D extends AnyDefinition> = InputProps<
  D['props'],
  D['events']
> &
  OwnerProps<D> &
  LinkProps<D>;

/** An owned component takes its owner instance as the `owner` prop. */
type OwnerProps<D extends AnyDefinition> = [NonNullable<D['owner']>] extends [
  never,
]
  ? unknown
  : NonNullable<D['owner']> extends OwnerLink<infer O>
    ? { readonly owner?: Instance<O> }
    : unknown;

/**
 * A linking component takes each linked instance as a prop of the key's
 * name: the instance, the handle an adapter returned, or `null` for none.
 */
type LinkProps<D extends AnyDefinition> = D['links'] extends readonly LinkKey[]
  ? Partial<
      Readonly<
        Record<
          D['links'][number]['name'],
          Linkable | { readonly instance: Linkable } | null
        >
      >
    >
  : unknown;

/**
 * An instance a link prop takes. Loosely typed: an `Instance<D>` isn't an
 * `Instance`, since its typed callback props don't take `unknown`.
 */
export interface Linkable {
  readonly definition: AnyDefinition;
}

/**
 * The instance a link prop holds: the instance itself, or the one a handle
 * (React's or Vue's `useBehavior()`) carries; `null` for none (Form spec,
 * Runtime changes 4), `undefined` while the prop is unset.
 */
export function linkTarget(value: unknown): Instance | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  if ('definition' in value) return value as Instance;
  return 'instance' in value
    ? (value as { instance: Instance }).instance
    : undefined;
}

/**
 * A link named by a small key rather than the definition that answers it
 * (Tooltip spec, Resolved questions 2), so a component that takes the link
 * doesn't bundle the component it links to. The name is the prop that takes
 * the instance and the element attribute that names its host by id; a
 * custom element without the attribute links to the host it sits in
 * directly. `Api` is what the linked instance's `setup()` returns.
 */
export interface LinkKey<Name extends string = string, Api = unknown> {
  /** `tooltip`: `useBehavior(button, { tooltip })`, `<uni-button tooltip="hint">`. */
  readonly name: Name;
  /** The element attribute, when it isn't the name: `option-tooltip`. */
  readonly attribute?: string;
  /**
   * Found on elements only by its attribute, never through the host the
   * element sits in: a component with two keys a host answers takes that
   * host for the other one (items spec, Runtime and harness changes 3).
   */
  readonly isAttributeOnly?: boolean;
  /**
   * Found as an owner is, from the nearest provider around the component
   * across other UniAria hosts, rather than only from the host it sits in
   * directly: React context and Vue's provide in every component, the DOM
   * request event on elements (Form spec, Runtime changes 1).
   */
  readonly isInherited?: boolean;
  /** Types `ctx.link()`; never set. */
  readonly api?: Api;
}

/** The instance linked by a key, as `ctx.link()` returns it. */
export interface Linked<Api> {
  readonly instance: Instance;
  readonly api: Api;
}

/**
 * How a component finds its owner (decision 11): the owner's definition, and
 * the element attribute that names the owner's host by id.
 */
export interface OwnerLink<D extends AnyDefinition = AnyDefinition> {
  readonly definition: D;
  /** `group`: `<uni-checkbox group="plan">`. */
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
 * Whether a defined component names `definition` as its owner, or it
 * provides a link, so adapters answer owner lookups only for instances that
 * can be owners.
 */
export function isOwnerDefinition(definition: AnyDefinition): boolean {
  return owners.has(definition) || (definition.provides?.length ?? 0) > 0;
}

/** Whether `definition` answers a lookup for `wanted`: its owner or a link key. */
export function answers(
  definition: AnyDefinition,
  wanted: AnyDefinition | LinkKey,
): boolean {
  return (
    definition === wanted ||
    (definition.provides?.includes(wanted as LinkKey) ?? false)
  );
}

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineBehavior<
  const Part extends string,
  P extends PropsSchema,
  Api,
  State,
  E extends EventsSchema = Record<never, EventSpec<unknown>>,
  O extends OwnerLink | undefined = undefined,
  const L extends readonly LinkKey[] | undefined = undefined,
  const ItemPart extends string = never,
  const Action extends keyof Api & string = never,
>(
  config: BehaviorConfig<Part, P, E, Api, State> & {
    readonly owner?: O;
    readonly links?: L;
    readonly actions?: readonly Action[];
    readonly itemParts?: readonly ItemPart[];
    connectItem?(
      ctx: ViewContext<Part, P, Api>,
      part: ItemPart,
      key: string,
    ): PartProps;
  },
): Definition<Part, P, E, Api, State> & {
  readonly owner: O;
  readonly links: L;
  readonly itemParts: readonly ItemPart[];
  readonly actions: readonly Action[];
} {
  if (!NAME.test(config.name)) {
    throw new Error(
      `[uniaria] Component name "${config.name}" must be kebab-case.`,
    );
  }
  const events = config.events ?? ({} as E);
  const schema = resolveSchema(config.props, events);
  const seen = new Set<string>();
  const callback = (name: string) => {
    if (seen.has(name)) {
      throw new Error(
        `[uniaria] ${config.name}: "${name}" is defined twice by its props and events.`,
      );
    }
    seen.add(name);
  };
  const idProps = new Set<string>();
  for (const info of schema.props) {
    callback(info.key);
    if (info.defaultKey) callback(info.defaultKey);
    if (info.idOf === undefined) continue;
    if (
      info.kind !== 'prop' ||
      !(config.parts as readonly string[]).includes(info.idOf) ||
      idProps.has(info.idOf)
    ) {
      throw new Error(
        `[uniaria] ${config.name}: "${info.key}" can't set the id of "${info.idOf}": idOf takes a plain prop and a part no other prop names.`,
      );
    }
    idProps.add(info.idOf);
  }
  for (const name of schema.events) callback(`on${capitalize(name)}`);
  if (config.owner) {
    callback('owner');
    owners.add(config.owner.definition);
  }
  for (const key of config.links ?? []) callback(key.name);
  for (const action of config.actions ?? []) callback(action);
  for (const part of config.outsideParts ?? []) {
    if (
      part === 'root' ||
      !(config.parts as readonly string[]).includes(part)
    ) {
      throw new Error(
        `[uniaria] ${config.name}: outside part "${part}" must be one of its parts, other than the root.`,
      );
    }
  }
  if (config.itemParts && !config.connectItem) {
    throw new Error(`[uniaria] ${config.name}: item parts need connectItem().`);
  }
  for (const part of config.itemParts ?? []) {
    if ((config.parts as readonly string[]).includes(part)) {
      throw new Error(
        `[uniaria] ${config.name}: "${part}" is both a part and an item part.`,
      );
    }
  }
  return { ...config, events, schema } as unknown as Definition<
    Part,
    P,
    E,
    Api,
    State
  > & {
    readonly owner: O;
    readonly links: L;
    readonly itemParts: readonly ItemPart[];
    readonly actions: readonly Action[];
  };
}

/**
 * The id of an item part: `<base>-<part>-<key>`, the key passed through
 * `encodeURIComponent`, so keys never collide (`"a b"` and `"ab"`) and no id
 * holds whitespace. A definition passes the base its other ids follow.
 */
export function itemId(base: string, part: string, key: string): string {
  return `${base}-${part}-${encodeURIComponent(key)}`;
}
