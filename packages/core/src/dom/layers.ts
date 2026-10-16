/*
 * Portions adapted from React Spectrum (useOverlay.ts):
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
 * The dismissable layer stack (`docs/interaction-layer.md` §7), after React
 * Aria's `useOverlay`. Every open layer (popover, dialog, menu) joins one
 * stack per window, stored under `Symbol.for` so copies of UniAria share it:
 *
 * - Escape, with focus inside, not repeated, not composing, no modifiers,
 *   closes the top layer only. Holding Escape closes one layer. The layer
 *   prevents the default, and a layer below skips an Escape whose default
 *   was prevented, which is how nesting works without `stopPropagation` (a
 *   widget inside that handles Escape itself, such as a combobox closing its
 *   list, prevents it too).
 * - A press outside closes every layer it is outside of, from the top down,
 *   stopping at a layer that holds it (Popover spec, Resolved questions 9).
 *   A modal layer (a modal dialog) closes only when it is on top and shields
 *   the layers below it. The layers are those open at `pointerdown`; they
 *   close on the `click`, and the press still reaches its target (see
 *   `./interact-outside.ts`). One pair of document listeners per window
 *   serves every layer.
 * - Focus moving outside, when it should close on blur, unless focus went
 *   nowhere (switching tabs; VoiceOver's Ctrl+Option+Arrow in Chrome) or
 *   into a layer above (a submenu placed elsewhere).
 * - When a layer closes, the layers above it that it holds, or whose source
 *   (the trigger that opened them) it holds, close too, with reason
 *   `'parent'`: a popover inside a hidden one would otherwise stay open.
 *
 * A layer never closes itself: it calls `onDismiss` with the reason, and the
 * component sets its open state.
 */

import { isComposing } from './events';
import { isPressOutside } from './interact-outside';
import type { InteractionContext } from './types';
import { partEffect } from './types';

export type DismissReason = 'escape' | 'outside' | 'blur' | 'parent';

export interface LayerOptions {
  /** The layer's part, such as a popover's content. */
  readonly part: string;
  isOpen(): boolean;
  /** A press outside closes the layer. */
  isDismissable?(): boolean;
  /** Escape leaves the layer open. */
  isKeyboardDismissDisabled?(): boolean;
  /** Focus moving outside, to `next`, closes the layer. */
  shouldCloseOnBlur?(next: Element): boolean;
  /** Whether a press outside on `target` may close the layer. */
  shouldCloseOnInteractOutside?(target: Element): boolean;
  /**
   * A modal layer: a press outside closes it only when it is on top, and
   * never reaches the layers below it.
   */
  isModal?(): boolean;
  /**
   * The element that opened the layer, such as a popover's trigger. A layer
   * below that holds it closes this one along with itself.
   */
  source?(): Element | null;
  onDismiss(reason: DismissReason): void;
}

export interface Layer {
  /**
   * A press that started outside will close the layer when it completes,
   * so focus the press moves outside is no reason to pull it back.
   */
  isClosingPress(): boolean;
}

interface Entry {
  readonly element: HTMLElement;
  readonly options: LayerOptions;
  dismiss(reason: DismissReason): void;
}

interface Stack {
  readonly entries: Entry[];
  /** The layers the press in progress will close, top down. */
  pressed: Entry[] | null;
  stopListening: (() => void) | null;
}

const KEY = Symbol.for('@uniaria/layers/v1');

type StackWindow = Window & { [KEY]?: Stack };

function stackFor(view: Window): Stack {
  return ((view as StackWindow)[KEY] ??= {
    entries: [],
    pressed: null,
    stopListening: null,
  });
}

function isEscape(event: KeyboardEvent): boolean {
  return (
    event.key === 'Escape' &&
    !event.repeat &&
    !isComposing(event) &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  );
}

/** Whether a press outside on `target` may close the layer. */
function mayClose(entry: Entry, target: Element): boolean {
  const { options } = entry;
  return (
    (options.isDismissable?.() ?? false) &&
    options.shouldCloseOnInteractOutside?.(target) !== false
  );
}

/**
 * Top down, the layers a press is outside of, up to a layer that holds it
 * or a modal one, which counts only on top.
 */
function layersOutside(entries: readonly Entry[], event: Event): Entry[] {
  const outside: Entry[] = [];
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (!isPressOutside(entry.element, event)) break;
    if (entry.options.isModal?.()) {
      if (index === entries.length - 1) outside.push(entry);
      break;
    }
    outside.push(entry);
  }
  return outside;
}

/** The window's press listeners, while any layer is open. */
function listen(view: Window, stack: Stack): () => void {
  const { document } = view;
  let timeout = 0;

  const onPointerDown = (event: PointerEvent) => {
    view.clearTimeout(timeout);
    const target = event.target as Element;
    stack.pressed =
      event.button === 0
        ? layersOutside(stack.entries, event).filter((entry) =>
            mayClose(entry, target),
          )
        : null;
  };

  // A mouse click follows its pointerup in the same task; a press that
  // ends without one closes nothing.
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    timeout = view.setTimeout(() => {
      stack.pressed = null;
    });
  };

  const onClick = (event: MouseEvent) => {
    const pressed = stack.pressed;
    stack.pressed = null;
    if (!pressed || event.button !== 0) return;
    const target = event.target as Element;
    for (const entry of pressed) {
      if (!stack.entries.includes(entry)) continue;
      if (!isPressOutside(entry.element, event)) continue;
      if (mayClose(entry, target)) entry.dismiss('outside');
    }
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('click', onClick, true);
  return () => {
    view.clearTimeout(timeout);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('click', onClick, true);
  };
}

/** Whether `element` is the topmost open layer in its window. */
export function isTopLayer(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  const entries = view ? stackFor(view).entries : [];
  return entries[entries.length - 1]?.element === element;
}

/** Puts a part on the layer stack while `isOpen()` holds. */
export function createLayer(
  ctx: InteractionContext,
  options: LayerOptions,
): Layer {
  let current: { readonly stack: Stack; readonly entry: Entry } | null = null;

  const open = (element: HTMLElement) => {
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    const stack = stackFor(view);
    const entry: Entry = {
      element,
      options,
      dismiss: (reason) => ctx.batch(() => options.onDismiss(reason)),
    };
    stack.entries.push(entry);
    stack.stopListening ??= listen(view, stack);
    current = { stack, entry };
    const isTop = () => stack.entries[stack.entries.length - 1] === entry;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEscape(event) || event.defaultPrevented || !isTop()) return;
      if (options.isKeyboardDismissDisabled?.()) return;
      event.preventDefault();
      entry.dismiss('escape');
    };

    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Element | null;
      if (!next || element.contains(next)) return;
      if (!options.shouldCloseOnBlur?.(next)) return;
      const above = stack.entries.slice(stack.entries.indexOf(entry) + 1);
      if (above.some((layer) => layer.element.contains(next))) return;
      entry.dismiss('blur');
    };

    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('focusout', onFocusOut);
      current = null;
      const index = stack.entries.indexOf(entry);
      const above = index === -1 ? [] : stack.entries.slice(index + 1);
      if (index !== -1) stack.entries.splice(index, 1);
      if (stack.entries.length === 0) {
        stack.stopListening?.();
        stack.stopListening = null;
        stack.pressed = null;
      }
      // Stopping or swapping elements while open closes no one.
      if (options.isOpen()) return;
      for (const layer of above.reverse()) {
        if (!stack.entries.includes(layer) || !layer.options.source) continue;
        const source = layer.options.source();
        if (
          element.contains(layer.element) ||
          (source !== null && element.contains(source))
        ) {
          layer.dismiss('parent');
        }
      }
    };
  };

  partEffect(ctx, options.part, open, options.isOpen);

  return {
    isClosingPress: () =>
      current?.stack.pressed?.includes(current.entry) ?? false,
  };
}
