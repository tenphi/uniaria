import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hideTooltip,
  isWarm,
  showTooltip,
  stopWaiting,
  waitForTooltip,
} from './registry';

/** A window: the registry only keeps a property on it. */
const windowLike = () => ({}) as Window;

const shown = () => ({ close: vi.fn() });

describe('tooltip registry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps one tooltip open, closing the one before', () => {
    const view = windowLike();
    const first = shown();
    const second = shown();
    showTooltip(view, first);
    showTooltip(view, first);
    expect(first.close).not.toHaveBeenCalled();
    showTooltip(view, second);
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('is warm while one is open and for max(500, closeDelay) after it closes', () => {
    vi.useFakeTimers();
    const view = windowLike();
    const tooltip = shown();
    expect(isWarm(view)).toBe(false);
    showTooltip(view, tooltip);
    expect(isWarm(view)).toBe(true);

    hideTooltip(view, tooltip, 100);
    vi.advanceTimersByTime(499);
    expect(isWarm(view)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isWarm(view)).toBe(false);

    showTooltip(view, tooltip);
    hideTooltip(view, tooltip, 900);
    vi.advanceTimersByTime(899);
    expect(isWarm(view)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isWarm(view)).toBe(false);
  });

  it('ignores a tooltip that another replaced closing late', () => {
    vi.useFakeTimers();
    const view = windowLike();
    const first = shown();
    const second = shown();
    showTooltip(view, first);
    showTooltip(view, second);
    hideTooltip(view, first, 500);
    vi.advanceTimersByTime(10_000);
    expect(isWarm(view)).toBe(true);
  });

  it('cancels the wait of another tooltip, and ends only its own', () => {
    const view = windowLike();
    const first = { cancel: vi.fn() };
    const second = { cancel: vi.fn() };
    waitForTooltip(view, first);
    waitForTooltip(view, second);
    expect(first.cancel).toHaveBeenCalledOnce();

    stopWaiting(view, first);
    waitForTooltip(view, first);
    expect(second.cancel).toHaveBeenCalledOnce();
  });

  it('keeps its state on the window, under the global symbol, per window', () => {
    const view = windowLike();
    const other = windowLike();
    showTooltip(view, shown());
    expect(Reflect.get(view, Symbol.for('@uniaria/tooltips/v1'))).toBeDefined();
    expect(isWarm(view)).toBe(true);
    expect(isWarm(other)).toBe(false);
  });
});
