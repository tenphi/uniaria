/**
 * Per-instance store behind every component (design decision 9).
 *
 * The snapshot is a version counter: it stays stable between changes, as
 * `useSyncExternalStore` requires, and moves once per flush. There is no
 * fine-grained tracking — an instance holds few values, `connect()` is cheap,
 * and both adapters diff its output.
 */

export interface Store {
  /** The current version. Changes only when a flush notifies subscribers. */
  getSnapshot(): number;
  /** Adds a listener and returns the function that removes it. */
  subscribe(listener: () => void): () => void;
  /** Marks the store changed and flushes, unless inside `batch()`. */
  notify(): void;
  /** Runs `fn`, then flushes at most once when the outermost batch ends. */
  batch<T>(fn: () => T): T;
}

export function createStore(): Store {
  let version = 0;
  let depth = 0;
  let dirty = false;
  const listeners = new Set<() => void>();

  const flush = (): void => {
    if (!dirty || depth > 0) return;
    dirty = false;
    version++;
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      dirty = true;
      flush();
    },
    batch(fn) {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        flush();
      }
    },
  };
}
