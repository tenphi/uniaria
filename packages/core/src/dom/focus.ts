/**
 * Focus state for one part: `isFocused` follows `focusin` and `focusout` on
 * the part itself, not its descendants. `isFocusVisible` adds the shared
 * modality tracker (`./modality.ts`), as React Aria's `useFocusRing` does:
 * it is read when focus arrives and updated by later input while the part
 * keeps focus, so pressing a key after a click shows the ring.
 *
 * `createPressFocus` makes a pointer press focus a native checkbox or radio
 * in every browser (owner, 2026-10-24), as `createPress` focuses a
 * pressable.
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

/**
 * HTML's interactive content: a press on it doesn't activate the `label`
 * around it.
 */
const INTERACTIVE =
  'a[href], audio[controls], button, details, embed, iframe, img[usemap], ' +
  'input:not([type="hidden"]), select, textarea, video[controls]';

/**
 * Whether a press on `target` activates `control` through a `label`: the
 * nearest `label` around it labels the control, and no interactive content
 * sits between them.
 */
function isLabelActivation(target: EventTarget | null, control: Element) {
  let node = target as Element | null;
  if (typeof node?.matches !== 'function') return false;
  for (; node; node = node.parentElement) {
    if (node.localName === 'label') {
      return (node as HTMLLabelElement).control === control;
    }
    if (node.matches(INTERACTIVE)) return false;
  }
  return false;
}

/**
 * Handlers that focus a native control a pointer presses, on the control
 * itself or on a `label` that activates it: Chromium focuses a clicked
 * checkbox or radio, WebKit and Firefox on macOS don't, following the
 * platform. Focus comes as the press ends, as React Aria's `useToggle` gives
 * it on a label press: before the click toggles the control, so the state
 * focus writes can't undo the toggle, and after WebKit's `mousedown`, which
 * takes focus from a control it doesn't focus. Keys, scripts and screen
 * readers press nothing, and the pointer keeps the new focus from being
 * visible. A press on the control whose `mousedown` is prevented moves no
 * focus, as in Chromium, where a `label` still focuses it. Put the handlers
 * on every part a press reaches the control through.
 */
export function createPressFocus(
  ctx: InteractionContext,
  part: string,
): { readonly handlers: DomHandlers } {
  // The press under way, and its `mousedown`, read once that dispatch is
  // over, so a listener after this one may still prevent it.
  let press: PointerEvent | null = null;
  let mouseDown: MouseEvent | null = null;
  const listeners: (() => void)[] = [];

  const end = () => {
    for (const remove of listeners.splice(0)) remove();
    press = null;
    mouseDown = null;
  };

  const activates = (target: EventTarget | null, control: HTMLElement) =>
    target === control || isLabelActivation(target, control);

  // The press may end anywhere, so the document hears it, as in
  // `createPress`; the path's first node is the target in a shadow root.
  const start = (event: PointerEvent, doc: Document) => {
    press = event;
    const listen = <K extends keyof DocumentEventMap>(
      type: K,
      listener: (event: DocumentEventMap[K]) => void,
    ) => {
      doc.addEventListener(type, listener);
      listeners.push(() => doc.removeEventListener(type, listener));
    };
    listen('mousedown', (mouseEvent) => {
      mouseDown = mouseEvent;
    });
    listen('pointerup', (upEvent) => {
      if (upEvent.pointerId !== press?.pointerId) return;
      const isPrevented = mouseDown?.defaultPrevented === true;
      end();
      const control = partElement(ctx, part);
      const target = upEvent.composedPath()[0] ?? null;
      if (!control || !activates(target, control)) return;
      if (isPrevented && target === control) return;
      if (control.ownerDocument.activeElement === control) return;
      control.focus({ preventScroll: true });
    });
    listen('pointercancel', (cancelEvent) => {
      if (cancelEvent.pointerId === press?.pointerId) end();
    });
  };

  ctx.effect(() => end);

  return {
    handlers: {
      pointerdown(event) {
        // Every part on the press's path hears it; the first starts it.
        if (event === press) return;
        end();
        const control = partElement(ctx, part);
        if (control && event.button === 0 && activates(event.target, control)) {
          start(event, control.ownerDocument);
        }
      },
    },
  };
}
