/**
 * Node-side Playwright commands behind the conformance input helpers. Vitest's
 * `userEvent` cannot hold a mouse button while the pointer moves, which press
 * scenarios need (press, leave, come back), so these drive Playwright's mouse
 * and keyboard directly. Register them in the browser test project:
 * `browser: { commands: sousCommands }`.
 *
 * Targets arrive as CSS selectors because elements cannot cross from the
 * browser to Node. Coordinates come from the test frame's locator, so they
 * account for the iframe Vitest runs tests in.
 */

import type {} from '@vitest/browser-playwright';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';

type MouseButton = 'left' | 'right' | 'middle';

/** How far below a target `moveOutside` puts the pointer. */
const OUTSIDE_OFFSET = 24;

async function boxOf(context: BrowserCommandContext, selector: string) {
  const locator = (await context.frame()).locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Conformance input: "${selector}" has no box.`);
  return box;
}

export const sousPointerDown: BrowserCommand<
  [selector: string, button: MouseButton]
> = async (context, selector, button) => {
  const box = await boxOf(context, selector);
  await context.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await context.page.mouse.down({ button });
};

export const sousPointerMove: BrowserCommand<
  [selector: string, where: 'center' | 'outside']
> = async (context, selector, where) => {
  const box = await boxOf(context, selector);
  const y =
    where === 'center'
      ? box.y + box.height / 2
      : box.y + box.height + OUTSIDE_OFFSET;
  await context.page.mouse.move(box.x + box.width / 2, y, { steps: 2 });
};

export const sousPointerUp: BrowserCommand<[button: MouseButton]> = async (
  context,
  button,
) => {
  await context.page.mouse.up({ button });
};

export const sousKeyDown: BrowserCommand<[key: string]> = async (
  context,
  key,
) => {
  await context.page.keyboard.down(key);
};

export const sousKeyUp: BrowserCommand<[key: string]> = async (
  context,
  key,
) => {
  await context.page.keyboard.up(key);
};

type TouchPhase = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel';

type CDPSession = Awaited<
  ReturnType<BrowserCommandContext['context']['newCDPSession']>
>;

/** One DevTools session per page, for touch input. */
const sessions = new WeakMap<object, Promise<CDPSession>>();

function isChromium(context: BrowserCommandContext): boolean {
  return context.context.browser()?.browserType().name() === 'chromium';
}

/**
 * Whether `sousTouch` works in this browser. Only Chromium takes real touch
 * input through DevTools (`Input.dispatchTouchEvent`); Playwright's own
 * touchscreen needs `hasTouch` on the whole context, which would make every
 * other test run as if on a touch device.
 */
export const sousTouchSupported: BrowserCommand<[]> = (context) =>
  isChromium(context);

/**
 * A finger at the target's centre (or 24px below it, `outside`) for
 * `touchStart` and `touchMove`; lifted for `touchEnd` and `touchCancel`.
 */
export const sousTouch: BrowserCommand<
  [phase: TouchPhase, selector?: string, where?: 'center' | 'outside']
> = async (context, phase, selector, where = 'center') => {
  if (!isChromium(context)) {
    throw new Error('Conformance input: touch needs Chromium.');
  }
  let session = sessions.get(context.page);
  if (!session) {
    session = context.context.newCDPSession(context.page);
    sessions.set(context.page, session);
  }
  const touchPoints = [];
  if (selector !== undefined) {
    const box = await boxOf(context, selector);
    const y =
      where === 'center'
        ? box.y + box.height / 2
        : box.y + box.height + OUTSIDE_OFFSET;
    touchPoints.push({ x: box.x + box.width / 2, y, id: 0 });
  }
  await (
    await session
  ).send('Input.dispatchTouchEvent', {
    type: phase,
    touchPoints,
  });
};

export const sousCommands = {
  sousTouchSupported,
  sousTouch,
  sousPointerDown,
  sousPointerMove,
  sousPointerUp,
  sousKeyDown,
  sousKeyUp,
};
