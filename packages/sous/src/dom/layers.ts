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
 * stack per window, stored under `Symbol.for` so copies of Sous share it,
 * and only the topmost layer reacts:
 *
 * - Escape, with focus inside, not repeated, not composing, no modifiers.
 *   Holding Escape closes one layer. The layer prevents the default, and a
 *   layer below skips an Escape whose default was prevented, which is how
 *   nesting works without `stopPropagation` (a widget inside that handles
 *   Escape itself, such as a combobox closing its list, prevents it too).
 * - A press outside, when dismissable: the layer that was on top at
 *   `pointerdown` closes on the `click`, and the press still reaches its
 *   target (see `./interact-outside.ts`).
 * - Focus moving outside, when it should close on blur, unless focus went
 *   nowhere (switching tabs; VoiceOver's Ctrl+Option+Arrow in Chrome) or
 *   into a layer above (a submenu placed elsewhere).
 *
 * A layer never closes itself: it calls `onDismiss` with the reason, and the
 * component sets its open state.
 */

import { isComposing } from './events';
import { interactOutside } from './interact-outside';
import type { InteractionContext } from './types';
import { partEffect } from './types';

export type DismissReason = 'escape' | 'outside' | 'blur';

export interface LayerOptions {
  /** The layer's part, such as a popover's content. */
  readonly part: string;
  isOpen(): boolean;
  /** A press outside closes the layer. */
  isDismissable?(): boolean;
  /** Escape leaves the layer open. */
  isKeyboardDismissDisabled?(): boolean;
  /** Focus moving outside closes the layer. */
  shouldCloseOnBlur?(): boolean;
  /** Whether a press outside on `target` may close the layer. */
  shouldCloseOnInteractOutside?(target: Element): boolean;
  onDismiss(reason: DismissReason): void;
}

interface Entry {
  readonly element: HTMLElement;
}

const KEY = Symbol.for('@tenphi/sous/layers/v1');

type StackWindow = Window & { [KEY]?: Entry[] };

function stackFor(view: Window): Entry[] {
  return ((view as StackWindow)[KEY] ??= []);
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

/** Whether `element` is the topmost open layer in its window. */
export function isTopLayer(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  const stack = view ? stackFor(view) : [];
  return stack[stack.length - 1]?.element === element;
}

/** Puts a part on the layer stack while `isOpen()` holds. */
export function createLayer(
  ctx: InteractionContext,
  options: LayerOptions,
): void {
  const open = (element: HTMLElement) => {
    const view = element.ownerDocument.defaultView;
    if (!view) return;
    const stack = stackFor(view);
    const entry: Entry = { element };
    stack.push(entry);
    const isTop = () => stack[stack.length - 1] === entry;
    const dismiss = (reason: DismissReason) =>
      ctx.batch(() => options.onDismiss(reason));

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEscape(event) || event.defaultPrevented || !isTop()) return;
      if (options.isKeyboardDismissDisabled?.()) return;
      event.preventDefault();
      dismiss('escape');
    };

    let wasTopAtStart = false;
    const stopOutside = interactOutside(element, {
      onStart() {
        wasTopAtStart = isTop();
      },
      onInteract(event) {
        const wasTop = wasTopAtStart;
        wasTopAtStart = false;
        if (!wasTop || !options.isDismissable?.()) return;
        const target = event.target as Element;
        if (options.shouldCloseOnInteractOutside?.(target) === false) return;
        dismiss('outside');
      },
    });

    const onFocusOut = (event: FocusEvent) => {
      if (!options.shouldCloseOnBlur?.()) return;
      const next = event.relatedTarget as Node | null;
      if (!next || element.contains(next)) return;
      const above = stack.slice(stack.indexOf(entry) + 1);
      if (above.some((layer) => layer.element.contains(next))) return;
      dismiss('blur');
    };

    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('focusout', onFocusOut);
      stopOutside();
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
    };
  };

  partEffect(ctx, options.part, open, options.isOpen);
}
