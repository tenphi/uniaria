/**
 * Focus an overlay gives back as it closes, marked so a tooltip doesn't
 * open for it (Tooltip spec, Resolved questions 8; Cube UI Kit's CUB-4839:
 * a popover closed with Escape would otherwise pop up its trigger's
 * tooltip). The mark is a window property under
 * `Symbol.for('@uniaria/restoring-focus/v1')`, so every copy of UniAria on a
 * page sees it, and it holds only while `focus()` runs: focus events fire
 * during the call.
 */

const RESTORING = Symbol.for('@uniaria/restoring-focus/v1');

/** Focuses `element` as focus restoration. */
export function restoreFocus(
  element: HTMLElement,
  options?: FocusOptions,
): void {
  const view = element.ownerDocument.defaultView;
  if (!view) return element.focus(options);
  const previous: unknown = Reflect.get(view, RESTORING);
  Reflect.set(view, RESTORING, element);
  try {
    element.focus(options);
  } finally {
    Reflect.set(view, RESTORING, previous);
  }
}

/** Whether focus is moving to `element` as focus restoration right now. */
export function isRestoringFocus(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  return view !== null && Reflect.get(view, RESTORING) === element;
}
