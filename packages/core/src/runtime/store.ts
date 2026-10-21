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
  /**
   * Runs `fn` once the store is settled: when the flush in progress has
   * called every listener, an adapter's binder included, or the outermost
   * batch has ended and flushed; at once when neither is under way.
   * Callbacks run in order, and one that changes the store flushes it
   * before the next.
   */
  afterFlush(fn: () => void): void;
}

/**
 * A listener that keeps changing the store would flush forever; past this
 * many passes the store reports the loop and stops.
 */
const MAX_PASSES = 100;

export function createStore(): Store {
  let version = 0;
  let depth = 0;
  let isDirty = false;
  let isFlushing = false;
  let isSettling = false;
  const listeners = new Set<() => void>();
  const settled: (() => void)[] = [];

  // Runs what waits for the store to settle. A callback that changes the
  // store flushes it at once, and the loop goes on with the rest.
  const settle = (): void => {
    if (depth > 0 || isFlushing || isSettling) return;
    isSettling = true;
    try {
      for (let fn = settled.shift(); fn; fn = settled.shift()) fn();
    } finally {
      isSettling = false;
    }
  };

  // A change made by a listener (a watcher reacting to a prop, say) is not
  // flushed in the middle of the pass that caused it: it marks the store dirty
  // and the loop runs one more pass, so every listener sees each version once.
  const flush = (): void => {
    if (!isDirty || depth > 0 || isFlushing) return;
    isFlushing = true;
    try {
      for (let pass = 1; isDirty; pass++) {
        if (pass > MAX_PASSES) {
          isDirty = false;
          console.error(
            `[uniaria] The store changed on each of ${MAX_PASSES} flushes in a row; a listener keeps changing state.`,
          );
          break;
        }
        isDirty = false;
        version++;
        for (const listener of Array.from(listeners)) listener();
      }
    } finally {
      isFlushing = false;
    }
    settle();
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
      isDirty = true;
      flush();
    },
    batch(fn) {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        flush();
        settle();
      }
    },
    afterFlush(fn) {
      settled.push(fn);
      settle();
    },
  };
}
