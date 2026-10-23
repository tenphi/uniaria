/*
 * Portions adapted from React Spectrum (useHover.ts):
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
 * Hover for one part, modelled on React Aria's `useHover`
 * (`references/react-spectrum/packages/react-aria/src/interactions/useHover.ts`).
 *
 * - Starts on pointer enter for mouse and pen only: touch has no hover.
 * - Ignores the mouse enter iOS emulates after a tap (within 500 ms of a
 *   touch pointer up, from the shared modality tracker).
 * - Never starts while disabled, and ends when the part becomes disabled or
 *   the instance stops.
 * - Checks containment rather than the exact target: React hands over the
 *   native `pointerover` and `pointerout` behind its enter and leave events.
 *   When the pointer moves between two React elements, React builds both
 *   from the one `pointerout`, so the entered node is its `relatedTarget`.
 * - While hovered, a document `pointerover` that lands outside the part ends
 *   hover too: a part that is removed or shrinks under a still pointer gets
 *   no `pointerleave`.
 */

import { modalityTrackerFor } from './modality';
import type { DomHandlers, InteractionContext } from './types';
import { elementEffect, partElement } from './types';

export interface HoverOptions {
  /**
   * The hoverable part, or a function naming it now: Button's frame while
   * one is rendered, else its root (items spec, Extras).
   */
  readonly part: string | (() => string);
  isDisabled(): boolean;
}

export interface Hover {
  isHovered(): boolean;
  /** Handlers for the hoverable part. */
  readonly handlers: DomHandlers;
  /**
   * Handlers for one of the parts `part` may name, which act only while it
   * names that one. A part gets its handlers on every render: React binds
   * only the events of its first.
   */
  handlersFor(part: string): DomHandlers;
}

/** The node the pointer entered (see the module notes on React). */
function enteredNode(event: PointerEvent): Node | null {
  return (
    event.type === 'pointerout' ? event.relatedTarget : event.target
  ) as Node | null;
}

export function createHover(
  ctx: InteractionContext,
  options: HoverOptions,
): Hover {
  const isHovered = ctx.state(false);
  let stopTracking: (() => void) | undefined;
  const currentPart = () =>
    typeof options.part === 'string' ? options.part : options.part();
  const hoverable = () => partElement(ctx, currentPart());

  const end = () => {
    stopTracking?.();
    stopTracking = undefined;
    isHovered.set(false);
  };

  const start = (event: PointerEvent) => {
    const element = hoverable();
    if (
      !element?.contains(enteredNode(event)) ||
      event.pointerType === 'touch' ||
      isHovered.get() ||
      options.isDisabled()
    ) {
      return;
    }
    if (
      event.pointerType === 'mouse' &&
      modalityTrackerFor(element)?.isEmulatingMouse()
    ) {
      return;
    }
    isHovered.set(true);
    const document = element.ownerDocument;
    const onPointerOver = (over: PointerEvent) => {
      if (!element.contains(over.target as Node | null)) ctx.batch(end);
    };
    document.addEventListener('pointerover', onPointerOver, true);
    stopTracking = () =>
      document.removeEventListener('pointerover', onPointerOver, true);
  };

  ctx.watch(options.isDisabled, (isDisabled) => {
    if (isDisabled) end();
  });
  ctx.effect(() => end);
  // Started early, so it has seen the tap before iOS's emulated mouse enter.
  elementEffect(ctx, hoverable, (element) => {
    modalityTrackerFor(element);
  });
  // Another hoverable part, such as a frame rendered later: hover starts
  // over again there.
  ctx.watch(hoverable, () => end());

  // React passes the native pointerover and pointerout behind its enter
  // and leave events, so the target may be a descendant.
  const leave = (event: PointerEvent) => {
    const element = hoverable();
    if (element?.contains(event.target as Node | null)) end();
  };

  return {
    isHovered: () => isHovered.get(),
    handlers: { pointerenter: start, pointerleave: leave },
    handlersFor: (part) => ({
      pointerenter(event) {
        if (currentPart() === part) start(event);
      },
      pointerleave(event) {
        if (currentPart() === part) leave(event);
      },
    }),
  };
}
