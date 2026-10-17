/**
 * Whether an element is scrolled out of view, for overlays that close once
 * their anchor is (Popover spec, Resolved questions 10; Tooltip spec,
 * Resolved questions 9).
 */

import type { InteractionContext } from './types';
import { elementEffect } from './types';

/**
 * Whether any of `element` shows: inside the viewport and every scrolling
 * box around it. An IntersectionObserver reports it only at the next
 * rendering update, after a scroll that already happened.
 */
export function isInView(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const box = element.getBoundingClientRect();
  let { left, top, right, bottom } = box;
  const clip = (rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }) => {
    left = Math.max(left, rect.left);
    top = Math.max(top, rect.top);
    right = Math.min(right, rect.right);
    bottom = Math.min(bottom, rect.bottom);
  };
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      clip(node.getBoundingClientRect());
    }
    if (style.position === 'fixed') break;
  }
  const { clientWidth, clientHeight } = element.ownerDocument.documentElement;
  clip({ left: 0, top: 0, right: clientWidth, bottom: clientHeight });
  return right > left && bottom > top;
}

/**
 * Calls `onLeave` when the element `read()` returns, once seen, is scrolled
 * out of view; `read()` returns `null` while there is nothing to watch.
 */
export function watchLeavingView(
  ctx: InteractionContext,
  read: () => HTMLElement | null,
  onLeave: () => void,
): void {
  elementEffect(ctx, read, (element) => {
    const view = element.ownerDocument.defaultView;
    if (!view || typeof view.IntersectionObserver !== 'function') return;
    let wasVisible = isInView(element);
    const observer = new view.IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) wasVisible = true;
        else if (wasVisible) onLeave();
      },
      { root: element.ownerDocument },
    );
    observer.observe(element);
    return () => observer.disconnect();
  });
}
