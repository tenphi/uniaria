/**
 * `defineElement` (design decisions 8 and 10): turns any definition into a
 * light-DOM custom element. The element is a thin host over the same
 * instance the React adapter uses; it renders nothing and has no shadow root.
 *
 * - Props: one property per prop, plus `default<Key>` for bindables. Plain
 *   props also have a kebab-case attribute; a bindable's attribute is
 *   `default-<key>` (uncontrolled), and setting its property makes it
 *   controlled. The last write wins. A boolean attribute is true when
 *   present, except `"false"` on a prop that defaults to true
 *   (`dismissable="false"`).
 * - Events: every event and bindable change is dispatched on the host as a
 *   bubbling, non-composed `CustomEvent` with the value in `detail`
 *   (`pressStart` → `pressstart`).
 * - Parts: `data-part` elements inside the host, minus those inside a nested
 *   Sous element (of any kind) or a nested host of the same tag, re-scanned
 *   when the subtree changes. The DOM binder writes their attributes and
 *   delegates their listeners from the host.
 * - Lifecycle: `connectedCallback` → `start()`, `disconnectedCallback` →
 *   `stop()`, `attributeChangedCallback` → `setProps()` then `sync()`.
 * - Owners (decision 11): every host answers owner requests for its
 *   instance. A host whose definition names an owner links to the host its
 *   owner attribute names by id (`group="plan"`), else to the nearest
 *   owner around it; the `owner` property (an instance) wins over both.
 */

import type {
  AnyDefinition,
  Instance,
  OwnerLink,
  PropInfo,
  PropsOf,
} from '@tenphi/sous';
import { callbackName, createInstance, domEventName } from '@tenphi/sous';
import type { Binder } from '@tenphi/sous/dom';
import {
  SOUS_HOST,
  createBinder,
  observeParts,
  provideOwner,
  queryParts,
  requestOwner,
} from '@tenphi/sous/dom';

export interface DefineElementOptions {
  /** Name prefix: `<prefix>-<definition name>`. Default: `sous`. */
  readonly prefix?: string;
  /** The full element name; overrides `prefix`. */
  readonly name?: string;
}

/** `on` + a capital: a callback prop, which the element dispatches instead. */
type IsCallback<Key> = Key extends `on${infer First}${string}`
  ? First extends Uppercase<First>
    ? true
    : false
  : false;

/**
 * The element's prop properties, typed from the definition's schema: every
 * prop, and `default<Key>` for each bindable.
 */
export type ElementProperties<D extends AnyDefinition> = {
  -readonly [
    K in keyof PropsOf<D> as IsCallback<K> extends true ? never : K
  ]: PropsOf<D>[K];
};

export type SousElement<D extends AnyDefinition> = HTMLElement &
  ElementProperties<D> & {
    /** The instance behind the element: `getState()` reads public state. */
    readonly instance: Instance<D>;
  };

export interface SousElementConstructor<D extends AnyDefinition> {
  new (): SousElement<D>;
  readonly prototype: SousElement<D>;
}

function convert(info: PropInfo, value: string | null): unknown {
  if (value === null) return undefined;
  switch (info.type) {
    case 'boolean':
      // Present means true, as in HTML; `"false"` turns off a prop that is
      // on by default, which presence alone never could.
      return info.defaultValue !== true || value !== 'false';
    case 'number':
      return Number(value);
    case 'json':
      return JSON.parse(value) as unknown;
    default:
      return value;
  }
}

/**
 * Defines `<sous-<name>>` for `definition` and returns its class. Returns the
 * existing class when the name is already defined, and `undefined` where
 * there is no `customElements` (Node, SSR).
 */
export function defineElement<D extends AnyDefinition>(
  definition: D,
  options: DefineElementOptions = {},
): SousElementConstructor<D> | undefined {
  if (typeof customElements === 'undefined') return undefined;
  const name = options.name ?? `${options.prefix ?? 'sous'}-${definition.name}`;
  const existing = customElements.get(name);
  if (existing) return existing as unknown as SousElementConstructor<D>;

  const infos = definition.schema.props;
  const byAttribute = new Map<string, PropInfo>();
  for (const info of infos) {
    if (info.attribute !== false) byAttribute.set(info.attribute, info);
  }
  /**
   * Property name → the prop it sets. Bindables also take `default<Key>`;
   * an owned component's `owner` property sets no schema prop.
   */
  const properties = new Map<string, PropInfo | undefined>();
  for (const info of infos) {
    properties.set(info.key, info);
    if (info.kind === 'bindable') {
      properties.set(info.defaultKey!, info);
    }
  }
  const ownerLink = (definition as { owner?: OwnerLink }).owner;
  if (ownerLink) properties.set('owner', undefined);
  const builtIn = Object.getOwnPropertyNames(HTMLElement.prototype);
  for (const property of properties.keys()) {
    if (builtIn.includes(property) || property === 'instance') {
      throw new Error(
        `[sous] ${definition.name}: prop "${property}" would shadow an element property.`,
      );
    }
  }

  class Element extends HTMLElement {
    /** Hosts around this element leave its parts alone. */
    static readonly [SOUS_HOST] = true;

    static get observedAttributes(): string[] {
      return ownerLink
        ? [...byAttribute.keys(), ownerLink.attribute]
        : [...byAttribute.keys()];
    }

    static {
      for (const [property, info] of properties) {
        Object.defineProperty(this.prototype, property, {
          configurable: true,
          enumerable: true,
          get(this: Element) {
            const value = this.#values[property];
            return value === undefined && property === info?.key
              ? info.kind === 'prop'
                ? info.defaultValue
                : undefined
              : value;
          },
          set(this: Element, value: unknown) {
            this.#set(property, value);
          },
        });
      }
    }

    readonly instance: Instance<D>;
    readonly #binder: Binder;
    readonly #values: Record<string, unknown> = {};
    /** Props the consumer set, which adoption never overrides. */
    readonly #explicit = new Set<string>();
    readonly #callbacks: Record<string, (detail: unknown) => void> = {};
    readonly #parts = new Map<string, HTMLElement>();
    #unobserve: (() => void) | undefined;
    #unprovide: (() => void) | undefined;
    #unlink: (() => void) | undefined;

    constructor() {
      super();
      for (const event of definition.schema.events) {
        this.#callbacks[callbackName(event)] = (detail) => {
          this.dispatchEvent(
            new CustomEvent(domEventName(event), { detail, bubbles: true }),
          );
        };
      }
      this.instance = createInstance(definition, {
        props: this.#props(),
        env: { document: this.ownerDocument },
      });
      this.#binder = createBinder(this.instance, { host: this });
      // Properties a framework set before the element was defined shadow the
      // accessors; move them onto the accessors.
      for (const property of properties.keys()) {
        if (!Object.prototype.hasOwnProperty.call(this, property)) continue;
        const value = (this as Record<string, unknown>)[property];
        delete (this as Record<string, unknown>)[property];
        this.#set(property, value);
      }
    }

    connectedCallback(): void {
      this.#scan();
      this.#unobserve ??= observeParts(this, () => this.#scan());
      this.#unprovide ??= provideOwner(this.instance as Instance, this);
      // Linked before the first write, so a checkbox in a group starts with
      // the group's state.
      this.#relink();
      this.instance.start();
      this.#binder.start();
    }

    disconnectedCallback(): void {
      this.#unobserve?.();
      this.#unobserve = undefined;
      this.#unprovide?.();
      this.#unprovide = undefined;
      this.#unlink?.();
      this.#unlink = undefined;
      this.instance.link(undefined);
      this.instance.sync();
      this.#binder.stop();
      this.instance.stop();
    }

    /** Asks for the owner again: on connect and when the attribute changes. */
    #relink(): void {
      if (!ownerLink) return;
      this.#unlink?.();
      this.#unlink = requestOwner(
        this,
        ownerLink.definition,
        (owner) => {
          this.instance.link(owner);
          this.instance.sync();
        },
        this.getAttribute(ownerLink.attribute) ?? undefined,
      );
    }

    attributeChangedCallback(
      attribute: string,
      _previous: string | null,
      value: string | null,
    ): void {
      if (attribute === ownerLink?.attribute) {
        if (this.isConnected) this.#relink();
        return;
      }
      const info = byAttribute.get(attribute);
      if (!info) return;
      const property = info.kind === 'bindable' ? info.defaultKey! : info.key;
      this.#set(property, convert(info, value));
    }

    #props(): PropsOf<D> {
      return { ...this.#values, ...this.#callbacks } as PropsOf<D>;
    }

    #set(property: string, value: unknown, isExplicit = true): void {
      if (isExplicit && value !== undefined) this.#explicit.add(property);
      else this.#explicit.delete(property);
      if (Object.is(this.#values[property], value)) return;
      if (value === undefined) delete this.#values[property];
      else this.#values[property] = value;
      this.instance.setProps(this.#props());
      this.instance.sync();
    }

    /** Finds parts, adopts props from new part elements, attaches them. */
    #scan(): void {
      const found = queryParts(this, definition.parts);
      for (const part of definition.parts) {
        const element = found.get(part);
        if (element && element !== this.#parts.get(part)) {
          this.#adopt(part, element);
        }
        if (element) this.#parts.set(part, element);
        else this.#parts.delete(part);
        this.#binder.attach(part, element ?? null);
      }
    }

    /**
     * Reads props the consumer left unset from a part (decision 8). A
     * bindable adopts into its default, so it stays uncontrolled.
     */
    #adopt(part: string, element: HTMLElement): void {
      for (const info of infos) {
        const { adopt } = info;
        if (adopt?.part !== part || this.#explicit.has(info.key)) continue;
        const property = info.kind === 'bindable' ? info.defaultKey! : info.key;
        if (this.#explicit.has(property)) continue;
        const value =
          'tag' in adopt
            ? element.localName
            : 'property' in adopt
              ? (element as unknown as Record<string, unknown>)[adopt.property]
              : (element.getAttribute(adopt.attribute) ?? undefined);
        this.#set(property, value, false);
      }
    }
  }

  customElements.define(name, Element);
  return Element as unknown as SousElementConstructor<D>;
}
