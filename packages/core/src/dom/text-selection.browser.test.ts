import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInstance, defineBehavior, prop } from '../runtime';
import { createBinder } from './binder';
import { createPress } from './press';
import { disableTextSelection, restoreTextSelection } from './text-selection';

const pressable = defineBehavior({
  name: 'pressable',
  parts: ['root'],
  props: { isDisabled: prop(false) },
  setup(ctx) {
    return createPress(ctx, { part: 'root', isDisabled: ctx.props.isDisabled });
  },
  expose: ({ api }) => ({ isPressed: api.isPressed() }),
  connect: ({ api }) => ({ root: { attrs: {}, on: api.handlers } }),
});

function mount(style?: string) {
  const host = document.createElement('div');
  host.innerHTML = '<div data-uni="pressable">Press</div>';
  document.body.append(host);
  const root = host.querySelector<HTMLElement>('[data-uni="pressable"]')!;
  if (style !== undefined) root.setAttribute('style', style);
  const instance = createInstance(pressable);
  const binder = createBinder(instance, { host });
  binder.attach('root', root);
  instance.start();
  binder.start();
  return { root, instance };
}

function pointer(target: Element, type: string, pointerType: string) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerType,
      pointerId: 7,
      button: 0,
      detail: 1,
      bubbles: true,
    }),
  );
}

/** The inline `user-select`; Safari has only the prefixed property. */
const userSelect = (element: HTMLElement) =>
  element.style.userSelect || element.style.webkitUserSelect;

function mockPlatform(platform: string, maxTouchPoints = 5) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(maxTouchPoints);
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('-webkit-user-select');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('text selection during a touch press', () => {
  it('turns off selection on the element until the press ends', () => {
    mockPlatform('Linux armv8l');
    const { root, instance } = mount();
    pointer(root, 'pointerdown', 'touch');
    expect(userSelect(root)).toBe('none');
    expect(instance.getState().isPressed).toBe(true);

    pointer(root, 'pointerup', 'touch');
    pointer(root, 'click', 'touch');
    expect(instance.getState().isPressed).toBe(false);
    expect(userSelect(root)).toBe('');
  });

  it('leaves mouse presses alone', () => {
    mockPlatform('MacIntel', 0);
    const { root } = mount();
    pointer(root, 'pointerdown', 'mouse');
    expect(userSelect(root)).toBe('');
  });

  it('restores on cancel and when the instance stops mid-press', () => {
    mockPlatform('Win32', 10);
    const { root, instance } = mount();
    pointer(root, 'pointerdown', 'touch');
    pointer(root, 'pointercancel', 'touch');
    expect(userSelect(root)).toBe('');

    pointer(root, 'pointerdown', 'touch');
    instance.stop();
    expect(userSelect(root)).toBe('');
  });

  it('restores the previous inline value, and drops an empty style attribute', () => {
    mockPlatform('Linux x86_64', 0);
    const element = document.createElement('div');
    element.setAttribute('style', '-webkit-user-select: text');
    disableTextSelection(element);
    expect(userSelect(element)).toBe('none');
    restoreTextSelection(element);
    expect(userSelect(element)).toBe('text');

    const bare = document.createElement('div');
    disableTextSelection(bare);
    restoreTextSelection(bare);
    expect(bare.hasAttribute('style')).toBe(false);
  });

  it('keeps a value set during the press', () => {
    mockPlatform('Linux x86_64', 0);
    const element = document.createElement('div');
    disableTextSelection(element);
    element.style.webkitUserSelect = 'all';
    restoreTextSelection(element);
    expect(userSelect(element)).toBe('all');
  });

  it('turns it off for the whole page on iOS, restored 300 ms after', () => {
    mockPlatform('iPhone');
    vi.useFakeTimers();
    const page = document.documentElement.style;
    const { root } = mount();

    pointer(root, 'pointerdown', 'touch');
    expect(page.webkitUserSelect).toBe('none');
    expect(userSelect(root)).toBe('');
    pointer(root, 'pointerup', 'touch');
    pointer(root, 'click', 'touch');
    expect(page.webkitUserSelect).toBe('none');

    vi.advanceTimersByTime(299);
    expect(page.webkitUserSelect).toBe('none');
    vi.advanceTimersByTime(1);
    expect(page.webkitUserSelect).toBe('');
  });

  it('on iOS, keeps it off for a press that starts during the delay', () => {
    mockPlatform('MacIntel', 5);
    vi.useFakeTimers();
    const page = document.documentElement.style;
    const element = document.createElement('div');

    disableTextSelection(element);
    restoreTextSelection(element);
    vi.advanceTimersByTime(200);
    disableTextSelection(element);
    vi.advanceTimersByTime(200);
    expect(page.webkitUserSelect).toBe('none');

    restoreTextSelection(element);
    vi.advanceTimersByTime(300);
    expect(page.webkitUserSelect).toBe('');
  });

  it('on iOS, restores the page when the instance stops mid-press', () => {
    mockPlatform('iPad');
    vi.useFakeTimers();
    const { root, instance } = mount();
    pointer(root, 'pointerdown', 'touch');
    instance.stop();
    vi.advanceTimersByTime(300);
    expect(document.documentElement.style.webkitUserSelect).toBe('');
  });
});
