/**
 * Finding part elements inside a custom-element host (design decision 8):
 * `data-part` elements whose nearest host of the same element is this one,
 * so a nested instance keeps its own parts. Parts added later are picked up
 * by observing the host.
 */

/** The first element for each of `parts` that belongs to `host`. */
export function queryParts(
  host: Element,
  parts: readonly string[],
): Map<string, HTMLElement> {
  const found = new Map<string, HTMLElement>();
  for (const element of host.querySelectorAll<HTMLElement>('[data-part]')) {
    const part = element.getAttribute('data-part')!;
    if (found.has(part) || !parts.includes(part)) continue;
    if (element.parentElement?.closest(host.localName) !== host) continue;
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
