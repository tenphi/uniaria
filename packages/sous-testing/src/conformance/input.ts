/**
 * Browser side of the conformance input helpers: real mouse and keyboard
 * input through the Playwright commands in `../commands.ts`. Held buttons and
 * keys are tracked so the runner can release them after each scenario, even
 * one that failed mid-press.
 */

import { commands, userEvent } from 'vitest/browser';

import type { KeyboardInput, MouseButton, PointerInput } from './scenario';

declare module 'vitest/browser' {
  interface BrowserCommands {
    sousPointerDown(selector: string, button: MouseButton): Promise<void>;
    sousPointerMove(
      selector: string,
      where: 'center' | 'outside',
    ): Promise<void>;
    sousPointerUp(button: MouseButton): Promise<void>;
    sousKeyDown(key: string): Promise<void>;
    sousKeyUp(key: string): Promise<void>;
  }
}

const heldButtons = new Set<MouseButton>();
const heldKeys = new Set<string>();

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
  await commands.sousPointerDown(selectorFor(target), button);
  heldButtons.add(button);
};

const up: PointerInput['up'] = async (options) => {
  const button = options?.button ?? 'left';
  await commands.sousPointerUp(button);
  heldButtons.delete(button);
};

export const pointer: PointerInput = {
  down,
  up,
  move: (target) => commands.sousPointerMove(selectorFor(target), 'center'),
  moveOutside: (target) =>
    commands.sousPointerMove(selectorFor(target), 'outside'),
  async click(target, options) {
    await down(target, options);
    await up(options);
  },
};

const keyDown: KeyboardInput['down'] = async (key) => {
  await commands.sousKeyDown(key);
  heldKeys.add(key);
};

const keyUp: KeyboardInput['up'] = async (key) => {
  await commands.sousKeyUp(key);
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

/** Releases every button and key a scenario left held. */
export async function releaseInput(): Promise<void> {
  for (const button of [...heldButtons]) await up({ button });
  for (const key of [...heldKeys]) await keyUp(key);
}
