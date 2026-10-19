/**
 * Finding part elements inside a custom-element host (design decision 8) by
 * their markers (root AGENTS.md → Part markers): the root by its
 * `uni-<name>` class, every other part by its `data-element`. Only elements
 * with no other host between them and this one count, so a nested instance
 * keeps its own parts. Another host is a nested UniAria element of any kind,
 * or one of the same tag. A nested UniAria element can itself be a part of
 * the outer host. Parts added later are picked up by observing the host, as
 * are parts a nested element takes over once its tag is defined.
 */

import { partElement, rootClass } from '../runtime';

/**
 * Marks a custom-element class as a UniAria host, so hosts around its elements
 * leave their parts alone. `Symbol.for`, so every copy of UniAria on a page
 * agrees.
 */
export const UNI_HOST: unique symbol = Symbol.for('@uniaria/host') as never;

/**
 * True for an element whose tag is defined as a UniAria host. A tag defined
 * later counts from then on.
 */
export function isUniHost(element: Element): boolean {
  if (!element.localName.includes('-')) return false;
  return isUniTag(
    element.ownerDocument.defaultView?.customElements,
    element.localName,
  );
}

function isUniTag(
  registry: CustomElementRegistry | undefined,
  tag: string,
): boolean {
  const host = registry?.get(tag) as
    { readonly [UNI_HOST]?: boolean } | undefined;
  return host?.[UNI_HOST] === true;
}

/** Callbacks per registry and undefined tag, waiting for its definition. */
const waiting = new WeakMap<
  CustomElementRegistry,
  Map<string, Set<() => void>>
>();

/**
 * Calls `callback` once `tag` is defined; returns the function that stops
 * waiting. Observers share one `whenDefined()` per tag, so a tag that is
 * never defined holds on to no host that stopped waiting.
 */
function whenDefined(
  registry: CustomElementRegistry,
  tag: string,
  callback: () => void,
): () => void {
  let tags = waiting.get(registry);
  if (!tags) waiting.set(registry, (tags = new Map()));
  const callbacks: Set<() => void> = tags.get(tag) ?? new Set();
  if (!tags.has(tag)) {
    tags.set(tag, callbacks);
    void registry.whenDefined(tag).then(() => {
      tags.delete(tag);
      for (const each of callbacks) each();
    });
  }
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

/** No other host stands between `element` and `host`. */
function belongsTo(element: Element, host: Element): boolean {
  for (
    let node = element.parentElement;
    node && node !== host;
    node = node.parentElement
  ) {
    if (node.localName === host.localName || isUniHost(node)) return false;
  }
  return true;
}

/** Each of `parts` by its `data-element`. */
function byElement(parts: readonly string[]): Map<string, string> {
  return new Map(parts.map((part) => [partElement(part), part]));
}

/**
 * The first element for each of `parts` that belongs to `host`, the
 * component `name`.
 */
export function queryParts(
  host: Element,
  name: string,
  parts: readonly string[],
): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  const named = byElement(parts.filter((part) => part !== 'root'));
  const root = parts.includes('root') ? rootClass(name) : undefined;
  const selector = root ? `[data-element], .${root}` : '[data-element]';
  for (const element of host.querySelectorAll<HTMLElement>(selector)) {
    const part =
      root && element.classList.contains(root)
        ? 'root'
        : named.get(element.getAttribute('data-element') ?? '');
    if (part === undefined || found.has(part)) continue;
    if (!belongsTo(element, host)) continue;
    found.set(part, element);
  }
  return found;
}

/**
 * Every element of each item part that belongs to `host`, by part and the
 * consumer's `data-key` (Listbox spec, Item parts), in document order. An
 * element without a key is left out, and of two with the same part and key
 * the first wins; `onSkip` hears about both.
 */
export function queryItemParts(
  host: Element,
  parts: readonly string[],
  onSkip?: (element: HTMLElement, reason: 'no-key' | 'duplicate') => void,
): Map<string, Map<string, HTMLElement>> {
  const found = new Map<string, Map<string, HTMLElement>>();
  if (parts.length === 0) return found;
  const named = byElement(parts);
  for (const element of host.querySelectorAll<HTMLElement>('[data-element]')) {
    const part = named.get(element.getAttribute('data-element')!);
    if (part === undefined || !belongsTo(element, host)) continue;
    const key = element.getAttribute('data-key');
    if (key === null) {
      onSkip?.(element, 'no-key');
      continue;
    }
    let byKey = found.get(part);
    if (!byKey) found.set(part, (byKey = new Map()));
    if (byKey.has(key)) {
      onSkip?.(element, 'duplicate');
      continue;
    }
    byKey.set(key, element);
  }
  return found;
}

/**
 * Calls `callback` whenever parts of the component `name` may have been
 * added, removed or renamed, an item's text value may have changed (its text
 * or `data-text-value`), or a nested element's tag was defined as a host. A
 * change of `class` counts only when it adds or removes the root's class,
 * and a change of text only inside one of the host's items, so a consumer's
 * class toggles and other text cost no rescan.
 */
export function observeParts(
  host: Element,
  name: string,
  callback: () => void,
): () => void {
  const view = host.ownerDocument.defaultView;
  if (!view) return () => undefined;
  const root = rootClass(name);
  const hadRoot = (value: string | null) =>
    value !== null && value.split(/\s+/).includes(root);
  const isRelevant = (record: MutationRecord): boolean => {
    if (record.type === 'characterData') {
      // Text matters only as an item's text value: inside one of its items.
      const item = record.target.parentElement?.closest('[data-key]');
      return (
        !!item && item !== host && host.contains(item) && belongsTo(item, host)
      );
    }
    return (
      record.attributeName !== 'class' ||
      hadRoot(record.oldValue) !==
        (record.target as Element).classList.contains(root)
    );
  };
  // A host upgraded before a nested element's tag was defined took the parts
  // inside it, and defining a tag mutates nothing: wait for each undefined
  // tag, and scan again if it turns out to be a host.
  const { customElements: registry } = view;
  const waits = new Map<string, () => void>();
  const wait = (element: Element) => {
    const tag = element.localName;
    if (waits.has(tag) || !tag.includes('-') || element.matches(':defined')) {
      return;
    }
    const onDefined = () => {
      waits.delete(tag);
      if (isUniTag(registry, tag)) callback();
    };
    waits.set(tag, whenDefined(registry, tag, onDefined));
  };
  const waitInside = (element: Element) => {
    wait(element);
    for (const each of element.querySelectorAll(':not(:defined)')) wait(each);
  };
  const observer = new view.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === node.ELEMENT_NODE) waitInside(node as Element);
      }
    }
    if (records.some(isRelevant)) callback();
  });
  observer.observe(host, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['data-element', 'data-key', 'data-text-value', 'class'],
  });
  for (const each of host.querySelectorAll(':not(:defined)')) wait(each);
  return () => {
    observer.disconnect();
    for (const stop of waits.values()) stop();
    waits.clear();
  };
}
