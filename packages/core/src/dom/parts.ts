/**
 * Finding part elements inside a custom-element host (design decision 8):
 * `data-part` elements with no other host between them and this one, so a
 * nested instance keeps its own parts. Another host is a nested UniAria element
 * of any kind, or one of the same tag. A nested UniAria element can itself be a
 * part of the outer host. Parts added later are picked up by observing the
 * host.
 */

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

/** The first element for each of `parts` that belongs to `host`. */
export function queryParts(
  host: Element,
  parts: readonly string[],
): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  for (const element of host.querySelectorAll<HTMLElement>('[data-part]')) {
    const part = element.getAttribute('data-part')!;
    if (found.has(part) || !parts.includes(part)) continue;
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
  for (const element of host.querySelectorAll<HTMLElement>('[data-part]')) {
    const part = element.getAttribute('data-part')!;
    if (!parts.includes(part) || !belongsTo(element, host)) continue;
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

/** Calls `callback` whenever parts may have been added, removed or renamed. */
export function observeParts(host: Element, callback: () => void): () => void {
  const view = host.ownerDocument.defaultView;
  if (!view) return () => undefined;
  const observer = new view.MutationObserver(callback);
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-part', 'data-key'],
  });
  return () => observer.disconnect();
}
