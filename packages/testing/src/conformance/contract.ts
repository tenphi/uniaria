/**
 * The `mount` contract between conformance scenarios and adapters. An adapter
 * implements one function, `ConformanceAdapter.mount()`; the runner wraps what
 * it returns into the `Mounted` object scenarios use. Scenarios depend only on
 * this file and the template, never on an adapter or a definition.
 *
 * Names:
 * - Components are named as in their definition (`button`, `checkbox-group`).
 * - Props are camelCase, as in the definition's props schema.
 * - Events are camelCase (`pressStart`, `openChange`). The DOM event is the
 *   lowercase name (`pressstart`), the React prop is `on` + the capitalized
 *   name (`onPressStart`).
 */

import type { TemplateNode } from './template';

/** What the runner asks an adapter to render. */
export interface MountRequest {
  /** Definition name: `button`. */
  readonly component: string;
  /** Initial props, passed the way the adapter's consumers pass them. */
  readonly props: Readonly<Record<string, unknown>>;
  /** The consumer's markup. Part elements carry `part`. */
  readonly template: readonly TemplateNode[];
  /** Component events to observe; call `record` whenever one fires. */
  readonly events: readonly string[];
  record(event: string, detail: unknown): void;
  /** An empty element already attached to `document.body`. Render into it. */
  readonly container: HTMLElement;
}

/**
 * What an adapter returns from `mount()`.
 *
 * Guarantees every adapter must keep, because scenarios assert right after an
 * awaited interaction:
 * - Attribute writes for a state change are visible when the interaction that
 *   caused it resolves (the DOM binder writes synchronously after a flush).
 * - `setProps()` resolves once the DOM reflects the new props.
 */
export interface AdapterMount {
  /** Merges props, the way the adapter's consumers update them. */
  setProps(props: Readonly<Record<string, unknown>>): Promise<void>;
  /**
   * Calls one of the component's public actions (`open`, `setValue(name,
   * value)`) with `args`, the way the adapter's consumers do: the React
   * handle's `actions`, the element's method. Resolves with what the action
   * returned, awaited when it is a promise (Form's `submit()`), once the
   * DOM reflects it.
   */
  call(action: string, ...args: readonly unknown[]): Promise<unknown>;
  /** The object the definition's `expose()` returns right now. */
  state(): Readonly<Record<string, unknown>>;
  /**
   * How many times the framework rendered the component that owns the
   * instance, including the first render. Adapters without renders (custom
   * elements) return 0.
   */
  renderCount(): number;
  /** Removes everything rendered and stops the instance. */
  unmount(): Promise<void>;
}

export interface ConformanceAdapter {
  /** `react`, `elements`. Appears in test names. */
  readonly name: string;
  mount(request: MountRequest): Promise<AdapterMount>;
}

export interface RecordedEvent {
  /** camelCase event name: `press`. */
  readonly name: string;
  /** The event payload: the React callback argument or the DOM event's `detail`. */
  readonly detail: unknown;
}

export interface MountOptions<Props> {
  /** The consumer's markup: one node or several. */
  readonly template: TemplateNode | readonly TemplateNode[];
  readonly props?: Partial<Props>;
  /** Component events to record, camelCase. */
  readonly events?: readonly string[];
}

/** A mounted component, as scenarios see it. */
export interface Mounted<Props, State> {
  /** The element the adapter rendered into. */
  readonly container: HTMLElement;
  /**
   * The element of a part of the mounted component (`root` by default)
   * inside the container, found by `partSelector()`: the root by
   * `data-uni="<component>"`, a part outside the root by
   * `data-uni-part="<component>-<part>"`, any other part by its
   * `data-element` inside the root. Throws when there is none or more than one, so a
   * missing marker fails loudly.
   */
  part(name?: string): HTMLElement;
  parts(name: string): HTMLElement[];
  /** Every recorded event so far, in order. */
  readonly events: readonly RecordedEvent[];
  /** Just the names of the recorded events, in order. */
  eventNames(): string[];
  clearEvents(): void;
  state(): State;
  setProps(props: Partial<Props>): Promise<void>;
  /**
   * Calls a public action of the component, such as `open`, with `args`,
   * and resolves with what it returned, awaited.
   */
  call(action: string, ...args: readonly unknown[]): Promise<unknown>;
  renderCount(): number;
}
