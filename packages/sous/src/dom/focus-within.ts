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
 * Focus within one part (`docs/interaction-layer.md` §4), after React Aria's
 * `useFocusWithin`: true while the part or anything inside it has focus,
 * unchanged while focus moves between descendants.
 *
 * It listens on the part element itself rather than through part handlers,
 * so it sees focus on descendants that are parts of their own in both
 * adapters. Browsers fire no `focusout` when the focused element is
 * removed, so while focused within, a document `focusin` outside the part
 * ends it too. Focus within is visible, as `createFocus`'s is, when the
 * last focus inside came by keyboard or assistive technology.
 */

import { isFocusVisibleKey, modalityTrackerFor } from './modality';
import type { InteractionContext } from './types';
import { partEffect } from './types';

export interface FocusWithinOptions {
  /** The part to watch. */
  readonly part: string;
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

  partEffect(ctx, options.part, (element) => {
    const document = element.ownerDocument;
    const tracker = modalityTrackerFor(element);
    let unsubscribe: (() => void) | undefined;
    const begin = () => {
      isFocusWithin.set(true);
      isFocusVisible.set(tracker?.isFocusVisible() ?? true);
      document.addEventListener('focusin', onDocumentFocusIn, true);
      unsubscribe ??= tracker?.subscribe((modality, event) => {
        if (!isFocusWithin.get() || !isFocusVisibleKey(event)) return;
        ctx.batch(() => isFocusVisible.set(modality !== 'pointer'));
      });
    };
    const end = () => {
      document.removeEventListener('focusin', onDocumentFocusIn, true);
      unsubscribe?.();
      unsubscribe = undefined;
      isFocusWithin.set(false);
      isFocusVisible.set(false);
    };
    // Focus landed outside without a focusout (the focused node was removed).
    const onDocumentFocusIn = (event: FocusEvent) => {
      if (!element.contains(event.target as Node)) ctx.batch(end);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (options.isDisabled?.()) return;
      // An earlier handler may already have moved focus on.
      if (event.target !== document.activeElement) return;
      // Focus moving inside keeps focus within, and may change how it came.
      if (isFocusWithin.get()) {
        ctx.batch(() => isFocusVisible.set(tracker?.isFocusVisible() ?? true));
        return;
      }
      ctx.batch(begin);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isFocusWithin.get()) return;
      if (element.contains(event.relatedTarget as Node | null)) return;
      ctx.batch(end);
    };
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    if (!options.isDisabled?.() && element.contains(document.activeElement)) {
      begin();
    }
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      end();
    };
  });

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
