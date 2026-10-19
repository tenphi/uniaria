/**
 * Browser side of the real screen reader (`ScreenReaderInput`): the
 * Guidepup commands in `../screen-reader-commands.ts`. The runner starts it
 * once per file and scenarios reach it through their context.
 */

import { expect } from 'vitest';
import { commands } from 'vitest/browser';

import { pointer } from './input';
import type { ScreenReaderInput, ScreenReaderName } from './scenario';

declare module 'vitest/browser' {
  interface BrowserCommands {
    uniScreenReaderStart(): Promise<ScreenReaderName>;
    uniScreenReaderStop(): Promise<void>;
    uniScreenReaderSettle(): Promise<void>;
    uniScreenReaderPress(key: string): Promise<void>;
    uniScreenReaderType(text: string): Promise<void>;
    uniScreenReaderNext(): Promise<void>;
    uniScreenReaderReadFocus(): Promise<string>;
    uniScreenReaderSpoken(): Promise<string[]>;
  }
}

let name: ScreenReaderName | undefined;

/** Starts the machine's screen reader and moves it into the page. */
export async function startScreenReader(): Promise<void> {
  name = await commands.uniScreenReaderStart();
}

export async function stopScreenReader(): Promise<void> {
  name = undefined;
  await commands.uniScreenReaderStop();
}

export const screenReader: ScreenReaderInput = {
  get name() {
    if (!name) throw new Error('[@uniaria/testing] No screen reader runs.');
    return name;
  },
  async startFrom(element) {
    // A real click: focus from script can leave the keyboard in the
    // browser's toolbar, where the next Tab would go.
    await pointer.click(element);
    await commands.uniScreenReaderSettle();
  },
  press: (key) => commands.uniScreenReaderPress(key),
  type: (text) => commands.uniScreenReaderType(text),
  next: () => commands.uniScreenReaderNext(),
  async readFocus() {
    const focus = await commands.uniScreenReaderReadFocus();
    // eslint-disable-next-line no-console
    console.info(
      `[${name}] ${expect.getState().currentTestName} (focus): ${JSON.stringify(focus)}`,
    );
    return focus;
  },
  async spoken() {
    const phrases = await commands.uniScreenReaderSpoken();
    // The nightly log is the record of what each screen reader said.
    // eslint-disable-next-line no-console
    console.info(
      `[${name}] ${expect.getState().currentTestName}: ${JSON.stringify(phrases)}`,
    );
    return phrases.join(' / ');
  },
};

/** The context's screen reader where none runs. */
export const noScreenReader: ScreenReaderInput = new Proxy(
  {} as ScreenReaderInput,
  {
    get() {
      throw new Error(
        "[@uniaria/testing] A real screen reader runs only in the screen-reader project, for scenarios that declare needs: ['screenReader'].",
      );
    },
  },
);
