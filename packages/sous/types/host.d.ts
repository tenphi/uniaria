/**
 * Host globals the DOM-free core (`src/runtime`, `src/collections`) may use.
 *
 * Included only by `tsconfig.core.json`. Anything else from the browser or
 * Node — document, window, events, elements — must reach the core through
 * `ctx.env`, never as a global. Adding to this list needs the owner's approval.
 */

declare function setTimeout(handler: () => void, timeout?: number): number;
declare function clearTimeout(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;

declare const console: {
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
