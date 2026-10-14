/**
 * The props schema of a definition (design decisions 1 and 9): one source for
 * the TypeScript props of every adapter, the element's attributes and
 * properties, and the events a component dispatches.
 *
 * - `prop(default)` — a plain value the consumer owns.
 * - `bindable(default)` — a stateful value that is controlled when the
 *   consumer passes it and uncontrolled otherwise (`default<Key>` seeds it).
 *   Changes are reported through the `<key>Change` event.
 * - `event<Detail>()` — something the component reports, such as `press`.
 *
 * Event names are camelCase (`pressStart`, `openChange`). Adapters derive the
 * rest: the DOM event is lowercase (`pressstart`), the callback prop is
 * `on` + the capitalized name (`onPressStart`).
 */

/** How an element attribute converts to a prop value. */
export type PropType = 'boolean' | 'string' | 'number' | 'json';

/**
 * Where a custom element reads a prop the consumer did not set: the tag name
 * of a part (Button's `elementType`), or an attribute the consumer wrote on
 * it before the element upgraded (Button's `href`).
 */
export type PropAdoption =
  | { readonly part: string; readonly tag: true }
  | { readonly part: string; readonly attribute: string };

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
  /** The change event. Defaults to `<key>Change`. */
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
    const bindable = spec.kind === 'bindable';
    const changeEvent = bindable
      ? ((spec.event as string | undefined) ?? `${key}Change`)
      : undefined;
    const attribute =
      spec.options.attribute ??
      (bindable ? `default-${kebabCase(key)}` : kebabCase(key));
    infos.push({
      key,
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
