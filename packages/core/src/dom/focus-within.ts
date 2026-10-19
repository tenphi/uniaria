/*
 * Portions adapted from React Spectrum (useFocusWithin.ts):
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
 * Focus within one part (`docs/_internal/interaction-layer.md` §4), after React
 * Aria's `useFocusWithin`: true while the part or anything inside it has focus,
 * unchanged while focus moves between descendants. Several parts watched
 * together count as one, so focus moving between them stays within: a
 * combo box's input and its popup, which no rendered element need hold.
 *
 * It listens on the part elements themselves rather than through part
 * handlers, so it sees focus on descendants that are parts of their own in
 * both adapters. Browsers fire no `focusout` when the focused element is
 * removed, so while focused within, a document `focusin` outside the parts
 * ends it too. Focus within is visible, as `createFocus`'s is, when the
 * last focus inside came by keyboard or assistive technology.
 */

import { isFocusVisibleKey, modalityTrackerFor } from './modality';
import type { InteractionContext } from './types';
import { partEffect } from './types';

export interface FocusWithinOptions {
  /** The part to watch, or several watched as one. */
  readonly part: string | readonly string[];
  isDisabled?(): boolean;
}

export interface FocusWithin {
  isFocusWithin(): boolean;
  /** Focus within came by keyboard or assistive technology. */
  isFocusVisible(): boolean;
}

export function createFocusWithin(
  ctx: InteractionContext,
  options: FocusWithinOptions,
): FocusWithin {
  const isFocusWithin = ctx.state(false);
  const isFocusVisible = ctx.state(false);
  const parts =
    typeof options.part === 'string' ? [options.part] : options.part;
  /** The watched parts' elements, as they attach. */
  const elements = new Set<Element>();
  const isInside = (node: Node | null) =>
    node !== null && [...elements].some((element) => element.contains(node));

  let stopListening: (() => void) | undefined;
  const begin = (element: Element) => {
    const document = element.ownerDocument;
    const tracker = modalityTrackerFor(element);
    isFocusWithin.set(true);
    isFocusVisible.set(tracker?.isFocusVisible() ?? true);
    if (stopListening) return;
    // Focus landed outside without a focusout (the focused node was removed).
    const onDocumentFocusIn = (event: FocusEvent) => {
      if (!isInside(event.target as Node)) ctx.batch(end);
    };
    document.addEventListener('focusin', onDocumentFocusIn, true);
    const unsubscribe = tracker?.subscribe((modality, event) => {
      if (!isFocusWithin.get() || !isFocusVisibleKey(event)) return;
      ctx.batch(() => isFocusVisible.set(modality !== 'pointer'));
    });
    stopListening = () => {
      document.removeEventListener('focusin', onDocumentFocusIn, true);
      unsubscribe?.();
    };
  };
  const end = () => {
    stopListening?.();
    stopListening = undefined;
    isFocusWithin.set(false);
    isFocusVisible.set(false);
  };

  for (const part of parts) {
    partEffect(ctx, part, (element) => {
      const document = element.ownerDocument;
      const tracker = modalityTrackerFor(element);
      const onFocusIn = (event: FocusEvent) => {
        if (options.isDisabled?.()) return;
        // An earlier handler may already have moved focus on.
        if (event.target !== document.activeElement) return;
        // Focus moving inside keeps focus within, and may change how it came.
        if (isFocusWithin.get()) {
          ctx.batch(() =>
            isFocusVisible.set(tracker?.isFocusVisible() ?? true),
          );
          return;
        }
        ctx.batch(() => begin(element));
      };
      const onFocusOut = (event: FocusEvent) => {
        if (!isFocusWithin.get()) return;
        if (isInside(event.relatedTarget as Node | null)) return;
        ctx.batch(end);
      };
      elements.add(element);
      element.addEventListener('focusin', onFocusIn);
      element.addEventListener('focusout', onFocusOut);
      if (
        !isFocusWithin.get() &&
        !options.isDisabled?.() &&
        element.contains(document.activeElement)
      ) {
        begin(element);
      }
      return () => {
        elements.delete(element);
        element.removeEventListener('focusin', onFocusIn);
        element.removeEventListener('focusout', onFocusOut);
        if (!isInside(document.activeElement)) end();
      };
    });
  }

  if (options.isDisabled) {
    ctx.watch(options.isDisabled, (isDisabled) => {
      if (isDisabled) {
        isFocusWithin.set(false);
        isFocusVisible.set(false);
      }
    });
  }

  return {
    isFocusWithin: () => isFocusWithin.get(),
    isFocusVisible: () => isFocusVisible.get(),
  };
}
