/**
 * `@tenphi/sous-testing/browser` — runs conformance suites in Vitest browser
 * mode: `runConformance(adapter, suites, { phase })`, plus the real-input and
 * spoken-output helpers scenarios receive in their context. Needs the
 * commands from `@tenphi/sous-testing/commands` registered in the browser
 * project.
 */

export {
  isTouchSupported,
  keyboard,
  pointer,
  releaseInput,
  touch,
} from './conformance/input';
export { runConformance } from './conformance/run';
export type { RunOptions } from './conformance/run';
export { spokenPhrases } from './conformance/spoken';
