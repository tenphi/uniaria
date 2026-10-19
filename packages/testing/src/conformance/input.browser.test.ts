/**
 * Timing in the runner's real input that scenarios can't pin down, since
 * it depends on when each browser's command returns.
 */

import { expect, test } from 'vitest';

import { wheelArrival } from './input';

test('pointer.wheel resolves in a task after its event, once every listener has it', async () => {
  // Firefox's wheel command can return before the event: then resolving in
  // the runner's capture listener let a scenario go on in the microtasks
  // after it, before its own listeners had the event. The wheel is
  // dispatched from script because a real one can't be made to come after
  // the command in the other browsers.
  let isResolved = false;
  const arrival = wheelArrival().then(() => {
    isResolved = true;
  });
  document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
  await Promise.resolve();
  expect(isResolved).toBe(false);
  await arrival;
  expect(isResolved).toBe(true);
});
