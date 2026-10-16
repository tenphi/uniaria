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

export const pointer: PointerInput = {
  down,
  up,
  move: (target) => commands.uniPointerMove(selectorFor(target), 'center'),
  moveOutside: (target) =>
    commands.uniPointerMove(selectorFor(target), 'outside'),
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
