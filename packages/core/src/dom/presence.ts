/**
 * Presence: an overlay's enter and exit phases (Dialog spec, Resolved
 * questions 5). Opening shows the part at once and marks the first frames
 * as entering, so CSS can transition from them. Closing keeps it shown,
 * marked as exiting, until the finite animations running on the part and
 * its subtree (pseudo-elements such as `::backdrop` included) finish, read
 * through `getAnimations()` as React Aria does; then it hides. Durations
 * are the stylesheet's: nothing waits for a fixed time, and a part with no
 * running animation hides in the next frame.
 *
 * Reopening while exiting cancels the exit. Infinite animations (a spinner
 * inside) are not waited for. Without `getAnimations()` (old engines, a DOM
 * without layout) nothing is waited for.
 */

import type { InteractionContext } from './types';
import { partElement } from './types';

export interface PresenceOptions {
  /** The part that animates, such as a dialog. */
  readonly part: string;
  isOpen(): boolean;
  /**
   * Read as it closes: `true` hides it at once, with no exit phase, as a
   * tooltip that another one replaces (Tooltip spec, Warm-up).
   */
  shouldSkipExit?(): boolean;
}

export interface Presence {
  /** Open, or closed but still exiting. */
  isShown(): boolean;
  /** The first frames after opening. */
  isEntering(): boolean;
  /** Closed, and waiting for its exit animations. */
  isExiting(): boolean;
}

/** The finite animations running on `element` and its subtree. */
function finiteAnimations(element: Element): Animation[] {
  if (typeof element.getAnimations !== 'function') return [];
  return element.getAnimations({ subtree: true }).filter((animation) => {
    if (animation.playState !== 'running') return false;
    const end = animation.effect?.getComputedTiming().endTime;
    return typeof end === 'number' && Number.isFinite(end);
  });
}

export function createPresence(
  ctx: InteractionContext,
  options: PresenceOptions,
): Presence {
  const isOpenAtStart = options.isOpen();
  const shown = ctx.state(isOpenAtStart);
  const entering = ctx.state(isOpenAtStart);
  const exiting = ctx.state(false);
  // Bumped by every change, so a stale wait or frame does nothing.
  let generation = 0;

  const view = (): Window | null => {
    const element = partElement(ctx, options.part);
    return element?.ownerDocument.defaultView ?? null;
  };

  /** Runs `then` after `count` frames, unless something changed since. */
  const afterFrames = (count: number, then: () => void) => {
    const current = generation;
    const target = view();
    if (!target) return then();
    const frame = (left: number) =>
      target.requestAnimationFrame(() => {
        if (current !== generation) return;
        if (left > 1) frame(left - 1);
        else then();
      });
    frame(count);
  };

  const enter = () => {
    generation++;
    ctx.batch(() => {
      exiting.set(false);
      entering.set(true);
      shown.set(true);
    });
    // Two frames: the entering styles are computed in the first, so a
    // transition starts from them when they go.
    afterFrames(2, () => entering.set(false));
  };

  const exit = () => {
    generation++;
    const current = generation;
    ctx.batch(() => {
      entering.set(false);
      exiting.set(true);
    });
    const finish = () => {
      if (current !== generation) return;
      ctx.batch(() => {
        exiting.set(false);
        shown.set(false);
      });
    };
    if (options.shouldSkipExit?.()) return finish();
    // Read in the next frame, once every adapter has written the exiting
    // attribute; `getAnimations()` computes styles, which starts transitions.
    afterFrames(1, () => {
      const element = partElement(ctx, options.part);
      const animations = element ? finiteAnimations(element) : [];
      if (animations.length === 0) return finish();
      void Promise.all(
        animations.map((animation) =>
          animation.finished.catch(() => undefined),
        ),
      ).then(finish);
    });
  };

  ctx.watch(options.isOpen, (isOpen) => {
    if (isOpen) enter();
    else if (shown.get()) exit();
  });
  // On start, catch up with a change made while stopped, and run the first
  // frames of an instance that starts open; on stop, drop pending frames.
  ctx.effect(() => {
    if (options.isOpen()) {
      if (!shown.get() || entering.get() || exiting.get()) enter();
    } else if (shown.get()) {
      exit();
    }
    return () => {
      generation++;
    };
  });

  return {
    isShown: () => shown.get(),
    isEntering: () => entering.get(),
    isExiting: () => exiting.get(),
  };
}
