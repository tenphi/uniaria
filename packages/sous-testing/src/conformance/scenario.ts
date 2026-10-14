/**
 * Defining conformance suites. A suite is data: a component name and a tree of
 * scenarios, written from the component's approved spec. Running it is the
 * runner's job (`@tenphi/sous-testing/browser`), once per adapter.
 *
 * Each scenario is tagged with the roadmap phase whose features it needs.
 * An adapter run declares the phase it has reached, and later scenarios are
 * reported as skipped instead of failing (Button's touch and virtual-click
 * scenarios wait for the phase 2 interaction layer).
 */

import type { MountOptions, Mounted } from './contract';

export type MouseButton = 'left' | 'right' | 'middle';

/** Real mouse input through Playwright, at the target's centre. */
export interface PointerInput {
  /** Moves to the target and presses a button (left by default). */
  down(target: Element, options?: { button?: MouseButton }): Promise<void>;
  /** Moves to the target's centre with the button state unchanged. */
  move(target: Element): Promise<void>;
  /** Moves to a point 24px below the target. */
  moveOutside(target: Element): Promise<void>;
  /** Releases a button (left by default) wherever the pointer is. */
  up(options?: { button?: MouseButton }): Promise<void>;
  /** `down` on the target, then `up`. */
  click(target: Element, options?: { button?: MouseButton }): Promise<void>;
}

/**
 * Real keyboard input through Playwright, sent to the focused element. Key
 * names follow Playwright: `Enter`, `Space`, `Escape`, `ArrowDown`.
 */
export interface KeyboardInput {
  /** Presses and holds a key. Calling it again while held sends a repeat. */
  down(key: string): Promise<void>;
  up(key: string): Promise<void>;
  /** `down`, then `up`. */
  press(key: string): Promise<void>;
  /** Moves focus with Tab, or Shift+Tab with `isBackward`. */
  tab(options?: { isBackward?: boolean }): Promise<void>;
}

export interface ScenarioContext<Props, State> {
  /** Mounts the suite's component through the adapter under test. */
  mount(options: MountOptions<Props>): Promise<Mounted<Props, State>>;
  pointer: PointerInput;
  keyboard: KeyboardInput;
  /**
   * Reads the whole document with the virtual screen reader and returns every
   * phrase, from `document` to `end of document`.
   */
  spoken(): Promise<string[]>;
}

export type ScenarioRun<Props, State> = (
  context: ScenarioContext<Props, State>,
) => Promise<void>;

export interface ScenarioOptions {
  /** Roadmap phase whose features the scenario needs. Default 1. */
  readonly phase?: number;
}

export interface Scenario<Props, State> {
  readonly kind: 'scenario';
  readonly name: string;
  readonly phase: number;
  readonly run: ScenarioRun<Props, State>;
}

export interface ScenarioGroup<Props, State> {
  readonly kind: 'group';
  readonly name: string;
  readonly children: readonly (
    Scenario<Props, State> | ScenarioGroup<Props, State>
  )[];
}

export interface ConformanceSuite<Props, State> {
  /** Definition name: `button`. */
  readonly component: string;
  readonly children: readonly (
    Scenario<Props, State> | ScenarioGroup<Props, State>
  )[];
}

export interface ConformanceBuilder<Props, State> {
  scenario(
    name: string,
    run: ScenarioRun<Props, State>,
    options?: ScenarioOptions,
  ): void;
  group(name: string, define: () => void): void;
}

/**
 * Declares a component's conformance suite:
 *
 * ```ts
 * export const buttonConformance = defineConformance<ButtonProps, ButtonState>(
 *   'button',
 *   ({ scenario, group }) => {
 *     group('keyboard', () => {
 *       scenario('Enter presses on keyup', async ({ mount, keyboard }) => { … });
 *     });
 *   },
 * );
 * ```
 */
export function defineConformance<Props, State>(
  component: string,
  define: (builder: ConformanceBuilder<Props, State>) => void,
): ConformanceSuite<Props, State> {
  type Child = Scenario<Props, State> | ScenarioGroup<Props, State>;
  const root: Child[] = [];
  let current = root;

  define({
    scenario(name, run, options) {
      current.push({ kind: 'scenario', name, run, phase: options?.phase ?? 1 });
    },
    group(name, defineGroup) {
      const children: Child[] = [];
      current.push({ kind: 'group', name, children });
      const parent = current;
      current = children;
      try {
        defineGroup();
      } finally {
        current = parent;
      }
    },
  });

  return { component, children: root };
}
