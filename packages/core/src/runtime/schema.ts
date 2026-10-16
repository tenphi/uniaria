/**
 * The props schema of a definition (design decisions 1 and 9): one source for
 * the TypeScript props of every adapter, the element's attributes and
 * properties, and the events a component dispatches.
 *
 * - `prop(default)` — a plain value the consumer owns.
 * - `bindable(default)` — a stateful value that is controlled when the
 *   consumer passes it and uncontrolled otherwise (`default<Name>` seeds it).
 *   Changes are reported through the `<name>Change` event.
 * - `event<Detail>()` — something the component reports, such as `press`.
 *
 * Boolean props read as predicates: `is…` for states (`isDisabled`,
 * `isOpen`), `should…`, `has…` or `allows…` for behavior
 * (`shouldPreventFocusOnPress`). Derived names drop the prefix where HTML
 * would: a bindable `isOpen` is seeded by `defaultOpen` and reports
 * `openChange`, and element attributes drop `is` and `should`
 * (`isDisabled` → `disabled`, `shouldExcludeFromTabOrder` →
 * `exclude-from-tab-order`).
 *
 * Event names are camelCase (`pressStart`, `openChange`). Adapters derive the
 * rest: the DOM event is lowercase (`pressstart`), the callback prop is
 * `on` + the capitalized name (`onPressStart`).
 */

/** How an element attribute converts to a prop value. */
export type PropType = 'boolean' | 'string' | 'number' | 'json';

/**
 * Where a custom element reads a prop the consumer did not set: the tag name
 * of a part (Button's `elementType`), an attribute the consumer wrote on it
 * before the element upgraded (Button's `href`), or a live DOM property
 * (TextField's input `value`, which may hold text typed before upgrade). A
 * bindable adopts into its `default<Key>`, so it stays uncontrolled.
 */
export type PropAdoption =
  | { readonly part: string; readonly tag: true }
  | { readonly part: string; readonly attribute: string }
  | { readonly part: string; readonly property: string };

export interface PropOptions {
  /**
   * The element attribute. Defaults to the key in kebab case, or
   * `default-<key>` for bindables; `false` makes it a property only.
   */
  readonly attribute?: string | false;
  /** Attribute conversion. Inferred from the default when it is not `undefined`. */
  readonly type?: PropType;
  readonly adopt?: PropAdoption;
}

export interface PropSpec<T> {
  readonly kind: 'prop';
  readonly defaultValue: T;
  readonly options: PropOptions;
}

export interface BindableOptions<
  Event extends string | undefined,
> extends PropOptions {
  /** The change event. Defaults to `<name>Change` (`isOpen` → `openChange`). */
  readonly event?: Event;
}

export interface BindableSpec<T, Event extends string | undefined = undefined> {
  readonly kind: 'bindable';
  readonly defaultValue: T;
  readonly event: Event;
  readonly options: PropOptions;
}

export interface EventSpec<Detail> {
  readonly kind: 'event';
  /** Type-only: the detail the event carries. */
  readonly detail?: Detail;
}

export function prop<T>(
  defaultValue: T,
  options: PropOptions = {},
): PropSpec<T> {
  return { kind: 'prop', defaultValue, options };
}

// `NoInfer` keeps the schema's contextual type (`BindableSpec<any, any>`)
// from turning an omitted event into `any`.
export function bindable<T, const Event extends string | undefined = undefined>(
  defaultValue: T,
  options: BindableOptions<Event> = {},
): BindableSpec<T, NoInfer<Event>> {
  const { event, ...rest } = options;
  return {
    kind: 'bindable',
    defaultValue,
    event: event as Event,
    options: rest,
  };
}

export function event<Detail = void>(): EventSpec<Detail> {
  return { kind: 'event' };
}

// The schema holds specs of every value type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPropSpec = PropSpec<any> | BindableSpec<any, any>;
export type PropsSchema = Readonly<Record<string, AnyPropSpec>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventsSchema = Readonly<Record<string, EventSpec<any>>>;

/** One prop as the adapters see it, resolved from the schema. */
export interface PropInfo {
  readonly key: string;
  /** Bindables only: the prop that seeds it (`isOpen` → `defaultOpen`). */
  readonly defaultKey?: string;
  readonly kind: 'prop' | 'bindable';
  readonly defaultValue: unknown;
  readonly type: PropType;
  /** The element attribute, or `false` for a property-only prop. */
  readonly attribute: string | false;
  readonly adopt?: PropAdoption;
  /** Bindables only: the camelCase change event. */
  readonly changeEvent?: string;
}

export interface ResolvedSchema {
  readonly props: readonly PropInfo[];
  /** Every event the component dispatches, change events included, camelCase. */
  readonly events: readonly string[];
}

export function capitalize<S extends string>(value: S): Capitalize<S> {
  return (value.charAt(0).toUpperCase() + value.slice(1)) as Capitalize<S>;
}

/** `isOpen` → `open`; names without a predicate prefix stay as they are. */
export type StateName<Key extends string> = Unprefixed<Key, 'is'>;

type Unprefixed<
  Key extends string,
  Prefix extends string,
> = Key extends `${Prefix}${infer Rest}`
  ? Rest extends ''
    ? Key
    : Rest extends Capitalize<Rest>
      ? Uncapitalize<Rest>
      : Key
  : Key;

function unprefixed(key: string, prefixes: readonly string[]): string {
  for (const prefix of prefixes) {
    const rest = key.slice(prefix.length);
    if (key.startsWith(prefix) && /^[A-Z]/.test(rest)) {
      return rest.charAt(0).toLowerCase() + rest.slice(1);
    }
  }
  return key;
}

/** The name a bindable's derived props use: `isOpen` → `open`. */
export function stateName(key: string): string {
  return unprefixed(key, ['is']);
}

export function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `pressStart` → `onPressStart`: the callback prop for an event. */
export function callbackName(event: string): string {
  return `on${capitalize(event)}`;
}

/** `pressStart` → `pressstart`: the DOM event an element dispatches. */
export function domEventName(event: string): string {
  return event.toLowerCase();
}

function inferType(spec: AnyPropSpec): PropType {
  if (spec.options.type) return spec.options.type;
  switch (typeof spec.defaultValue) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
    case 'undefined':
      return 'string';
    default:
      return 'json';
  }
}

export function resolveSchema(
  props: PropsSchema,
  events: EventsSchema,
): ResolvedSchema {
  const infos: PropInfo[] = [];
  const names: string[] = [];
  for (const [key, spec] of Object.entries(props)) {
    const isBindable = spec.kind === 'bindable';
    const name = stateName(key);
    const changeEvent = isBindable
      ? ((spec.event as string | undefined) ?? `${name}Change`)
      : undefined;
    const attribute =
      spec.options.attribute ??
      (isBindable
        ? `default-${kebabCase(name)}`
        : kebabCase(unprefixed(key, ['is', 'should'])));
    infos.push({
      key,
      ...(isBindable ? { defaultKey: `default${capitalize(name)}` } : {}),
      kind: spec.kind,
      defaultValue: spec.defaultValue,
      type: inferType(spec),
      attribute,
      ...(spec.options.adopt ? { adopt: spec.options.adopt } : {}),
      ...(changeEvent ? { changeEvent } : {}),
    });
    if (changeEvent) names.push(changeEvent);
  }
  names.push(...Object.keys(events));
  return { props: infos, events: names };
}
