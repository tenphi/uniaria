/**
 * Defining conformance suites. A suite is data: a component name and a tree of
 * scenarios, written from the component's approved spec. Running it is the
 * runner's job (`@uniaria/testing/browser`), once per adapter.
 *
 * Each scenario is tagged with the roadmap phase whose features it needs.
 * An adapter run declares the phase it has reached, and later scenarios are
 * reported as skipped instead of failing (Button's touch and virtual-click
 * scenarios wait for the phase 2 interaction layer). A scenario can also need
 * input that only some browsers take (touch); elsewhere it is skipped too.
 * Scenarios that need a real screen reader run only in the screen-reader
 * project, nightly, and only they run there.
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
  /**
   * Turns the wheel wherever the pointer is, with the modifier keys held
   * down: a negative `deltaY` scrolls up. One call is one `wheel` event.
   */
  wheel(delta: { deltaX?: number; deltaY?: number }): Promise<void>;
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

/**
 * Real touch input, one finger at a time, through DevTools: only Chromium
 * takes it, so scenarios that use it declare `needs: ['touch']`. The browser
 * turns it into touch and pointer events, compatibility mouse events and a
 * click, and a finger that moves away starts a scroll.
 */
export interface TouchInput {
  /** Puts a finger down on the target's centre. */
  down(target: Element): Promise<void>;
  /** Moves the finger to the target's centre. */
  move(target: Element): Promise<void>;
  /** Moves the finger 24px below the target. */
  moveOutside(target: Element): Promise<void>;
  /** Lifts the finger wherever it is. */
  up(): Promise<void>;
  /** `down` on the target, then `up`. */
  tap(target: Element): Promise<void>;
}

/** Which real screen reader a scenario runs with. */
export type ScreenReaderName = 'voiceover' | 'nvda';

/**
 * A real screen reader driven through Guidepup: VoiceOver on macOS, NVDA on
 * Windows, both with Chromium. Keys go through the operating system, so the
 * screen reader hears them as a user's and speaks what they do. Only in
 * scenarios that declare `needs: ['screenReader']`, which run nightly.
 *
 * The screen readers word things differently (`check box` in NVDA,
 * `checkbox` in VoiceOver), so scenarios match what they need to hear, not
 * whole phrases.
 */
export interface ScreenReaderInput {
  /** Which screen reader runs. */
  readonly name: ScreenReaderName;
  /**
   * Clicks `element` (a text field before the component), waits for the
   * screen reader to speak it and forgets what it said: the scenario starts
   * from there, usually with Tab into the component.
   */
  startFrom(element: HTMLElement): Promise<void>;
  /**
   * Presses a key through the screen reader (Playwright's names: `Tab`,
   * `ArrowDown`, `Shift+Tab`) and waits until it stops speaking.
   */
  press(key: string): Promise<void>;
  /** Types text through the screen reader, a key per character. */
  type(text: string): Promise<void>;
  /** Moves the screen reader's own cursor to the next item. */
  next(): Promise<void>;
  /**
   * What the screen reader holds for the element with keyboard focus: NVDA
   * reads it again (NVDA+Tab), VoiceOver gives its cursor's item text. A
   * check that holds when the speech on arrival is cut short.
   */
  readFocus(): Promise<string>;
  /**
   * What it has said since `startFrom` or the last call: each key's phrases
   * in order, joined with ` / `.
   */
  spoken(): Promise<string>;
}

/** Input a scenario needs beyond mouse and keyboard. */
export type InputNeed = 'touch' | 'screenReader';

export interface ScenarioContext<Props, State> {
  /** Mounts the suite's component through the adapter under test. */
  mount(options: MountOptions<Props>): Promise<Mounted<Props, State>>;
  pointer: PointerInput;
  keyboard: KeyboardInput;
  /** Only in scenarios that declare `needs: ['touch']`. */
  touch: TouchInput;
  /** Only in scenarios that declare `needs: ['screenReader']`. */
  screenReader: ScreenReaderInput;
  /**
   * Reads the whole document with the virtual screen reader and returns every
   * phrase, from `document` to `end of document`.
   */
  spoken(): Promise<string[]>;
  /**
   * Starts hearing live regions with the virtual screen reader. The returned
   * function gives what they have announced since, in order, each phrase
   * prefixed with its politeness: `assertive: Saved`. Listening lasts until
   * the scenario ends, and `spoken()` can't run meanwhile.
   */
  listen(): Promise<() => Promise<string[]>>;
}

export type ScenarioRun<Props, State> = (
  context: ScenarioContext<Props, State>,
) => Promise<void>;

export interface ScenarioOptions {
  /** Roadmap phase whose features the scenario needs. Default 1. */
  readonly phase?: number;
  /**
   * Input beyond mouse and keyboard. Where the browser can't take it, the
   * scenario is skipped; a scenario that needs a real screen reader runs
   * only where one runs.
   */
  readonly needs?: readonly InputNeed[];
}

export interface Scenario<Props, State> {
  readonly kind: 'scenario';
  readonly name: string;
  readonly phase: number;
  readonly needs: readonly InputNeed[];
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
      current.push({
        kind: 'scenario',
        name,
        run,
        phase: options?.phase ?? 1,
        needs: options?.needs ?? [],
      });
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
