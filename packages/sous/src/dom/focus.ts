/**
 * Focus state for one part: `isFocused` follows `focusin` and `focusout` on
 * the part itself, not its descendants. Focus-visible (the shared modality
 * tracker) arrives with the interaction layer in phase 2.
 */

import type { DomHandlers, InteractionContext } from './types';
import { partElement } from './types';

export interface Focus {
  isFocused(): boolean;
  readonly handlers: DomHandlers;
}

export function createFocus(ctx: InteractionContext, part: string): Focus {
  const isFocused = ctx.state(false);

  // The part may already have focus when the instance starts (autofocus).
  ctx.effect(() => {
    const element = partElement(ctx, part);
    isFocused.set(element?.ownerDocument.activeElement === element);
    return () => isFocused.set(false);
  });

  return {
    isFocused: () => isFocused.get(),
    handlers: {
      focusin(event) {
        if (event.target === partElement(ctx, part)) isFocused.set(true);
      },
      focusout(event) {
        if (event.target === partElement(ctx, part)) isFocused.set(false);
      },
    },
  };
}
