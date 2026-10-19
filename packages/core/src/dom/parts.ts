/**
 * Finding part elements inside a custom-element host (design decision 8) by
 * their markers (root AGENTS.md → Part markers): the root by its
 * `uni-<name>` class, every other part by its `data-element`. Only elements
 * with no other host between them and this one count, so a nested instance
 * keeps its own parts. Another host is a nested UniAria element of any kind,
 * or one of the same tag. A nested UniAria element can itself be a part of
 * the outer host. Parts added later are picked up by observing the host.
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
  const registry = element.ownerDocument.defaultView?.customElements;
  const host = registry?.get(element.localName) as
    { readonly [UNI_HOST]?: boolean } | undefined;
  return host?.[UNI_HOST] === true;
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
 * added, removed or renamed. A change of `class` counts only when it adds or
 * removes the root's class, so a consumer's class toggles cost no rescan.
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
  const observer = new view.MutationObserver((records) => {
    const relevant = records.some(
      (record) =>
        record.attributeName !== 'class' ||
        hadRoot(record.oldValue) !==
          (record.target as Element).classList.contains(root),
    );
    if (relevant) callback();
  });
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['data-element', 'data-key', 'class'],
  });
  return () => observer.disconnect();
}
