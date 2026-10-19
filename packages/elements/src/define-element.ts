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
 * - Actions: one method per action the definition lists (`element.open()`),
 *   calling `instance.actions`.
 * - Parts: `data-part` elements inside the host, minus those inside a nested
 *   UniAria element (of any kind) or a nested host of the same tag, re-scanned
 *   when the subtree changes. The DOM binder writes their attributes and
 *   delegates their listeners from the host's root. Item parts are every such
 *   element, keyed by the consumer's `data-key`; a prop that adopts
 *   `items` reads its collection from them while the consumer sets none.
 * - Lifecycle: `connectedCallback` → `start()`, `disconnectedCallback` →
 *   `stop()`, `attributeChangedCallback` → `setProps()` then `sync()`.
 * - Owners (decision 11): every host answers owner requests for its
 *   instance. A host whose definition names an owner links to the host its
 *   owner attribute names by id (`group="plan"`), else to the nearest
 *   owner around it; the `owner` property (an instance) wins over both.
 */

import type {
  ActionsOf,
  AnyDefinition,
  Instance,
  ItemsAdoption,
  LinkKey,
  OwnerLink,
  PropInfo,
  PropsOf,
} from '@uniaria/core';
import { callbackName, createInstance, domEventName } from '@uniaria/core';
import type { Binder } from '@uniaria/core/dom';
import {
  UNI_HOST,
  createBinder,
  isDevelopment,
  observeParts,
  provideOwner,
  queryItemParts,
  queryParts,
  requestOwner,
  warn,
} from '@uniaria/core/dom';

export interface DefineElementOptions {
  /** Name prefix: `<prefix>-<definition name>`. Default: `uni`. */
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

export type UniElement<D extends AnyDefinition> = HTMLElement &
  ElementProperties<D> &
  ActionsOf<D> & {
    /** The instance behind the element: `getState()` reads public state. */
    readonly instance: Instance<D>;
  };

export interface UniElementConstructor<D extends AnyDefinition> {
  new (): UniElement<D>;
  readonly prototype: UniElement<D>;
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

interface AdoptedItem {
  readonly key: string;
  readonly textValue?: string;
  readonly items?: AdoptedItem[];
}

/** An element's text as typeahead reads it: whitespace collapsed. */
function textOf(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The collection an `items` adoption reads (`ItemsAdoption`): items and
 * sections in document order, each item inside the section around it.
 */
function readItems(
  found: ReadonlyMap<string, ReadonlyMap<string, HTMLElement>>,
  adoption: ItemsAdoption,
): AdoptedItem[] {
  const entries = [
    ...[...(found.get(adoption.item) ?? [])].map(([key, element]) => ({
      key,
      element,
      isSection: false,
    })),
    ...[...(adoption.section ? (found.get(adoption.section) ?? []) : [])].map(
      ([key, element]) => ({ key, element, isSection: true }),
    ),
  ].sort((a, b) =>
    a.element.compareDocumentPosition(b.element) &
    Node.DOCUMENT_POSITION_FOLLOWING
      ? -1
      : 1,
  );
  const result: AdoptedItem[] = [];
  const sections: { element: HTMLElement; items: AdoptedItem[] }[] = [];
  for (const { key, element, isSection } of entries) {
    if (isSection) {
      const items: AdoptedItem[] = [];
      sections.push({ element, items });
      result.push({ key, items });
      continue;
    }
    const item = {
      key,
      textValue: element.getAttribute('data-text-value') ?? textOf(element),
    };
    const section = sections.find((each) => each.element.contains(element));
    (section?.items ?? result).push(item);
  }
  return result;
}

/**
 * Defines `<uni-<name>>` for `definition` and returns its class. Returns the
 * existing class when the name is already defined, and `undefined` where
 * there is no `customElements` (Node, SSR).
 */
export function defineElement<D extends AnyDefinition>(
  definition: D,
  options: DefineElementOptions = {},
): UniElementConstructor<D> | undefined {
  if (typeof customElements === 'undefined') return undefined;
  const name = options.name ?? `${options.prefix ?? 'uni'}-${definition.name}`;
  const existing = customElements.get(name);
  if (existing) return existing as unknown as UniElementConstructor<D>;

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
  // Each link's attribute names its host by id (Tooltip spec, Resolved
  // questions 2).
  const links: readonly LinkKey[] = definition.links ?? [];
  const linkAttributes = new Map(links.map((key) => [key.name, key]));
  const builtIn = Object.getOwnPropertyNames(HTMLElement.prototype);
  for (const property of properties.keys()) {
    if (builtIn.includes(property) || property === 'instance') {
      throw new Error(
        `[uniaria] ${definition.name}: prop "${property}" would shadow an element property.`,
      );
    }
  }
  const actions: readonly string[] = definition.actions ?? [];
  for (const action of actions) {
    if (action in HTMLElement.prototype || action === 'instance') {
      throw new Error(
        `[uniaria] ${definition.name}: action "${action}" would shadow an element member.`,
      );
    }
  }

  class Element extends HTMLElement {
    /** Hosts around this element leave its parts alone. */
    static readonly [UNI_HOST] = true;

    static get observedAttributes(): string[] {
      return [
        ...byAttribute.keys(),
        ...(ownerLink ? [ownerLink.attribute] : []),
        ...linkAttributes.keys(),
      ];
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
      for (const action of actions) {
        Object.defineProperty(this.prototype, action, {
          configurable: true,
          writable: true,
          value(this: Element, ...args: unknown[]) {
            const run = (
              this.instance.actions as Record<
                string,
                (...args: unknown[]) => unknown
              >
            )[action]!;
            return run(...args);
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
    readonly #items = new Map<string, Map<string, HTMLElement>>();
    /** What each `items` adoption last read, to set it only on a change. */
    readonly #adoptedItems = new Map<string, string>();
    #unobserve: (() => void) | undefined;
    #unprovide: (() => void) | undefined;
    #unlink: (() => void) | undefined;
    readonly #unlinks = new Map<LinkKey, () => void>();

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
      for (const key of links) this.#relinkKey(key);
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
      for (const [key, unlink] of this.#unlinks) {
        unlink();
        this.instance.link(undefined, key);
      }
      this.#unlinks.clear();
      this.instance.sync();
      this.#binder.stop();
      this.instance.stop();
    }

    /** Asks for the owner again: on connect and when the attribute changes. */
    #relink(): void {
      if (!ownerLink) return;
      this.#unlink?.();
      // The owner named before is no longer this one's unless it answers.
      this.instance.link(undefined);
      this.#unlink = requestOwner(
        this,
        ownerLink.definition,
        (owner) => {
          this.instance.link(owner);
          this.instance.sync();
        },
        this.getAttribute(ownerLink.attribute) ?? undefined,
      );
      this.instance.sync();
    }

    /** Asks for a link again: on connect and when its attribute changes. */
    #relinkKey(key: LinkKey): void {
      this.#unlinks.get(key)?.();
      this.instance.link(undefined, key);
      this.#unlinks.set(
        key,
        requestOwner(
          this,
          key,
          (target) => {
            this.instance.link(target, key);
            this.instance.sync();
          },
          this.getAttribute(key.name) ?? undefined,
        ),
      );
      this.instance.sync();
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
      const key = linkAttributes.get(attribute);
      if (key) {
        if (this.isConnected) this.#relinkKey(key);
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
      this.instance.batch(() => {
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
        if (definition.itemParts?.length) this.#scanItems();
      });
    }

    /** Attaches item parts by key, and reads adopted collections. */
    #scanItems(): void {
      const found = queryItemParts(
        this,
        definition.itemParts!,
        isDevelopment()
          ? (element, reason) =>
              warn(
                `${definition.name}: the ${element.getAttribute('data-part')} part ` +
                  (reason === 'no-key'
                    ? 'has no data-key, so it is left alone.'
                    : `with data-key "${element.getAttribute('data-key')}" repeats an earlier one, so it is left alone.`),
              )
          : undefined,
      );
      for (const info of infos) {
        const { adopt } = info;
        if (!adopt || !('items' in adopt)) continue;
        if (this.#explicit.has(info.key)) {
          this.#adoptedItems.delete(info.key);
          continue;
        }
        const items = readItems(found, adopt.items);
        const serialized = JSON.stringify(items);
        if (this.#adoptedItems.get(info.key) === serialized) continue;
        this.#adoptedItems.set(info.key, serialized);
        this.#set(info.key, items, false);
      }
      for (const part of definition.itemParts!) {
        const next = found.get(part) ?? new Map<string, HTMLElement>();
        const current = this.#items.get(part) ?? new Map<string, HTMLElement>();
        for (const key of current.keys()) {
          if (!next.has(key)) this.#binder.attachItem(part, key, null);
        }
        for (const [key, element] of next) {
          if (current.get(key) !== element) {
            this.#binder.attachItem(part, key, element);
          }
        }
        this.#items.set(part, next);
      }
    }

    /**
     * Reads props the consumer left unset from a part (decision 8). A
     * bindable adopts into its default, so it stays uncontrolled.
     */
    #adopt(part: string, element: HTMLElement): void {
      for (const info of infos) {
        const { adopt } = info;
        if (!adopt || !('part' in adopt) || adopt.part !== part) continue;
        if (this.#explicit.has(info.key)) continue;
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
  return Element as unknown as UniElementConstructor<D>;
}
