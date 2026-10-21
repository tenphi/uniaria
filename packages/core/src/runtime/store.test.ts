import { describe, expect, it, vi } from 'vitest';

import { createStore } from './store';

describe('createStore', () => {
  it('starts at version 0', () => {
    expect(createStore().getSnapshot()).toBe(0);
  });

  it('bumps the version and calls listeners on notify', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.notify();

    expect(store.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the snapshot stable between changes', () => {
    const store = createStore();
    store.notify();

    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('flushes once per batch, however many changes it holds', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => {
      store.notify();
      store.notify();
      store.notify();
    });

    expect(store.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('flushes nested batches only when the outermost one ends', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => {
      store.batch(() => store.notify());
      expect(listener).not.toHaveBeenCalled();
      store.notify();
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not flush a batch without changes', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.batch(() => undefined);

    expect(store.getSnapshot()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns the batch result and still flushes when the batch throws', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.batch(() => 42)).toBe(42);
    expect(() =>
      store.batch(() => {
        store.notify();
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('runs another pass for changes a listener makes, never a nested one', () => {
    const store = createStore();
    const seen: string[] = [];
    store.subscribe(() => {
      seen.push(`a${store.getSnapshot()}`);
      if (store.getSnapshot() === 1) store.batch(() => store.notify());
    });
    store.subscribe(() => seen.push(`b${store.getSnapshot()}`));

    store.notify();

    expect(seen).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('stops a listener that changes the store on every flush', () => {
    const store = createStore();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    store.subscribe(() => store.notify());

    store.notify();

    expect(store.getSnapshot()).toBe(100);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.notify();

    expect(listener).not.toHaveBeenCalled();
  });

  it('runs afterFlush at once while nothing is under way', () => {
    const store = createStore();
    const fn = vi.fn();

    store.afterFlush(fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs afterFlush from a listener after every listener, every pass included', () => {
    const store = createStore();
    const seen: string[] = [];
    store.subscribe(() => {
      seen.push(`a${store.getSnapshot()}`);
      if (store.getSnapshot() === 1) {
        store.afterFlush(() => seen.push(`after${store.getSnapshot()}`));
        store.notify();
      }
    });
    store.subscribe(() => seen.push(`b${store.getSnapshot()}`));

    store.notify();

    expect(seen).toEqual(['a1', 'b1', 'a2', 'b2', 'after2']);
  });

  it('runs afterFlush in a batch once the batch has flushed', () => {
    const store = createStore();
    const seen: string[] = [];
    store.subscribe(() => seen.push('listener'));

    store.batch(() => {
      store.afterFlush(() => seen.push('after'));
      store.notify();
      seen.push('batch');
    });

    expect(seen).toEqual(['batch', 'listener', 'after']);
  });

  it('flushes a change afterFlush makes before the next callback', () => {
    const store = createStore();
    const seen: string[] = [];
    store.subscribe(() => seen.push(`listener${store.getSnapshot()}`));

    store.batch(() => {
      store.afterFlush(() => {
        seen.push('first');
        store.notify();
      });
      store.afterFlush(() => seen.push('second'));
    });

    expect(seen).toEqual(['first', 'listener1', 'second']);
  });
});
