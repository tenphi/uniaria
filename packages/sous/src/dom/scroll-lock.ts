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
 * Scroll lock (`docs/interaction-layer.md` §8), the standard strategy of
 * React Aria's `usePreventScroll`: `overflow: hidden` on `<html>`, and when
 * a classic scrollbar disappears with it, `scrollbar-gutter: stable` (or
 * padding of the scrollbar's width where that is unsupported) so the page
 * doesn't shift.
 *
 * Locks are counted per window under a `Symbol.for` key, shared by copies of
 * Sous: the page unlocks when the last lock is released, in any order, and
 * the inline values that were there before come back exactly, priority
 * included.
 *
 * iOS needs more (§8.7-13: blocking touch scrolling outside scrollable
 * areas, an injected `overscroll-behavior` rule and focus that doesn't
 * scroll the page). That waits for an owner decision, since AGENTS.md
 * allows only `touch-action` as shipped CSS.
 */

import type { InteractionContext } from './types';
import { partEffect } from './types';

const KEY = Symbol.for('@tenphi/sous/scroll-lock/v1');

interface LockState {
  count: number;
  restore: () => void;
}

type LockWindow = Window & { [KEY]?: LockState };

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

function lockPage(view: Window): () => void {
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

/** Locks scrolling of `document`'s page; returns the function that releases this lock. */
export function lockScroll(document: Document): () => void {
  const view = document.defaultView as LockWindow | null;
  if (!view) return () => undefined;
  const state = (view[KEY] ??= { count: 0, restore: () => undefined });
  if (state.count++ === 0) state.restore = lockPage(view);
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
