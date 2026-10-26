/**
 * Node-side commands that drive a real screen reader through Guidepup
 * (`@guidepup/guidepup`, an optional peer): VoiceOver on macOS and NVDA on
 * Windows, for the scenarios that need one (design doc, Testing and
 * accessibility: real screen readers, nightly). Register them beside
 * `uniCommands` in a browser project that runs headed, one file at a time,
 * on a machine prepared with `@guidepup/setup` (`setup --ci`, then
 * `install`).
 *
 * Keys go through the operating system, as a user's would, so the browser
 * window has to be in front and the screen reader inside the page: starting
 * does what `@guidepup/playwright` does (MIT), ported because that package
 * needs `@playwright/test`.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type * as GuidepupModule from '@guidepup/guidepup';
import type {} from '@vitest/browser-playwright';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';

import type { ScreenReaderName } from './conformance/scenario';

type Guidepup = typeof GuidepupModule;
type Reader = Guidepup['voiceOver'] | Guidepup['nvda'];

interface Running {
  readonly name: ScreenReaderName;
  readonly reader: Reader;
  readonly guidepup: Guidepup;
  /** How much of the spoken phrase log `spoken` has returned. */
  read: number;
  /** Log entries `spoken` leaves out: focus reports while discovering. */
  readonly hidden: Set<number>;
}

let running: Running | undefined;

/**
 * VoiceOver without its hints ("Speak instructions for using the item"),
 * which it speaks a moment after an item and full capture would record:
 * they say how to use VoiceOver, not what the page is.
 */
const VOICEOVER_SETTINGS = {
  settings: { SCRShouldOutputVOInstructions: false },
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Playwright's browsers as macOS knows them, most likely first. */
const MAC_BUNDLE_IDS: Readonly<Record<string, readonly string[]>> = {
  chromium: ['com.google.chrome.for.testing', 'org.chromium.Chromium'],
  firefox: ['org.mozilla.nightlyunofficial', 'org.mozilla.nightly'],
  webkit: ['org.webkit.Playwright'],
};

/** Playwright's browsers as their Windows window titles end. */
const WINDOWS_NAMES: Readonly<Record<string, readonly string[]>> = {
  chromium: ['Google Chrome for Testing', 'Chromium'],
  firefox: ['Nightly', 'Firefox'],
  webkit: ['Playwright'],
};

function browserName(context: BrowserCommandContext): string {
  return context.context.browser()?.browserType().name() ?? 'chromium';
}

function active(): Running {
  if (!running) {
    throw new Error(
      '[@uniaria/testing] No screen reader is running: the screen-reader project starts one for each file.',
    );
  }
  return running;
}

/** Lower case, punctuation as spaces: how window titles are compared. */
const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[|¦:;'"`\-‐–—·_()[\]{}\\^~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Brings the browser in front by its bundle id, trying each in turn. */
async function activateMac(ids: readonly string[]): Promise<void> {
  const run = promisify(execFile);
  for (const id of ids) {
    try {
      await run('osascript', ['-e', `tell application id "${id}" to activate`]);
      return;
    } catch {
      // Not this build; try the next id.
    }
  }
  throw new Error(
    `[@uniaria/testing] Could not bring the browser in front (${ids.join(', ')}).`,
  );
}

/**
 * Brings the browser in front and moves VoiceOver into its web content
 * through the item chooser, as `@guidepup/playwright` does.
 */
async function enterPageWithVoiceOver(
  guidepup: Guidepup,
  context: BrowserCommandContext,
): Promise<void> {
  const { voiceOver, MacOSKeyCodes, voiceOverKeyCodeCommands } = guidepup;
  const silence = () =>
    voiceOver.perform({ keyCode: MacOSKeyCodes.Control }, { capture: false });
  await activateMac(MAC_BUNDLE_IDS[browserName(context)] ?? []);
  await silence();
  await context.page.bringToFront();
  // Something the item chooser can find as "web content".
  await context.page.evaluate(() => {
    const marker = document.createElement('input');
    marker.id = '__uniaria_screen_reader_marker__';
    marker.readOnly = true;
    marker.tabIndex = -1;
    marker.setAttribute('aria-label', 'Start');
    marker.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    document.body.prepend(marker);
  });
  try {
    for (let attempt = 0; ; attempt++) {
      await silence();
      await delay(100);
      await voiceOver.perform(
        { keyCode: MacOSKeyCodes.Escape },
        { capture: false },
      );
      await delay(100);
      await voiceOver.perform(voiceOverKeyCodeCommands.openItemChooser);
      if (
        (await voiceOver.lastSpokenPhrase())
          .toLowerCase()
          .includes('item chooser')
      ) {
        break;
      }
      if (attempt === 10) {
        throw new Error(
          '[@uniaria/testing] VoiceOver did not open its item chooser.',
        );
      }
    }
    let isFound = false;
    for (const character of 'web content') {
      await silence();
      await delay(100);
      await voiceOver.type(character, { capture: 'initial' });
      if (
        (await voiceOver.lastSpokenPhrase())
          .toLowerCase()
          .includes('web content')
      ) {
        isFound = true;
        break;
      }
    }
    if (!isFound) {
      throw new Error(
        '[@uniaria/testing] VoiceOver found no "web content" in its item chooser.',
      );
    }
    await voiceOver.perform(
      { keyCode: MacOSKeyCodes.Enter },
      { capture: false },
    );
    await voiceOver.interact({ capture: false });
    await delay(100);
  } finally {
    await context.page.evaluate(() =>
      document.getElementById('__uniaria_screen_reader_marker__')?.remove(),
    );
  }
}

/**
 * Switches windows until NVDA reports the browser's title, then puts NVDA
 * in browse mode at the top of the page, as `@guidepup/playwright` does.
 */
async function enterPageWithNvda(
  guidepup: Guidepup,
  context: BrowserCommandContext,
): Promise<void> {
  const { nvda, NVDAKeyCodeCommands, WindowsKeyCodes, WindowsModifiers } =
    guidepup;
  const title = clean(await context.page.title());
  const names = (WINDOWS_NAMES[browserName(context)] ?? []).map(clean);
  const isBrowser = (window: string) =>
    (title.length > 0 && window.startsWith(title)) ||
    names.some((name) => window.includes(name));
  await nvda.perform(NVDAKeyCodeCommands.exitFocusMode, { capture: false });
  await delay(100);
  for (let attempt = 0; ; attempt++) {
    await nvda.perform(NVDAKeyCodeCommands.reportTitle);
    if (isBrowser(clean(await nvda.lastSpokenPhrase()))) break;
    if (attempt === 10) {
      throw new Error(
        '[@uniaria/testing] NVDA could not bring the browser in front.',
      );
    }
    await nvda.perform(
      {
        keyCode: [WindowsKeyCodes.Escape],
        modifiers: [WindowsModifiers.Alt],
      },
      { capture: false },
    );
    await delay(500);
  }
  await context.page.bringToFront();
  const body = context.page.locator('body');
  await body.focus();
  await body.click();
  await body.blur();
  // Firefox can leave NVDA on the whole browser after switching windows;
  // moving to a focusable item and toggling the mode twice brings browse
  // mode back (nvaccess/nvda#5758).
  for (const command of [
    NVDAKeyCodeCommands.readNextFocusableItem,
    NVDAKeyCodeCommands.toggleBetweenBrowseAndFocusMode,
    NVDAKeyCodeCommands.toggleBetweenBrowseAndFocusMode,
    NVDAKeyCodeCommands.exitFocusMode,
  ]) {
    await nvda.perform(command, { capture: false });
    await delay(100);
  }
  // Keys go where Chrome's own focus is, which can stay in its toolbar
  // whatever the page focuses; F6 moves it on, back to the page.
  for (let attempt = 0; ; attempt++) {
    await nvda.perform(NVDAKeyCodeCommands.reportCurrentFocus);
    const focus = clean(await nvda.lastSpokenPhrase());
    if (focus.includes('document') || (title && focus.includes(title))) break;
    if (attempt === 6) {
      throw new Error(
        `[@uniaria/testing] NVDA could not move Chrome's focus into the page: ${focus}.`,
      );
    }
    await nvda.press('F6', { capture: false });
    await delay(300);
  }
}

/**
 * Starts the operating system's screen reader and moves it into the page.
 * Returns which one runs; a second call while it runs returns the same.
 */
export const uniScreenReaderStart: BrowserCommand<[]> = async (context) => {
  if (running) return running.name;
  const name: ScreenReaderName | undefined =
    process.platform === 'darwin'
      ? 'voiceover'
      : process.platform === 'win32'
        ? 'nvda'
        : undefined;
  if (!name) {
    throw new Error(
      `[@uniaria/testing] No screen reader to drive on ${process.platform}: VoiceOver needs macOS, NVDA needs Windows.`,
    );
  }
  const guidepup = await import('@guidepup/guidepup');
  const reader = name === 'voiceover' ? guidepup.voiceOver : guidepup.nvda;
  await reader.start(name === 'voiceover' ? VOICEOVER_SETTINGS : undefined);
  try {
    if (name === 'voiceover') await enterPageWithVoiceOver(guidepup, context);
    else await enterPageWithNvda(guidepup, context);
    await reader.clearSpokenPhraseLog();
  } catch (error) {
    await reader.stop().catch(() => undefined);
    throw error;
  }
  running = { name, reader, guidepup, read: 0, hidden: new Set() };
  return name;
};

/** Stops the screen reader, if one runs. */
export const uniScreenReaderStop: BrowserCommand<[]> = async () => {
  const current = running;
  running = undefined;
  await current?.reader.stop().catch(() => undefined);
};

/**
 * Records what the screen reader is saying now, then forgets everything it
 * has said: the next key's phrases are its own. Shift is the key it presses,
 * which neither screen reader speaks.
 */
export const uniScreenReaderSettle: BrowserCommand<[]> = async () => {
  const current = active();
  await delay(500);
  await current.reader.press('Shift');
  await current.reader.clearSpokenPhraseLog();
  current.read = 0;
  current.hidden.clear();
};

/**
 * What the screen reader holds for the element with keyboard focus: NVDA
 * reads it again (NVDA+Tab), VoiceOver gives the text of the item in its
 * cursor, which follows keyboard focus (a key to describe it would turn
 * that tracking off). `spoken` leaves NVDA's report out.
 */
async function readFocus(current: Running): Promise<string> {
  const { guidepup } = current;
  if (current.name === 'voiceover') return guidepup.voiceOver.itemText();
  const from = (await current.reader.spokenPhraseLog()).length;
  await guidepup.nvda.perform(guidepup.NVDAKeyCodeCommands.reportCurrentFocus);
  const log = await current.reader.spokenPhraseLog();
  for (let index = from; index < log.length; index++) current.hidden.add(index);
  return log.slice(from).join(' / ');
}

/**
 * With `UNIARIA_SCREEN_READERS=discover`, logs what the screen reader holds
 * for the focused element after each key, to tell a focus that went astray
 * from one it didn't announce.
 */
async function reportFocus(current: Running, after: string): Promise<void> {
  if (process.env.UNIARIA_SCREEN_READERS !== 'discover') return;
  // eslint-disable-next-line no-console
  console.log(
    `[${current.name}] focus after ${after}: ${JSON.stringify(await readFocus(current))}`,
  );
}

/**
 * Full capture, until the screen reader stops speaking. Guidepup's default
 * (`initial`) keeps only the first phrase after a key: NVDA's next command
 * then cuts off the rest, and VoiceOver's is a single look 50 ms after the
 * key. A live region read after the key's own speech (an option count after
 * a typed letter's echo) was lost.
 */
const UNTIL_SILENT = { capture: true } as const;

/** Presses a key through the screen reader and waits until it stops speaking. */
export const uniScreenReaderPress: BrowserCommand<[key: string]> = async (
  _context,
  key,
) => {
  const current = active();
  await current.reader.press(key, UNTIL_SILENT);
  await reportFocus(current, key);
};

/**
 * Types text through the screen reader, a key per character, each waiting
 * until it stops speaking.
 */
export const uniScreenReaderType: BrowserCommand<[text: string]> = async (
  _context,
  text,
) => {
  const current = active();
  await current.reader.type(text, UNTIL_SILENT);
  await reportFocus(current, JSON.stringify(text));
};

/** What the screen reader holds for the element with keyboard focus. */
export const uniScreenReaderReadFocus: BrowserCommand<[]> = () =>
  readFocus(active());

/** Moves the screen reader's cursor to the next item. */
export const uniScreenReaderNext: BrowserCommand<[]> = async () => {
  await active().reader.next();
};

/** The phrases spoken since the last call, in order. */
export const uniScreenReaderSpoken: BrowserCommand<[]> = async () => {
  const current = active();
  const log = await current.reader.spokenPhraseLog();
  const fresh = log
    .slice(current.read)
    .filter((_, index) => !current.hidden.has(current.read + index));
  current.read = log.length;
  return fresh;
};

export const screenReaderCommands = {
  uniScreenReaderStart,
  uniScreenReaderStop,
  uniScreenReaderSettle,
  uniScreenReaderPress,
  uniScreenReaderType,
  uniScreenReaderNext,
  uniScreenReaderReadFocus,
  uniScreenReaderSpoken,
};
