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
 * Covers keyboard, mouse, pen and touch pointers, virtual clicks, disabled
 * behavior, `touch-action`, text-selection suppression during touch presses
 * and nested pressables.
 *
 * Nested pressables: only the innermost one handles a press. UniAria can't stop
 * propagation, and the element adapter's capture-phase delegation shows an
 * outer instance the event before an inner one, so every pressable element
 * joins a per-window registry (`Symbol.for`) and a pressable ignores events
 * whose target sits inside a nearer one. That works in any order.
 *
 * Order on activation: `pressstart`, `pressend`, `press`. A cancelled press
 * fires `pressstart` and `pressend` only.
 */

import { isMac } from './platform';
import { disableTextSelection, restoreTextSelection } from './text-selection';
import type { DomHandlers, InteractionContext } from './types';
import { partEffect, partElement } from './types';

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
  /** The keydown, when Meta was held on a Mac (see `onKeyUp`). */
  readonly metaKeyDown?: KeyboardEvent;
  /** The pointer is over the target. */
  isOver: boolean;
  /** Released over the target; `press` fires on the click that follows. */
  isAwaitingClick: boolean;
}

/**
 * `manipulation` is equivalent, but it stops Safari from sending
 * `pointercancel` when a scroll takes over (WebKit bug 240917).
 */
const TOUCH_ACTION = 'pan-x pan-y pinch-zoom';

/** iOS and Android drop the click after a long press; wait this long for it. */
const CLICK_TIMEOUT = 80;

const PRESSABLES = Symbol.for('@uniaria/pressables/v1');

type PressableWindow = Window & { [PRESSABLES]?: WeakSet<Element> };

/** Every pressable element in a window, shared by copies of UniAria. */
function pressablesFor(view: Window): WeakSet<Element> {
  return ((view as PressableWindow)[PRESSABLES] ??= new WeakSet());
}

/**
 * The event happened inside `target` and not inside a pressable nested in
 * it, which handles the event itself.
 */
function isOwnEvent(event: Event, target: HTMLElement): boolean {
  const view = target.ownerDocument.defaultView;
  const pressables = view ? pressablesFor(view) : null;
  let node = event.target as Node | null;
  for (; node && node !== target; node = node.parentNode) {
    if (pressables?.has(node as Element)) return false;
  }
  return node === target;
}

function isMacElement(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  return view !== null && isMac(view);
}

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
 * Where the browser's own activation does something UniAria can't do itself
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
  // The element whose text selection a touch press turned off.
  let unselectable: HTMLElement | null = null;

  const element = () => partElement(ctx, options.part);

  const removeListeners = () => {
    for (const remove of listeners.splice(0)) remove();
  };

  const reset = () => {
    removeListeners();
    clearTimeout(clickTimer);
    active = null;
    if (unselectable) restoreTextSelection(unselectable);
    unselectable = null;
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
    extra: {
      pointerId?: number;
      key?: string;
      metaKeyDown?: KeyboardEvent;
    } = {},
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
    // macOS sends no keyup for other keys while Meta is held (Chromium
    // 1393524, WebKit 55291, Mozilla 1299553): releasing Meta stands in for
    // them, as in React Aria.
    if (event.key === 'Meta' && active.metaKeyDown) {
      target.dispatchEvent(new KeyboardEvent('keyup', active.metaKeyDown));
      return;
    }
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
  // Registers the part as a pressable for nesting, and sets the one
  // behavioral style UniAria ships (Button spec, resolved question 4):
  // no double-tap zoom delay, and a scroll cancels the press. An inline
  // value the consumer set wins.
  partEffect(ctx, options.part, (target) => {
    const view = target.ownerDocument.defaultView;
    const pressables = view ? pressablesFor(view) : null;
    pressables?.add(target);
    const hasOwnTouchAction = target.style.touchAction !== '';
    if (!hasOwnTouchAction) target.style.touchAction = TOUCH_ACTION;
    return () => {
      pressables?.delete(target);
      if (!hasOwnTouchAction && target.style.touchAction === TOUCH_ACTION) {
        target.style.removeProperty('touch-action');
      }
    };
  });

  const handlers: DomHandlers = {
    keydown(event) {
      const target = element();
      if (!target || !isOwnEvent(event, target)) return;
      if (!isPressKey(event, target)) return;
      if (options.isDisabled()) {
        event.preventDefault();
        return;
      }
      if (!hasNativeActivation(target)) event.preventDefault();
      if (event.repeat || active) return;
      begin('keyboard', event, {
        key: event.key,
        ...(event.metaKey && isMacElement(target)
          ? { metaKeyDown: event }
          : {}),
      });
      listen(target.ownerDocument, 'keyup', onKeyUp, true);
    },
    keyup(event) {
      const target = element();
      if (!target || !options.isDisabled() || !isOwnEvent(event, target)) {
        return;
      }
      if (isPressKey(event, target)) event.preventDefault();
    },
    pointerdown(event) {
      const target = element();
      if (!target || event.button !== 0) return;
      if (!isOwnEvent(event, target)) return;
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
      // A long press would select the label and the text around it.
      if (event.pointerType === 'touch') {
        disableTextSelection(target);
        unselectable = target;
      }
      begin((event.pointerType || 'mouse') as PointerType, event, {
        pointerId: event.pointerId,
      });
      const doc = target.ownerDocument;
      listen(doc, 'pointerup', onPointerUp, false);
      listen(doc, 'pointercancel', onPointerCancel, false);
    },
    mousedown(event) {
      const target = element();
      if (!target || !isOwnEvent(event, target)) return;
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
      if (!target || !isOwnEvent(event, target)) return;
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

export interface ItemPressOptions {
  /** The element of a pressable item, from its key. */
  element(key: string): HTMLElement | null;
  isDisabled(key: string): boolean;
  onPressStart?(key: string, event: PressEvent): void;
  onPressEnd?(key: string, event: PressEvent): void;
  onPress?(key: string, event: PressEvent): void;
}

export interface ItemPress {
  /** The item being pressed while the pointer is over it, or `null`. */
  pressedKey(): string | null;
  /** Handlers for one item's part. */
  handlers(key: string): DomHandlers;
}

/**
 * Press for the items of a collection (Listbox spec, Pointer and touch): one
 * press at a time across every item, for mouse, pen, touch and virtual
 * clicks, activating when it ends on the item it started on. The collection
 * handles keys itself, so there is no keyboard press. A pointer press
 * focuses the item, which needs a `tabindex`.
 */
export function createItemPress(
  ctx: InteractionContext,
  options: ItemPressOptions,
): ItemPress {
  const pressedKey = ctx.state<string | null>(null);
  let active: (Active & { key: string; target: HTMLElement }) | null = null;
  const listeners: (() => void)[] = [];
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let unselectable: HTMLElement | null = null;

  const reset = () => {
    for (const remove of listeners.splice(0)) remove();
    clearTimeout(clickTimer);
    active = null;
    if (unselectable) restoreTextSelection(unselectable);
    unselectable = null;
  };

  const listen = <K extends keyof DocumentEventMap>(
    doc: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
  ) => {
    const batched = (event: DocumentEventMap[K]) =>
      ctx.batch(() => listener(event));
    doc.addEventListener(type, batched);
    listeners.push(() => doc.removeEventListener(type, batched));
  };

  const pressEvent = (
    type: PressEvent['type'],
    target: HTMLElement,
    pointerType: PointerType,
    source?: Event,
  ): PressEvent => {
    const rect = target.getBoundingClientRect();
    const input = source as MouseEvent | undefined;
    const hasPosition =
      pointerType !== 'virtual' && input !== undefined && 'clientX' in input;
    return {
      type,
      pointerType,
      target,
      shiftKey: input?.shiftKey ?? false,
      ctrlKey: input?.ctrlKey ?? false,
      metaKey: input?.metaKey ?? false,
      altKey: input?.altKey ?? false,
      x: hasPosition ? input.clientX - rect.left : rect.width / 2,
      y: hasPosition ? input.clientY - rect.top : rect.height / 2,
    };
  };

  const begin = (
    key: string,
    target: HTMLElement,
    pointerType: PointerType,
    source: Event,
    pointerId?: number,
  ) => {
    active = {
      key,
      target,
      pointerType,
      ...(pointerId === undefined ? {} : { pointerId }),
      isOver: true,
      isAwaitingClick: false,
    };
    pressedKey.set(key);
    options.onPressStart?.(
      key,
      pressEvent('pressstart', target, pointerType, source),
    );
  };

  const finish = (shouldActivate: boolean, source?: Event) => {
    const current = active;
    if (!current) return;
    reset();
    const { key, target, pointerType } = current;
    if (pressedKey.get() !== null) {
      pressedKey.set(null);
      options.onPressEnd?.(
        key,
        pressEvent('pressend', target, pointerType, source),
      );
    }
    if (shouldActivate) {
      options.onPress?.(key, pressEvent('press', target, pointerType, source));
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointerId) return;
    if (event.button !== 0) return;
    const { target } = active;
    if (active.isOver && target.contains(event.target as Node)) {
      // As `createPress`: activate on the click that follows, or click
      // ourselves when a long press loses it.
      for (const remove of listeners.splice(0)) remove();
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

  ctx.effect(() => () => {
    reset();
    pressedKey.set(null);
  });

  return {
    pressedKey: () => pressedKey.get(),
    handlers: (key) => ({
      pointerdown(event) {
        const target = options.element(key);
        if (!target || event.button !== 0 || !isOwnEvent(event, target)) {
          return;
        }
        if (options.isDisabled(key) || active) return;
        if (target.ownerDocument.activeElement !== target) {
          target.focus({ preventScroll: true });
        }
        const origin = event.target as Element;
        if (origin.hasPointerCapture?.(event.pointerId)) {
          origin.releasePointerCapture(event.pointerId);
        }
        if (event.pointerType === 'touch') {
          disableTextSelection(target);
          unselectable = target;
        }
        begin(
          key,
          target,
          (event.pointerType || 'mouse') as PointerType,
          event,
          event.pointerId,
        );
        const doc = target.ownerDocument;
        listen(doc, 'pointerup', onPointerUp);
        listen(doc, 'pointercancel', onPointerCancel);
      },
      pointerenter(event) {
        if (active?.key !== key || active.pointerId !== event.pointerId) return;
        if (active.isOver || active.isAwaitingClick) return;
        active.isOver = true;
        pressedKey.set(key);
        options.onPressStart?.(
          key,
          pressEvent('pressstart', active.target, active.pointerType, event),
        );
      },
      pointerleave(event) {
        if (active?.key !== key || active.pointerId !== event.pointerId) return;
        if (!active.isOver || active.isAwaitingClick) return;
        active.isOver = false;
        pressedKey.set(null);
        options.onPressEnd?.(
          key,
          pressEvent('pressend', active.target, active.pointerType, event),
        );
      },
      dragstart() {
        if (active?.key === key) finish(false);
      },
      click(event) {
        const target = options.element(key);
        if (!target || !isOwnEvent(event, target)) return;
        if (options.isDisabled(key)) {
          event.preventDefault();
          return;
        }
        if (active) {
          if (active.key === key && active.isAwaitingClick) {
            finish(true, event);
          }
          return;
        }
        if (isVirtualClick(event)) {
          begin(key, target, 'virtual', event);
          finish(true, event);
        }
      },
    }),
  };
}
