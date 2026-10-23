/**
 * The Vue adapter (design decisions 2 and 9, Vue adapter spec). Internal
 * state never re-renders: each render reads the current part props, and the
 * DOM binder from `@uniaria/core/dom` writes later changes straight to the
 * elements. The store isn't reactive, so reading part props subscribes a
 * render to nothing; a component renders again for state only through
 * `useBehaviorState`, and only when the selected value changes.
 */

import type {
  ActionsOf,
  AnyDefinition,
  Instance,
  ItemPartOf,
  OwnerLink,
  PartOf,
  PartProps,
  PropsOf,
} from '@uniaria/core';
import { createInstance, isOwnerDefinition } from '@uniaria/core';
import type { Binder } from '@uniaria/core/dom';
import {
  createBinder,
  isDevelopment,
  provideOwner,
  requestOwner,
  warn,
} from '@uniaria/core/dom';
import type { MaybeRefOrGetter } from 'vue';
import {
  isProxy,
  isRef,
  markRaw,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  queuePostFlushCb,
  useId,
  watch,
} from 'vue';

import { findOwner, injectScope, provideScope } from './owner';
import { liveDefaults, toVueAttrs, vueEventName } from './props';

/** Props to bind onto a part element: attributes, stable handlers, a ref. */
export type VuePartProps = Readonly<Record<string, unknown>> & {
  readonly ref: (target: unknown) => void;
};

export interface BehaviorHandle<D extends AnyDefinition> {
  /** The stable instance: pass it to `useBehaviorState` or as an `owner`. */
  readonly instance: Instance<D>;
  /** The component's public actions, such as a popover's `open()` and `close()`. */
  readonly actions: ActionsOf<D>;
  /** Props for each part, read when the render reads them. */
  readonly parts: Readonly<Record<PartOf<D>, VuePartProps>>;
  /**
   * Props for one item part of one item (Listbox spec, Item parts), read
   * when the render reads them. Later changes reach the element through the
   * binder, so the component rendering the rows doesn't render again for
   * them.
   */
  getItemProps(part: ItemPartOf<D>, key: string): VuePartProps;
}

/**
 * What `useBehavior` takes as props: a getter, a ref, a reactive object
 * such as the component's own `defineProps()`, or a plain object read once.
 */
export type BehaviorProps<D extends AnyDefinition> = MaybeRefOrGetter<
  PropsOf<D>
>;

/** An element the binder will get, and the part props it rendered with. */
interface Attaching {
  readonly part: string;
  /** An item part's key; none for a named part. */
  readonly key?: string;
  element: Element | null;
  rendered: PartProps | undefined;
}

interface Internal<D extends AnyDefinition> {
  readonly instance: Instance<D>;
  readonly binder: Binder;
  readonly handlers: Map<string, (event: Event) => void>;
  readonly refs: Map<string, (target: unknown) => void>;
  /** Per item part and event type; the key comes from the element. */
  readonly itemHandlers: Map<string, (event: Event) => void>;
  /** Per item part and key: its ref, and the props it last rendered. */
  readonly items: Map<
    string,
    {
      readonly ref: (target: unknown) => void;
      rendered?: { readonly props: PartProps; readonly vue: VuePartProps };
    }
  >;
  readonly getItemProps: (part: string, key: string) => VuePartProps;
  /**
   * Elements Vue set or cleared through a ref since the last flush, per
   * part, or per item part and key. On first mount Vue calls a ref before
   * the element is in the document, so the binder gets them only once the
   * patch is done (Vue adapter spec, Refs).
   */
  readonly attaching: Map<string, Attaching>;
  /** The element the binder has, per part, or per item part and key. */
  readonly attached: Map<string, Element | null>;
  /** Hands `attaching` to the binder; stable, so Vue queues it once. */
  readonly flush: () => void;
  /** Live values from the first render, kept stable after it. */
  readonly defaults: Map<string, Readonly<Record<string, unknown>>>;
  /** Elements whose attributes were checked against the render. */
  readonly checked: WeakSet<Element>;
  rendered?: {
    readonly connected: unknown;
    readonly parts: Record<string, VuePartProps>;
  };
}

/**
 * The element a ref target stands for: the element, or for a component
 * bound as a part (a router link), its root element.
 */
function toElement(target: unknown): Element | null {
  let node = target;
  if (node && typeof node === 'object' && '$el' in node) node = node.$el;
  return node && typeof node === 'object' && (node as Node).nodeType === 1
    ? (node as Element)
    : null;
}

/**
 * Warns when the element's attributes differ from the part props Vue
 * rendered: the template, or a parent's fallthrough attributes, wrote an
 * attribute the binder owns, which the binder would silently overwrite.
 */
function checkOwnership<D extends AnyDefinition>(
  internal: Internal<D>,
  part: string,
  element: Element,
  rendered: PartProps | undefined,
): void {
  // A named part keeps an id the template gives it after `v-bind`, and the
  // binder points every reference at it; an item's id is made from its key.
  const isItem =
    internal.instance.definition.itemParts?.includes(part) ?? false;
  for (const [name, value] of Object.entries(rendered?.attrs ?? {})) {
    if (name === 'id' && !isItem) continue;
    const actual = element.getAttribute(name);
    if (actual === (value ?? null)) continue;
    warn(
      `${internal.instance.definition.name}: "${name}" on the ${part} part is ` +
        `written by UniAria, but the element has ${actual === null ? 'none' : `"${actual}"`}. ` +
        'Pass it as a prop, or drop it from the template.',
    );
  }
}

/** Hands the binder every element Vue set or cleared since the last flush. */
function flushAttaching<D extends AnyDefinition>(internal: Internal<D>): void {
  if (internal.attaching.size === 0) return;
  const list = Array.from(internal.attaching);
  internal.attaching.clear();
  internal.instance.batch(() => {
    for (const [id, { part, key, element, rendered }] of list) {
      if (element && isDevelopment() && !internal.checked.has(element)) {
        internal.checked.add(element);
        checkOwnership(internal, part, element, rendered);
      }
      internal.attached.set(id, element);
      if (key === undefined) internal.binder.attach(part, element);
      else internal.binder.attachItem(part, key, element);
    }
  });
}

/**
 * Records an element for the binder. Vue calls a ref again on every patch of
 * its element, so the same element again is a no-op.
 */
function queueAttaching<D extends AnyDefinition>(
  internal: Internal<D>,
  id: string,
  entry: Attaching,
): void {
  const pending = internal.attaching.get(id);
  if (pending) {
    pending.element = entry.element;
    pending.rendered = entry.rendered;
    return;
  }
  if (internal.attached.get(id) === entry.element) return;
  if (internal.attaching.size === 0) queuePostFlushCb(internal.flush);
  internal.attaching.set(id, entry);
}

/**
 * `getItemProps` for one instance: Vue props from the cached
 * `connectItem()`, reused while it returns the same object, with handlers
 * stable per part and event type and a ref stable per part and key.
 */
function createGetItemProps<D extends AnyDefinition>(
  internal: () => Internal<D>,
): (part: string, key: string) => VuePartProps {
  return (part, key) => {
    const { instance, binder, itemHandlers, items } = internal();
    const props = instance.connectItem(part as never, key);
    const id = `${part}\n${key}`;
    let item = items.get(id);
    if (!item) {
      const ref = (target: unknown) => {
        const current = internal();
        const element = toElement(target);
        const entry = current.items.get(id);
        queueAttaching(current, id, {
          part,
          key,
          element,
          rendered: entry?.rendered?.props,
        });
        // An item that unmounts takes its cache with it; a remount gets a
        // new ref.
        if (!element && entry?.ref === ref) current.items.delete(id);
      };
      item = { ref };
      items.set(id, item);
    }
    if (item.rendered?.props === props) return item.rendered.vue;
    const result = toVueAttrs(props, {});
    for (const type of Object.keys(props.on ?? {})) {
      const handlerKey = `${part}:${type}`;
      let handler = itemHandlers.get(handlerKey);
      if (!handler) {
        handler = (event: Event) => {
          const target = binder.itemOf(event.currentTarget as Element);
          if (!target) return;
          instance
            .connectItem(target.part as never, target.key)
            .on?.[type]?.(event as never);
        };
        itemHandlers.set(handlerKey, handler);
      }
      result[vueEventName(type)] = handler;
    }
    const vue = { ...result, ref: item.ref } as VuePartProps;
    item.rendered = { props, vue };
    return vue;
  };
}

function toVueParts<D extends AnyDefinition>(
  internal: Internal<D>,
  connected: Readonly<Record<string, PartProps>>,
): Record<string, VuePartProps> {
  const { instance, handlers, refs, defaults } = internal;
  const parts: Record<string, VuePartProps> = {};
  for (const [part, props] of Object.entries(connected)) {
    // From the first render only: a later one would reset the value
    // attribute, which a form reset goes back to.
    let initial = defaults.get(part);
    if (!initial) {
      initial = liveDefaults(props);
      defaults.set(part, initial);
    }
    const result = toVueAttrs(props, { ...initial });
    // Handlers keep their identity across renders and call the handler from
    // the latest connect() with the native event.
    for (const type of Object.keys(props.on ?? {})) {
      const key = `${part}:${type}`;
      let handler = handlers.get(key);
      if (!handler) {
        handler = (event: Event) => {
          const latest = instance.connect() as Readonly<
            Record<string, PartProps>
          >;
          latest[part]?.on?.[type]?.(event as never);
        };
        handlers.set(key, handler);
      }
      result[vueEventName(type)] = handler;
    }
    let ref = refs.get(part);
    if (!ref) {
      ref = (target: unknown) =>
        queueAttaching(internal, part, {
          part,
          element: toElement(target),
          rendered: (
            internal.rendered?.connected as
              Readonly<Record<string, PartProps>> | undefined
          )?.[part],
        });
      refs.set(part, ref);
    }
    parts[part] = { ...result, ref } as VuePartProps;
  }
  return parts;
}

/** A getter for the props, whichever form they came in. */
function propsReader<P>(source: MaybeRefOrGetter<P> | undefined): () => P {
  if (typeof source === 'function') return source as () => P;
  if (isRef(source)) return () => source.value;
  // A reactive object, such as `defineProps()`: spreading it reads, and so
  // tracks, every key.
  if (isProxy(source)) return () => ({ ...source }) as P;
  const props = (source ?? {}) as P;
  return () => props;
}

/**
 * Creates an instance of `definition` for this component and returns props
 * for its parts. Call it in `setup()`. Props are stored silently before the
 * render reads them and synced after the patch; internal state changes
 * never re-render this component.
 */
export function useBehavior<D extends AnyDefinition>(
  definition: D,
  // Optional when every prop is.
  ...[props]: Partial<PropsOf<D>> extends PropsOf<D>
    ? [props?: NoInfer<BehaviorProps<D>>]
    : [props: NoInfer<BehaviorProps<D>>]
): BehaviorHandle<D> {
  const read = propsReader(props);
  const instance = createInstance(definition, { props: read(), id: useId() });
  markRaw(instance);
  const internal: Internal<D> = {
    instance,
    binder: createBinder(instance),
    handlers: new Map(),
    refs: new Map(),
    itemHandlers: new Map(),
    items: new Map(),
    getItemProps: createGetItemProps(() => internal),
    attaching: new Map(),
    attached: new Map(),
    flush: () => flushAttaching(internal),
    defaults: new Map(),
    checked: new WeakSet(),
  };
  const { binder } = internal;

  // Decision 11: the `owner` prop, else the nearest provided owner during
  // setup (so the first render and the server HTML have it), else the DOM
  // after mount.
  const scope = injectScope();
  const ownerLink = (definition as { owner?: OwnerLink }).owner;
  const scopeOwner = ownerLink
    ? findOwner(scope, ownerLink.definition)
    : undefined;
  if (scopeOwner) instance.link(scopeOwner);
  provideScope(instance as unknown as Instance, scope);

  let isRunning = false;
  let lookup: (() => void) | null = null;
  const isLinkedByDom = () =>
    ownerLink !== undefined &&
    scopeOwner === undefined &&
    (instance.getProps() as { owner?: unknown }).owner === undefined;
  // Looks for the owner through the DOM while neither the `owner` prop nor
  // a provided owner gives one.
  const updateLookup = () => {
    if (isLinkedByDom() === (lookup !== null)) return;
    if (lookup) {
      lookup();
      lookup = null;
      return;
    }
    const element = definition.parts
      .map((part: string) => instance.element(part as PartOf<D>))
      .find(Boolean) as Element | undefined;
    if (!element) return;
    const forget = requestOwner(element, ownerLink!.definition, (owner) => {
      instance.link(owner);
      instance.sync();
    });
    lookup = () => {
      forget();
      instance.link(undefined);
      instance.sync();
    };
  };

  const sync = () => {
    flushAttaching(internal);
    instance.sync();
    if (isRunning) updateLookup();
  };
  watch(
    read,
    (next) => {
      instance.setProps(next);
      queuePostFlushCb(sync);
    },
    { flush: 'pre' },
  );

  let stop: (() => void) | null = null;
  const begin = () => {
    if (stop) return;
    flushAttaching(internal);
    // In one batch, so the start's element effects run once the binder has
    // written the parts: an overlay open from the start is `data-entering`
    // as it shows.
    instance.batch(() => {
      instance.start();
      binder.start();
    });
    // Answers owner requests from custom elements and components that find
    // their owner through the DOM.
    const unprovide = isOwnerDefinition(definition)
      ? definition.parts.flatMap((part: string) => {
          const element = instance.element(part as PartOf<D>);
          return element
            ? [
                provideOwner(
                  instance as unknown as Instance,
                  element as Element,
                ),
              ]
            : [];
        })
      : [];
    isRunning = true;
    updateLookup();
    instance.sync();
    stop = () => {
      isRunning = false;
      lookup?.();
      lookup = null;
      for (const forget of unprovide) forget();
      binder.stop();
      instance.stop();
    };
  };
  const end = () => {
    stop?.();
    stop = null;
  };
  onMounted(begin);
  onActivated(begin);
  onDeactivated(end);
  onBeforeUnmount(end);

  return markRaw({
    instance,
    actions: instance.actions,
    get parts() {
      const connected = instance.connect();
      if (internal.rendered?.connected !== connected) {
        internal.rendered = {
          connected,
          parts: toVueParts(internal, connected),
        };
      }
      return internal.rendered.parts as BehaviorHandle<D>['parts'];
    },
    getItemProps: internal.getItemProps as BehaviorHandle<D>['getItemProps'],
  });
}
