/**
 * Browser side of the conformance input helpers: real mouse, keyboard and
 * touch input through the Playwright commands in `../commands.ts`. Held
 * buttons, keys and fingers are tracked so the runner can release them after
 * each scenario, even one that failed mid-press.
 */

import { commands, userEvent } from 'vitest/browser';

import type {
  KeyboardInput,
  MouseButton,
  PointerInput,
  TouchInput,
} from './scenario';

declare module 'vitest/browser' {
  interface BrowserCommands {
    uniPointerDown(selector: string, button: MouseButton): Promise<void>;
    uniPointerMove(
      selector: string,
      where: 'center' | 'outside',
    ): Promise<void>;
    uniPointerUp(button: MouseButton): Promise<void>;
    uniWheel(deltaX: number, deltaY: number): Promise<void>;
    uniKeyDown(key: string): Promise<void>;
    uniKeyUp(key: string): Promise<void>;
    uniTouchSupported(): Promise<boolean>;
    uniTouch(
      phase: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      selector?: string,
      where?: 'center' | 'outside',
    ): Promise<void>;
  }
}

const heldButtons = new Set<MouseButton>();
const heldKeys = new Set<string>();
let isFingerDown = false;
let touchSupport: Promise<boolean> | undefined;

/** Whether this browser takes `touch` input (Chromium only). */
export function isTouchSupported(): Promise<boolean> {
  return (touchSupport ??= commands.uniTouchSupported());
}

/** A selector that finds exactly this element, without touching the DOM. */
export function selectorFor(element: Element): string {
  const steps: string[] = [];
  let node: Element = element;
  while (node.parentElement) {
    const index = Array.prototype.indexOf.call(
      node.parentElement.children,
      node,
    );
    steps.unshift(`${node.localName}:nth-child(${index + 1})`);
    node = node.parentElement;
  }
  return [node.localName, ...steps].join(' > ');
}

const down: PointerInput['down'] = async (target, options) => {
  const button = options?.button ?? 'left';
  await commands.uniPointerDown(selectorFor(target), button);
  heldButtons.add(button);
};

const up: PointerInput['up'] = async (options) => {
  const button = options?.button ?? 'left';
  await commands.uniPointerUp(button);
  heldButtons.delete(button);
};

/** How long `pointer.wheel` waits for its event to reach the page. */
const WHEEL_TIMEOUT = 1000;

/** How long `pointer.wheel` waits for its event after a scroll. */
const SCROLL_GRACE = 250;

/**
 * Resolves once the page gets a `wheel` event: Firefox's wheel command can
 * resolve before it. A scroll gives the event `SCROLL_GRACE` more, then
 * resolves: WebKit sends no `wheel` event while a button is held, only the
 * scroll, and a scroll can come first that isn't this wheel's (Firefox
 * scrolling one ahead of its event, or one left from an earlier step). A
 * wheel that neither reaches the page nor scrolls gives up after
 * `WHEEL_TIMEOUT`.
 *
 * It resolves in a task after the event, not in the capture listener:
 * there, the caller would go on in the microtasks after that listener,
 * before the event reached the page's own listeners.
 */
export function wheelArrival(): Promise<void> {
  return new Promise((resolve) => {
    let timer = setTimeout(done, WHEEL_TIMEOUT);
    function done() {
      clearTimeout(timer);
      window.removeEventListener('wheel', done, true);
      window.removeEventListener('scroll', scrolled, true);
      setTimeout(resolve);
    }
    function scrolled() {
      window.removeEventListener('scroll', scrolled, true);
      clearTimeout(timer);
      timer = setTimeout(done, SCROLL_GRACE);
    }
    window.addEventListener('wheel', done, true);
    window.addEventListener('scroll', scrolled, true);
  });
}

export const pointer: PointerInput = {
  down,
  up,
  move: (target) => commands.uniPointerMove(selectorFor(target), 'center'),
  moveOutside: (target) =>
    commands.uniPointerMove(selectorFor(target), 'outside'),
  async wheel({ deltaX = 0, deltaY = 0 }) {
    const arrival = wheelArrival();
    await commands.uniWheel(deltaX, deltaY);
    await arrival;
  },
  async click(target, options) {
    await down(target, options);
    await up(options);
  },
};

const keyDown: KeyboardInput['down'] = async (key) => {
  await commands.uniKeyDown(key);
  heldKeys.add(key);
};

const keyUp: KeyboardInput['up'] = async (key) => {
  await commands.uniKeyUp(key);
  heldKeys.delete(key);
};

export const keyboard: KeyboardInput = {
  down: keyDown,
  up: keyUp,
  async press(key) {
    await keyDown(key);
    await keyUp(key);
  },
  tab: (options) => userEvent.tab({ shift: options?.isBackward ?? false }),
};

const touchDown: TouchInput['down'] = async (target) => {
  await commands.uniTouch('touchStart', selectorFor(target));
  isFingerDown = true;
};

const touchUp: TouchInput['up'] = async () => {
  await commands.uniTouch('touchEnd');
  isFingerDown = false;
};

export const touch: TouchInput = {
  down: touchDown,
  up: touchUp,
  move: (target) => commands.uniTouch('touchMove', selectorFor(target)),
  moveOutside: (target) =>
    commands.uniTouch('touchMove', selectorFor(target), 'outside'),
  async tap(target) {
    await touchDown(target);
    await touchUp();
  },
};

/**
 * Releases every button and key a scenario left held, and cancels a touch
 * left down, so it presses nothing in the next scenario.
 */
export async function releaseInput(): Promise<void> {
  for (const button of [...heldButtons]) await up({ button });
  for (const key of [...heldKeys]) await keyUp(key);
  if (isFingerDown) {
    await commands.uniTouch('touchCancel');
    isFingerDown = false;
  }
}
