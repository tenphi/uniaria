/**
 * Focus state for one part: `isFocused` follows `focusin` and `focusout` on
 * the part itself, not its descendants. `isFocusVisible` adds the shared
 * modality tracker (`./modality.ts`), as React Aria's `useFocusRing` does:
 * it is read when focus arrives and updated by later input while the part
 * keeps focus, so pressing a key after a click shows the ring.
 */

import { isFocusVisibleKey, modalityTrackerFor } from './modality';
import type { DomHandlers, InteractionContext } from './types';
import { partEffect, partElement } from './types';

export interface FocusOptions {
  /**
   * The part is a text field even if it doesn't look like one, so typing
   * into it doesn't make focus visible.
   */
  isTextInput?(): boolean;
}

export interface Focus {
  isFocused(): boolean;
  /** Focused, and the last input was a keyboard or assistive technology. */
  isFocusVisible(): boolean;
  readonly handlers: DomHandlers;
}

export function createFocus(
  ctx: InteractionContext,
  part: string,
  options: FocusOptions = {},
): Focus {
  const isFocused = ctx.state(false);
  const isFocusVisible = ctx.state(false);
  // Subscribed only while focused, so input elsewhere costs nothing.
  let unsubscribe: (() => void) | undefined;

  const enter = (element: HTMLElement) => {
    const tracker = modalityTrackerFor(element);
    isFocused.set(true);
    isFocusVisible.set(tracker?.isFocusVisible() ?? true);
    unsubscribe ??= tracker?.subscribe((modality, event) => {
      if (!isFocusVisibleKey(event, options.isTextInput?.())) return;
      ctx.batch(() => isFocusVisible.set(modality !== 'pointer'));
    });
  };

  const leave = () => {
    unsubscribe?.();
    unsubscribe = undefined;
    isFocused.set(false);
    isFocusVisible.set(false);
  };

  // Starting the tracker here means it has seen the input by the time focus
  // arrives. The part may already have focus (autofocus); before any input
  // the modality is unknown and focus counts as visible.
  partEffect(ctx, part, (element) => {
    modalityTrackerFor(element);
    if (element.ownerDocument.activeElement === element) enter(element);
    return leave;
  });

  return {
    isFocused: () => isFocused.get(),
    isFocusVisible: () => isFocusVisible.get(),
    handlers: {
      focusin(event) {
        const element = partElement(ctx, part);
        if (element && event.target === element) enter(element);
      },
      focusout(event) {
        if (event.target === partElement(ctx, part)) leave();
      },
    },
  };
}
