/*
 * Portions adapted from React Spectrum (usePreventScroll.ts, domHelpers.ts):
 * Copyright 2020 Adobe. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR REPRESENTATIONS OF ANY KIND, either express or implied. See
 * the License for the specific language governing permissions and limitations
 * under the License.
 */

/**
 * Scroll lock (`docs/_internal/interaction-layer.md` §8), after React Aria's
 * `usePreventScroll`.
 *
 * - Everywhere: `overflow: hidden` on `<html>`, and when a classic scrollbar
 *   disappears with it, `scrollbar-gutter: stable` (or padding of the
 *   scrollbar's width where that is unsupported) so the page doesn't shift.
 * - iOS scrolls the page anyway: when the toolbars are collapsed, when the
 *   on-screen keyboard covers part of it, and whenever focus moves to an
 *   input. There, `<html>` keeps only `overflow: hidden`, which code that
 *   scrolls items into view reads as a lock, and while the lock holds:
 *   - A touch that would scroll the page is prevented: one that starts
 *     outside any scroller that overflows, or in one that stopped
 *     overflowing. Pinch-zoom, sliders and adjusting a text selection are
 *     left alone.
 *   - A constructed stylesheet sets `overscroll-behavior: contain` on every
 *     element, inside an anonymous `@layer` so any consumer rule wins, so a
 *     scroller at its end doesn't hand the scroll to the page. WebKit needs
 *     it before the touch starts, so it can't be set per touch.
 *   - `focus()` never scrolls the page. Unless called with `preventScroll`,
 *     it scrolls the element into view within its own scroll parents once
 *     the on-screen keyboard has opened or closed (§8.11).
 *   - Focus moving to a text field goes through `focus()` again, so the
 *     field is scrolled that way rather than by the browser; focus moving
 *     to nothing, as the keyboard's Done button does, goes to the nearest
 *     ancestor with `tabindex` (§8.12-13).
 *
 * Locks are counted per window under a `Symbol.for` key, shared by copies of
 * UniAria: the page unlocks when the last lock is released, in any order, and
 * the inline values that were there before come back exactly, priority
 * included. The `focus()` wrapper is installed once per window, the first
 * time iOS locks, and calls the original whenever no lock holds; restoring
 * the original would drop any wrapper installed after it, like the modality
 * tracker's.
 */

import { isFocusable } from './focusable';
import { isIOS } from './platform';
import type { InteractionContext } from './types';
import { partEffect } from './types';

const KEY = Symbol.for('@uniaria/scroll-lock/v1');

/**
 * Per-window state. Its shape is the contract between copies of UniAria, so
 * changing it needs a new key.
 */
interface LockState {
  count: number;
  restore: () => void;
  /** The iOS `focus()` wrapper is installed in this window. */
  hasFocusWrapper: boolean;
  /** The wrapper keeps `focus()` from scrolling the page. */
  shouldOverrideFocus: boolean;
}

type LockWindow = Window & typeof globalThis & { [KEY]?: LockState };

/** The keyboard counts as open when it covers this much of the viewport. */
const KEYBOARD_HEIGHT = 100;

/** How long to wait for the keyboard to open or close (`keyboard.tsx`). */
const KEYBOARD_TIMEOUT = 600;

const OVERSCROLL_RULE = '@layer { * { overscroll-behavior: contain; } }';

/** Input types that don't bring up the on-screen keyboard. */
const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'button',
  'submit',
  'reset',
]);

/** Sets an inline style property; returns what puts the previous one back. */
function setStyle(element: HTMLElement, property: string, value: string) {
  const { style } = element;
  const previous = style.getPropertyValue(property);
  const priority = style.getPropertyPriority(property);
  style.setProperty(property, value);
  return () => {
    if (previous) style.setProperty(property, previous, priority);
    else style.removeProperty(property);
  };
}

function lockPage(view: LockWindow, state: LockState): () => void {
  return isIOS(view) ? lockPageIOS(view, state) : lockPageStandard(view);
}

function lockPageStandard(view: Window): () => void {
  const root = view.document.documentElement;
  const scrollbarWidth = view.innerWidth - root.clientWidth;
  const restores: (() => void)[] = [];
  if (scrollbarWidth > 0) {
    // The gutter also keeps fixed-position elements in place.
    restores.push(
      'scrollbarGutter' in root.style
        ? setStyle(root, 'scrollbar-gutter', 'stable')
        : setStyle(root, 'padding-right', `${scrollbarWidth}px`),
    );
  }
  restores.push(setStyle(root, 'overflow', 'hidden'));
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

function lockPageIOS(view: LockWindow, state: LockState): () => void {
  const { document } = view;
  const root = document.documentElement;
  const restoreOverflow = setStyle(root, 'overflow', 'hidden');

  const sheet = new view.CSSStyleSheet();
  sheet.replaceSync(OVERSCROLL_RULE);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  // Where the current touch would scroll, and whether it may move at all.
  let scrollable: Element = root;
  let allowsTouchMove = false;

  const onTouchStart = (event: TouchEvent) => {
    const target = event.target as Element;
    scrollable = isScrollable(target, true)
      ? target
      : scrollParent(target, true);
    allowsTouchMove = isRange(event) || isAdjustingSelection(target);
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2 || allowsTouchMove) return;
    if (
      scrollable === root ||
      scrollable === document.body ||
      scrollable === document.scrollingElement ||
      // Stopped overflowing since the touch started: overscroll-behavior
      // fails for an element that doesn't overflow (WebKit 243452).
      (scrollable.scrollHeight === scrollable.clientHeight &&
        scrollable.scrollWidth === scrollable.clientWidth)
    ) {
      event.preventDefault();
    }
  };

  const onBlur = (event: FocusEvent) => {
    const next = event.relatedTarget as Element | null;
    if (next) {
      // Focus it again through the wrapper, which scrolls it within its
      // scroll parents before the browser scrolls the page to it.
      if (willOpenKeyboard(next)) (next as HTMLElement).focus();
      return;
    }
    // The keyboard's Done button. Without a focused element here, a later
    // tap on the same field would fire no blur and get the browser's scroll.
    const target = event.target as Element;
    target.parentElement
      ?.closest<HTMLElement>('[tabindex]')
      ?.focus({ preventScroll: true });
  };

  const listen = { capture: true, passive: false };
  document.addEventListener('touchstart', onTouchStart, listen);
  document.addEventListener('touchmove', onTouchMove, listen);
  document.addEventListener('blur', onBlur, true);
  installFocusWrapper(view, state);
  state.shouldOverrideFocus = true;

  return () => {
    state.shouldOverrideFocus = false;
    document.removeEventListener('touchstart', onTouchStart, listen);
    document.removeEventListener('touchmove', onTouchMove, listen);
    document.removeEventListener('blur', onBlur, true);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (adopted) => adopted !== sheet,
    );
    restoreOverflow();
  };
}

function installFocusWrapper(view: LockWindow, state: LockState): void {
  if (state.hasFocusWrapper) return;
  state.hasFocusWrapper = true;
  const prototype = view.HTMLElement.prototype;
  const focus = prototype.focus;
  Object.defineProperty(prototype, 'focus', {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, options?: FocusOptions) {
      if (!state.shouldOverrideFocus) {
        focus.call(this, options);
        return;
      }
      focus.call(this, { ...options, preventScroll: true });
      if (options?.preventScroll) return;
      afterKeyboard(view, () => {
        if (this.ownerDocument.activeElement === this) scrollIntoView(this);
      });
    },
  });
}

/** A slider: its thumb moves with the touch. */
function isRange(event: TouchEvent): boolean {
  return event
    .composedPath()
    .some(
      (node) =>
        (node as Element).localName === 'input' &&
        (node as HTMLInputElement).type === 'range',
    );
}

/** The touch starts on selected text, or in a field with a selection. */
function isAdjustingSelection(target: Element): boolean {
  const selection = target.ownerDocument.defaultView?.getSelection();
  if (
    selection &&
    !selection.isCollapsed &&
    selection.containsNode(target, true)
  ) {
    return true;
  }
  const field = target as Partial<HTMLInputElement>;
  return (
    target.ownerDocument.activeElement === target &&
    field.selectionStart != null &&
    field.selectionEnd != null &&
    field.selectionStart < field.selectionEnd
  );
}

/** Whether focusing `element` brings up the on-screen keyboard. */
function willOpenKeyboard(element: Element | null): boolean {
  if (!element || !isFocusable(element)) return false;
  if (element.localName === 'textarea') return true;
  if (element.localName === 'input') {
    return !NON_TEXT_INPUT_TYPES.has((element as HTMLInputElement).type);
  }
  return (element as HTMLElement).isContentEditable === true;
}

/**
 * Whether the on-screen keyboard is open: it shrinks the visual viewport
 * but not the layout viewport. Scaling by the zoom keeps pinch-zoom out of
 * it.
 */
function isKeyboardOpen(view: Window): boolean {
  const viewport = view.visualViewport;
  if (!viewport) return false;
  const layoutHeight = view.document.documentElement.clientHeight;
  return layoutHeight - viewport.height * viewport.scale >= KEYBOARD_HEIGHT;
}

/**
 * Runs `callback` once the keyboard is open if a text field has focus, or
 * closed if not: two frames later if it already is, as focus may still
 * move, else on the visual viewport's resize, and after
 * `KEYBOARD_TIMEOUT` at the latest (an iPad with a hardware keyboard never
 * shows one).
 */
function afterKeyboard(view: Window, callback: () => void): void {
  const isSettled = () =>
    isKeyboardOpen(view) === willOpenKeyboard(view.document.activeElement);
  view.requestAnimationFrame(() => {
    view.requestAnimationFrame(() => {
      const viewport = view.visualViewport;
      if (!viewport || isSettled()) {
        callback();
        return;
      }
      const finish = () => {
        viewport.removeEventListener('resize', onResize);
        view.clearTimeout(timeout);
        callback();
      };
      const onResize = () => {
        if (isSettled()) finish();
      };
      viewport.addEventListener('resize', onResize);
      const timeout = view.setTimeout(finish, KEYBOARD_TIMEOUT);
    });
  });
}

/**
 * Whether `element` scrolls: its overflow is `auto` or `scroll`, or it is
 * the page's scrolling element and not `overflow: hidden`. With
 * `shouldOverflow`, its content must also overflow it.
 */
function isScrollable(element: Element, shouldOverflow = false): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  const root =
    element.ownerDocument.scrollingElement ??
    element.ownerDocument.documentElement;
  const isScroller =
    /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY) ||
    (element === root && style.overflow !== 'hidden');
  return (
    isScroller &&
    (!shouldOverflow ||
      element.scrollHeight !== element.clientHeight ||
      element.scrollWidth !== element.clientWidth)
  );
}

/** The nearest ancestor of `element` that scrolls, or the page's scroller. */
function scrollParent(element: Element, shouldOverflow = false): Element {
  let node = element.parentElement;
  while (node && !isScrollable(node, shouldOverflow)) node = node.parentElement;
  const document = element.ownerDocument;
  return node ?? document.scrollingElement ?? document.documentElement;
}

/**
 * Scrolls `target` into view in each scroll parent but the page, centred in
 * the part not covered by the keyboard (React Aria compares the bottom with
 * the target's own height, which reads as a slip).
 */
function scrollIntoView(target: Element): void {
  const document = target.ownerDocument;
  const view = document.defaultView;
  const root = document.scrollingElement ?? document.documentElement;
  for (
    let element: Element | null = target;
    element && element !== root && element.isConnected;
  ) {
    const scroller = scrollParent(element);
    if (scroller === document.documentElement || scroller === document.body) {
      return;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const viewport = view?.visualViewport;
    const bottom = viewport
      ? Math.min(scrollerRect.bottom, viewport.offsetTop + viewport.height)
      : scrollerRect.bottom;
    if (rect.top < scrollerRect.top || rect.bottom > bottom) {
      const offset =
        rect.top -
        scrollerRect.top -
        ((bottom - scrollerRect.top) / 2 - rect.height / 2);
      const maxTop = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTo({
        top: Math.max(0, Math.min(maxTop, scroller.scrollTop + offset)),
        behavior: 'smooth',
      });
    }
    element = scroller.parentElement;
  }
}

/** Locks scrolling of `document`'s page; returns the function that releases this lock. */
export function lockScroll(document: Document): () => void {
  const view = document.defaultView as LockWindow | null;
  if (!view) return () => undefined;
  const state = (view[KEY] ??= {
    count: 0,
    restore: () => undefined,
    hasFocusWrapper: false,
    shouldOverrideFocus: false,
  });
  if (state.count++ === 0) state.restore = lockPage(view, state);
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    if (--state.count === 0) state.restore();
  };
}

export interface ScrollLockOptions {
  /** Any part of the component; it locks that part's document. */
  readonly part: string;
  isActive(): boolean;
}

/** Locks the page's scrolling while `isActive()` holds, as a modal does. */
export function createScrollLock(
  ctx: InteractionContext,
  options: ScrollLockOptions,
): void {
  partEffect(
    ctx,
    options.part,
    (element) => lockScroll(element.ownerDocument),
    options.isActive,
  );
}
