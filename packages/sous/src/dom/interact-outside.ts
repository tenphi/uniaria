/*
 * Portions adapted from React Spectrum (useInteractOutside.ts):
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
 * Presses outside an element (`docs/interaction-layer.md` §6), after React
 * Aria's `useInteractOutside`: a primary-button `pointerdown` outside starts
 * one, and the `click` that follows, also outside, completes it. Completing
 * on `click` rather than `pointerup` sidesteps an Android Chrome bug
 * (Chromium 40732224). Both listen on the document in the capture phase, so
 * they run before anything at the target.
 *
 * Keyboard and focus never count. A target removed from the document by the
 * time its event arrives (a menu item that unmounts on press) doesn't count
 * either, and a press that began before the listener existed is ignored.
 *
 * Unlike React Aria, nothing is stopped: the outside element still gets its
 * events, as with the browser's own popover light dismiss.
 */

export interface InteractOutsideHandlers {
  /** The press started outside, on `pointerdown`. */
  onStart?(event: PointerEvent): void;
  /** The press completed outside, on `click`. */
  onInteract?(event: MouseEvent): void;
}

function isOutside(element: Element, event: Event): boolean {
  const target = event.target as Node | null;
  if (!target?.isConnected) return false;
  return !event.composedPath().includes(element);
}

/** Listens for presses outside `element`; returns the function that stops. */
export function interactOutside(
  element: Element,
  handlers: InteractOutsideHandlers,
): () => void {
  const document = element.ownerDocument;
  let isPointerDown = false;

  const onPointerDown = (event: PointerEvent) => {
    isPointerDown = event.button === 0 && isOutside(element, event);
    if (isPointerDown) handlers.onStart?.(event);
  };

  const onClick = (event: MouseEvent) => {
    const wasPointerDown = isPointerDown;
    isPointerDown = false;
    if (!wasPointerDown || event.button !== 0) return;
    if (isOutside(element, event)) handlers.onInteract?.(event);
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onClick, true);
  };
}
