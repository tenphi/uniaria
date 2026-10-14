/*
 * Portions adapted from React Spectrum (usePress.ts, isVirtualEvent.ts):
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
 * Press: one `press` event for mouse, pen, keyboard and screen-reader clicks
 * (Button spec → Keyboard, Pointer and touch). Modelled on React Aria's
 * `usePress` (`references/react-spectrum/packages/react-aria/src/interactions/usePress.ts`).
 *
 * This is the phase 1 press: keyboard, mouse and pen, virtual clicks and
 * disabled behavior. Touch (text-selection suppression, emulated mouse
 * events) and nested pressables arrive with the interaction layer in
 * phase 2.
 *
 * Order on activation: `pressstart`, `pressend`, `press`. A cancelled press
 * fires `pressstart` and `pressend` only.
 */

import type { DomHandlers, InteractionContext } from './types';
import { partElement } from './types';

export type PointerType = 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';

export interface PressEvent {
  readonly type: 'pressstart' | 'pressend' | 'press';
  readonly pointerType: PointerType;
  /** The pressable part. */
  readonly target: Element;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  /** Keyboard presses only. */
  readonly key?: string;
  /** Relative to the target; its centre when the press has no coordinates. */
  readonly x: number;
  readonly y: number;
}

export interface PressOptions {
  /** The pressable part. */
  readonly part: string;
  isDisabled(): boolean;
  /** A pointer press leaves focus where it was. */
  shouldPreventFocusOnPress?(): boolean;
  onPressStart?(event: PressEvent): void;
  onPressEnd?(event: PressEvent): void;
  onPress?(event: PressEvent): void;
}

export interface Press {
  /** A press is active and releasing now would activate. */
  isPressed(): boolean;
  /** Handlers for the pressable part. */
  readonly handlers: DomHandlers;
}

interface Active {
  readonly pointerType: PointerType;
  readonly pointerId?: number;
  readonly key?: string;
  /** The pointer is over the target. */
  isOver: boolean;
  /** Released over the target; `press` fires on the click that follows. */
  isAwaitingClick: boolean;
}

/** iOS and Android drop the click after a long press; wait this long for it. */
const CLICK_TIMEOUT = 80;

/**
 * A click with no pointer behind it: `element.click()`, or a screen reader
 * activating the element (React Aria's `isVirtualClick`).
 */
export function isVirtualClick(event: MouseEvent): boolean {
  const { mozInputSource } = event as MouseEvent & { mozInputSource?: number };
  if (mozInputSource === 0 && event.isTrusted) return true;
  return event.detail === 0 && !(event as PointerEvent).pointerType;
}

function isLink(element: Element): boolean {
  const role = element.getAttribute('role');
  return (
    role === 'link' ||
    (!role && element.localName === 'a' && element.hasAttribute('href'))
  );
}

/** Enter and Space press buttons; links take only Enter, text fields neither. */
function isPressKey(event: KeyboardEvent, element: HTMLElement): boolean {
  if (event.key !== 'Enter' && event.key !== ' ') return false;
  if (element.localName === 'textarea' || element.isContentEditable) {
    return false;
  }
  if (element.localName === 'input') {
    const { type } = element as HTMLInputElement;
    const isTextField = !['button', 'submit', 'reset', 'image'].includes(type);
    if (isTextField) return false;
  }
  return !isLink(element) || event.key === 'Enter';
}

/**
 * Where the browser's own activation does something Sous can't do itself
 * (submit, reset, follow a link), keyboard events are left alone and the
 * native click that follows is ignored. Everywhere else the native activation
 * is prevented.
 */
function hasNativeActivation(element: HTMLElement): boolean {
  if (isLink(element)) return true;
  if (element.localName !== 'button' && element.localName !== 'input') {
    return false;
  }
  return ['submit', 'reset', 'image'].includes(
    (element as HTMLButtonElement).type,
  );
}

export function createPress(
  ctx: InteractionContext,
  options: PressOptions,
): Press {
  const isPressed = ctx.state(false);
  let active: Active | null = null;
  let shouldIgnoreClick = false;
  const listeners: (() => void)[] = [];
  let clickTimer: ReturnType<typeof setTimeout> | undefined;

  const element = () => partElement(ctx, options.part);

  const removeListeners = () => {
    for (const remove of listeners.splice(0)) remove();
  };

  const reset = () => {
    removeListeners();
    clearTimeout(clickTimer);
    active = null;
  };

  const listen = <K extends keyof DocumentEventMap>(
    doc: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    isCapture: boolean,
  ) => {
    // Document listeners run outside part handlers, so batch them here.
    const batched = (event: DocumentEventMap[K]) =>
      ctx.batch(() => listener(event));
    doc.addEventListener(type, batched, isCapture);
    listeners.push(() => doc.removeEventListener(type, batched, isCapture));
  };

  const pressEvent = (
    type: PressEvent['type'],
    pointerType: PointerType,
    source?: Event,
  ): PressEvent => {
    const target = element()!;
    const rect = target.getBoundingClientRect();
    const input = source as (MouseEvent & KeyboardEvent) | undefined;
    const hasPosition =
      pointerType !== 'keyboard' &&
      pointerType !== 'virtual' &&
      input !== undefined &&
      'clientX' in input;
    return {
      type,
      pointerType,
      target,
      shiftKey: input?.shiftKey ?? false,
      ctrlKey: input?.ctrlKey ?? false,
      metaKey: input?.metaKey ?? false,
      altKey: input?.altKey ?? false,
      ...(pointerType === 'keyboard' && input?.key !== undefined
        ? { key: input.key }
        : {}),
      x: hasPosition ? input.clientX - rect.left : rect.width / 2,
      y: hasPosition ? input.clientY - rect.top : rect.height / 2,
    };
  };

  const begin = (
    pointerType: PointerType,
    source: Event,
    extra: { pointerId?: number; key?: string } = {},
  ) => {
    active = { pointerType, isOver: true, isAwaitingClick: false, ...extra };
    isPressed.set(true);
    options.onPressStart?.(pressEvent('pressstart', pointerType, source));
  };

  /** Ends the active press: `pressend` if still pressed, then `press`. */
  const finish = (shouldActivate: boolean, source?: Event) => {
    const current = active;
    if (!current) return;
    reset();
    if (isPressed.get()) {
      isPressed.set(false);
      options.onPressEnd?.(pressEvent('pressend', current.pointerType, source));
    }
    if (shouldActivate) {
      options.onPress?.(pressEvent('press', current.pointerType, source));
    }
  };

  /** Swallows the native click a keyboard activation may still produce. */
  const ignoreNextClick = () => {
    shouldIgnoreClick = true;
    setTimeout(() => {
      shouldIgnoreClick = false;
    }, 0);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const target = element();
    if (!active || active.pointerType !== 'keyboard' || !target) return;
    if (event.key !== active.key) return;
    if (!hasNativeActivation(target)) event.preventDefault();
    const isInside = target.contains(event.target as Node);
    if (isInside) ignoreNextClick();
    finish(isInside, event);
  };

  const onPointerUp = (event: PointerEvent) => {
    const target = element();
    if (!active || event.pointerId !== active.pointerId) return;
    if (event.button !== 0) return;
    if (target && active.isOver && target.contains(event.target as Node)) {
      // Activate on the click that follows, so `press` lines up with native
      // click semantics. If none comes, click ourselves.
      removeListeners();
      active.isAwaitingClick = true;
      clickTimer = setTimeout(() => {
        if (active?.isAwaitingClick) target.click();
      }, CLICK_TIMEOUT);
    } else {
      finish(false, event);
    }
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (active && event.pointerId === active.pointerId) finish(false, event);
  };

  // Becoming disabled cancels the press; leaving the document drops it.
  ctx.watch(options.isDisabled, (isDisabled) => {
    if (isDisabled) finish(false);
  });
  ctx.effect(() => () => {
    reset();
    isPressed.set(false);
  });

  const handlers: DomHandlers = {
    keydown(event) {
      const target = element();
      if (!target || !target.contains(event.target as Node)) return;
      if (!isPressKey(event, target)) return;
      if (options.isDisabled()) {
        event.preventDefault();
        return;
      }
      if (!hasNativeActivation(target)) event.preventDefault();
      if (event.repeat || active) return;
      begin('keyboard', event, { key: event.key });
      listen(target.ownerDocument, 'keyup', onKeyUp, true);
    },
    keyup(event) {
      const target = element();
      if (!target || !options.isDisabled()) return;
      if (isPressKey(event, target)) event.preventDefault();
    },
    pointerdown(event) {
      const target = element();
      if (!target || event.button !== 0) return;
      if (!target.contains(event.target as Node)) return;
      if (options.isDisabled() || active) return;
      if (
        !options.shouldPreventFocusOnPress?.() &&
        target.ownerDocument.activeElement !== target
      ) {
        target.focus({ preventScroll: true });
      }
      // Touch pointers are captured by the element they start on; release the
      // capture so leaving the target fires pointerleave.
      const origin = event.target as Element;
      if (origin.hasPointerCapture?.(event.pointerId)) {
        origin.releasePointerCapture(event.pointerId);
      }
      begin((event.pointerType || 'mouse') as PointerType, event, {
        pointerId: event.pointerId,
      });
      const doc = target.ownerDocument;
      listen(doc, 'pointerup', onPointerUp, false);
      listen(doc, 'pointercancel', onPointerCancel, false);
    },
    mousedown(event) {
      if (event.button === 0 && options.shouldPreventFocusOnPress?.()) {
        event.preventDefault();
      }
    },
    pointerenter(event) {
      if (!active || active.pointerId !== event.pointerId) return;
      if (active.isOver || active.isAwaitingClick) return;
      active.isOver = true;
      isPressed.set(true);
      options.onPressStart?.(
        pressEvent('pressstart', active.pointerType, event),
      );
    },
    pointerleave(event) {
      if (!active || active.pointerId !== event.pointerId) return;
      if (!active.isOver || active.isAwaitingClick) return;
      active.isOver = false;
      isPressed.set(false);
      options.onPressEnd?.(pressEvent('pressend', active.pointerType, event));
    },
    dragstart() {
      // Safari sends no pointercancel when a drag takes over.
      finish(false);
    },
    click(event) {
      const target = element();
      if (!target || !target.contains(event.target as Node)) return;
      if (options.isDisabled()) {
        event.preventDefault();
        return;
      }
      if (shouldIgnoreClick) {
        shouldIgnoreClick = false;
        return;
      }
      if (active) {
        // A keyboard press ignores the native click it causes (Enter on
        // links and submit buttons); a pointer press activates on its click.
        if (active.isAwaitingClick) finish(true, event);
        return;
      }
      if (isVirtualClick(event)) {
        begin('virtual', event);
        finish(true, event);
      }
    },
  };

  return { isPressed: () => isPressed.get(), handlers };
}
