import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import {
  isFocusVisibleKey,
  modalityTracker,
  modalityTrackerFor,
} from './modality';

// Captured before any tracker wraps it: calling it is focus with no input
// before it, as when a screen reader moves focus.
const nativeFocus = HTMLElement.prototype.focus;

function append<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = tag === 'input' ? '' : tag;
  document.body.append(element);
  return element;
}

function key(type: 'keydown' | 'keyup', name: string, init = {}) {
  const event = new KeyboardEvent(type, { key: name, bubbles: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('modalityTracker', () => {
  // First: no input reaches the tracker before it exists.
  it('starts with no modality, which counts as focus visible', () => {
    const tracker = modalityTracker(window);
    expect(tracker.get()).toBeNull();
    expect(tracker.isFocusVisible()).toBe(true);
  });

  it('is one tracker per window, shared under a global symbol', () => {
    const tracker = modalityTracker(window);
    expect(modalityTracker(window)).toBe(tracker);
    expect(modalityTrackerFor(document.body)).toBe(tracker);
    const key = Symbol.for('@uniaria/modality/v1');
    expect((window as unknown as Record<symbol, unknown>)[key]).toBe(tracker);
  });

  it('switches to keyboard on keys, but not on modifiers alone', () => {
    const tracker = modalityTracker(window);
    tracker.set('pointer');
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);

    key('keydown', 'Shift');
    key('keydown', 'Meta');
    key('keydown', 'c', { ctrlKey: true });
    expect(tracker.get()).toBe('pointer');
    expect(listener).not.toHaveBeenCalled();

    const event = key('keydown', 'ArrowDown');
    expect(tracker.get()).toBe('keyboard');
    expect(tracker.isFocusVisible()).toBe(true);
    expect(listener).toHaveBeenCalledWith('keyboard', event);
    unsubscribe();
  });

  it('switches to pointer on pointer down, and quietly on pointer moves', async () => {
    const tracker = modalityTracker(window);
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    tracker.set('keyboard');
    listener.mockClear();

    await userEvent.hover(append('div'));
    expect(tracker.get()).toBe('pointer');
    expect(listener).not.toHaveBeenCalled();

    tracker.set('keyboard');
    listener.mockClear();
    await userEvent.click(append('button'));
    expect(tracker.get()).toBe('pointer');
    expect(tracker.isFocusVisible()).toBe(false);
    expect(listener).toHaveBeenCalledWith('pointer', expect.any(PointerEvent));
    unsubscribe();
  });

  it('treats focus with no input before it as virtual, but not a focus() call', () => {
    const tracker = modalityTracker(window);
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    const first = append('button');
    const second = append('button');
    tracker.set('pointer');
    listener.mockClear();

    first.focus();
    expect(document.activeElement).toBe(first);
    expect(tracker.get()).toBe('pointer');

    nativeFocus.call(second);
    expect(document.activeElement).toBe(second);
    expect(tracker.get()).toBe('virtual');
    expect(tracker.isFocusVisible()).toBe(true);
    expect(listener).toHaveBeenCalledWith('virtual', expect.any(FocusEvent));
    unsubscribe();
  });

  it('treats focus that a dialog or a popover moves as a focus() call', () => {
    const tracker = modalityTracker(window);
    const trigger = append('button');
    const dialog = append('dialog');
    dialog.replaceChildren(document.createElement('button'));
    const popover = append('div', { popover: 'manual' });
    popover.replaceChildren(document.createElement('button'));
    popover.firstElementChild?.setAttribute('autofocus', '');
    trigger.focus();
    tracker.set('pointer');

    // `showModal()` focuses the dialog's first button, `close()` focuses
    // where focus was, and `showPopover()` the popover's `autofocus` button.
    dialog.showModal();
    expect(document.activeElement).toBe(dialog.firstElementChild);
    dialog.close();
    expect(document.activeElement).toBe(trigger);
    popover.showPopover();
    expect(document.activeElement).toBe(popover.firstElementChild);
    expect(tracker.get()).toBe('pointer');
  });

  it('treats a click with no pointer behind it as virtual', () => {
    const tracker = modalityTracker(window);
    tracker.set('pointer');
    append('button').click();
    expect(tracker.get()).toBe('virtual');
  });

  it('switches to keyboard when focus moves after a field turns invalid', async () => {
    const tracker = modalityTracker(window);
    const input = append('input', { required: '' });
    input.addEventListener('invalid', () => input.focus());
    tracker.set('pointer');

    input.checkValidity();
    expect(document.activeElement).toBe(input);
    await Promise.resolve();
    expect(tracker.get()).toBe('keyboard');
  });

  it('reports emulated mouse events for 500 ms after a touch ends', () => {
    const tracker = modalityTracker(window);
    // A second back, so the real clock is past the window once restored.
    let now = performance.now() - 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const up = (pointerType: string) =>
      document.body.dispatchEvent(
        new PointerEvent('pointerup', { pointerType, bubbles: true }),
      );

    up('mouse');
    expect(tracker.isEmulatingMouse()).toBe(false);
    up('touch');
    now += 499;
    expect(tracker.isEmulatingMouse()).toBe(true);
    now += 1;
    expect(tracker.isEmulatingMouse()).toBe(false);
  });

  it('notifies with no event when set explicitly', () => {
    const tracker = modalityTracker(window);
    const listener = vi.fn();
    const unsubscribe = tracker.subscribe(listener);
    tracker.set('virtual');
    expect(listener).toHaveBeenCalledWith('virtual', null);
    unsubscribe();
    tracker.set('pointer');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('isFocusVisibleKey', () => {
  const keydown = (target: Element, name: string) => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true });
    target.dispatchEvent(event);
    return event;
  };

  it('lets only Tab and Escape show focus while a text field has it', () => {
    const input = append('input');
    input.focus();
    expect(isFocusVisibleKey(keydown(input, 'a'))).toBe(false);
    expect(isFocusVisibleKey(keydown(input, 'ArrowLeft'))).toBe(false);
    expect(isFocusVisibleKey(keydown(input, 'Tab'))).toBe(true);
    expect(isFocusVisibleKey(keydown(input, 'Escape'))).toBe(true);
  });

  it('treats checkboxes and buttons as not text fields', () => {
    const checkbox = append('input', { type: 'checkbox' });
    checkbox.focus();
    expect(isFocusVisibleKey(keydown(checkbox, 'a'))).toBe(true);
    const button = append('button');
    button.focus();
    expect(isFocusVisibleKey(keydown(button, 'a'))).toBe(true);
    expect(isFocusVisibleKey(keydown(button, 'a'), true)).toBe(false);
  });

  it('accepts every non-keyboard change', () => {
    expect(isFocusVisibleKey(null)).toBe(true);
    expect(isFocusVisibleKey(new PointerEvent('pointerdown'))).toBe(true);
  });
});
