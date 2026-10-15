/**
 * Finding part elements inside a custom-element host (design decision 8):
 * `data-part` elements with no other host between them and this one, so a
 * nested instance keeps its own parts. Another host is a nested Sous element
 * of any kind, or one of the same tag. A nested Sous element can itself be a
 * part of the outer host. Parts added later are picked up by observing the
 * host.
 */

/**
 * Marks a custom-element class as a Sous host, so hosts around its elements
 * leave their parts alone. `Symbol.for`, so every copy of Sous on a page
 * agrees.
 */
export const SOUS_HOST: unique symbol = Symbol.for(
  '@tenphi/sous/host',
) as never;

/**
 * True for an element whose tag is defined as a Sous host. A tag defined
 * later counts from then on.
 */
function isSousHost(element: Element): boolean {
  if (!element.localName.includes('-')) return false;
  const registry = element.ownerDocument.defaultView?.customElements;
  const host = registry?.get(element.localName) as
    { readonly [SOUS_HOST]?: boolean } | undefined;
  return host?.[SOUS_HOST] === true;
}

/** No other host stands between `element` and `host`. */
function belongsTo(element: Element, host: Element): boolean {
  for (
    let node = element.parentElement;
    node && node !== host;
    node = node.parentElement
  ) {
    if (node.localName === host.localName || isSousHost(node)) return false;
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

/** Calls `callback` whenever parts may have been added, removed or renamed. */
export function observeParts(host: Element, callback: () => void): () => void {
  const view = host.ownerDocument.defaultView;
  if (!view) return () => undefined;
  const observer = new view.MutationObserver(callback);
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-part'],
  });
  return () => observer.disconnect();
}
