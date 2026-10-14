/*
 * Portions adapted from React Spectrum (useFocusVisible.ts, useHover.ts):
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
 * Input modality, shared by every instance in a window: whether the user last
 * used a keyboard, a pointer, or assistive technology (`virtual`: a
 * screen-reader click, or focus that arrives with no input before it, as
 * when VoiceOver moves focus or iOS's form arrows do). Focus is visible unless
 * the last input was a pointer. Modelled on React Aria's `useFocusVisible`
 * (`references/react-spectrum/packages/react-aria/src/interactions/useFocusVisible.ts`).
 *
 * There is one tracker per window, stored on the window under a `Symbol.for`
 * key so that every copy of Sous on a page shares it. It starts listening
 * when the first interaction asks for it and never stops, so the modality is
 * already known when the next instance mounts.
 *
 * Like React Aria, the tracker wraps `HTMLElement.prototype.focus` (once per
 * window, calling the original): a script's `focus()` call is not input, and
 * without the wrapper it would look like a screen reader moving focus.
 */

import { isVirtualClick } from './press';

export type Modality = 'keyboard' | 'pointer' | 'virtual';

/** The event that changed the modality; `null` when set explicitly. */
export type ModalityEvent = KeyboardEvent | PointerEvent | FocusEvent | null;

export interface ModalityTracker {
  /** The last input modality; `null` before any input. */
  get(): Modality | null;
  /**
   * Sets the modality explicitly, as a widget that moves virtual focus with
   * the arrow keys does, and notifies listeners.
   */
  set(modality: Modality): void;
  /** Focus should look visible: the last input was not a pointer. */
  isFocusVisible(): boolean;
  /**
   * A touch pointer went up in the last 500 ms, so a mouse event now is the
   * one iOS emulates after a tap.
   */
  isEmulatingMouse(): boolean;
  /**
   * Called on keyboard input, pointer down, focus with no input before it,
   * and `set()`. Pointer moves change the modality without notifying, so a
   * visible focus ring stays until the next press.
   */
  subscribe(
    listener: (modality: Modality, event: ModalityEvent) => void,
  ): () => void;
}

/** The window property; part of the contract between copies of Sous. */
const KEY = Symbol.for('@tenphi/sous/modality/v1');

/** iOS emulates mouse events this long after a touch ends. */
const EMULATED_MOUSE_WINDOW = 500;

/** Only Tab and Escape make focus visible while a text field has it. */
const TEXT_INPUT_KEYS = new Set(['Tab', 'Escape']);

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'button',
  'submit',
  'reset',
]);

type TrackerWindow = Window & { [KEY]?: ModalityTracker };

/** The modality tracker for a window, created on first use. */
export function modalityTracker(view: Window): ModalityTracker {
  const host = view as TrackerWindow;
  return (host[KEY] ??= createTracker(view));
}

/** The tracker for the window an element belongs to. */
export function modalityTrackerFor(element: Element): ModalityTracker | null {
  const view = element.ownerDocument.defaultView;
  return view ? modalityTracker(view) : null;
}

/**
 * Whether a keyboard event should make focus visible: typing into a text
 * field does not, except Tab and Escape.
 */
export function isFocusVisibleKey(
  event: ModalityEvent,
  isTextInput = false,
): boolean {
  if (!event || (event.type !== 'keydown' && event.type !== 'keyup')) {
    return true;
  }
  const active = (event.target as Node | null)?.ownerDocument?.activeElement;
  const isTyping = isTextInput || (active != null && isTextField(active));
  return !isTyping || TEXT_INPUT_KEYS.has((event as KeyboardEvent).key);
}

function isTextField(element: Element): boolean {
  if (element.localName === 'input') {
    return !NON_TEXT_INPUT_TYPES.has((element as HTMLInputElement).type);
  }
  return (
    element.localName === 'textarea' ||
    (element as HTMLElement).isContentEditable
  );
}

function createTracker(view: Window): ModalityTracker {
  const document = view.document;
  const listeners = new Set<
    (modality: Modality, event: ModalityEvent) => void
  >();
  let modality: Modality | null = null;
  // Input arrived since the last focus event, so that focus is not virtual.
  let hasInputBeforeFocus = false;
  // The window lost focus; the browser restores focus when it comes back.
  let hasBlurredWindow = false;
  let lastTouchUp = -Infinity;
  const isMac = /^Mac/i.test(view.navigator.platform);

  const notify = (next: Modality, event: ModalityEvent) => {
    modality = next;
    for (const listener of [...listeners]) listener(next, event);
  };

  // Modifier keys alone (as when switching back to the tab with a shortcut)
  // are not keyboard navigation. Option types characters on a Mac.
  const isNavigationKey = (event: KeyboardEvent) =>
    !(
      event.metaKey ||
      (!isMac && event.altKey) ||
      event.ctrlKey ||
      event.key === 'Control' ||
      event.key === 'Shift' ||
      event.key === 'Meta'
    );

  const onKey = (event: KeyboardEvent) => {
    hasInputBeforeFocus = true;
    if (isNavigationKey(event)) notify('keyboard', event);
  };

  const onPointer = (event: PointerEvent) => {
    if (event.type === 'pointerup' && event.pointerType === 'touch') {
      lastTouchUp = view.performance.now();
    }
    if (event.type === 'pointerdown') {
      hasInputBeforeFocus = true;
      notify('pointer', event);
      return;
    }
    modality = 'pointer';
  };

  const onClick = (event: MouseEvent) => {
    if (!isVirtualClick(event)) return;
    hasInputBeforeFocus = true;
    modality = 'virtual';
  };

  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    // Coming back to the window: the browser restores focus itself. Safari
    // fires the window and element focus pair twice, so re-arm every time.
    if (target === view) {
      hasBlurredWindow = true;
      return;
    }
    // Firefox focuses the window and then the document on the first click
    // into an iframe.
    if (target === document || !event.isTrusted) return;
    if (!hasInputBeforeFocus && !hasBlurredWindow) notify('virtual', event);
    hasInputBeforeFocus = false;
    hasBlurredWindow = false;
  };

  // Tabbing out of the window fires no focus event to reset the flags.
  const onWindowBlur = () => {
    hasInputBeforeFocus = false;
    hasBlurredWindow = true;
  };

  // A forms library that focuses the first invalid field on submit.
  const onInvalid = () => {
    const active = document.activeElement;
    queueMicrotask(() => {
      if (document.activeElement !== active) notify('keyboard', null);
    });
  };

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('keyup', onKey, true);
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('pointermove', onPointer, true);
  document.addEventListener('pointerup', onPointer, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('invalid', onInvalid, true);
  // On the window, so it runs before listeners on the document.
  view.addEventListener('focus', onFocus, true);
  view.addEventListener('blur', onWindowBlur);

  const prototype = (view as Window & typeof globalThis).HTMLElement.prototype;
  const focus = prototype.focus;
  Object.defineProperty(prototype, 'focus', {
    configurable: true,
    writable: true,
    value: function (this: HTMLElement, options?: FocusOptions) {
      hasInputBeforeFocus = true;
      focus.call(this, options);
    },
  });

  return {
    get: () => modality,
    set: (next) => notify(next, null),
    isFocusVisible: () => modality !== 'pointer',
    isEmulatingMouse: () =>
      view.performance.now() - lastTouchUp < EMULATED_MOUSE_WINDOW,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
