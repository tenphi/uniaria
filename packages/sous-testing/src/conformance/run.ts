/**
 * Runs conformance suites against one adapter as Vitest browser tests. The
 * runner owns everything adapter-neutral: a fresh container per mount, part
 * lookup, the event log, real input, spoken output, cleanup after each
 * scenario, and skipping scenarios from later roadmap phases or that need
 * input the browser can't take.
 *
 * An adapter's conformance test file is one call:
 * `runConformance(reactAdapter, suites, { phase: 1 })`.
 */

import { afterEach, describe, it } from 'vitest';

import type {
  AdapterMount,
  ConformanceAdapter,
  MountOptions,
  Mounted,
  RecordedEvent,
} from './contract';
import {
  isTouchSupported,
  keyboard,
  pointer,
  releaseInput,
  touch,
} from './input';
import type {
  ConformanceSuite,
  Scenario,
  ScenarioContext,
  ScenarioGroup,
} from './scenario';
import { spokenPhrases } from './spoken';
import type { TemplateNode } from './template';

export interface RunOptions {
  /**
   * The highest roadmap phase this adapter implements. Scenarios tagged with
   * a later phase are skipped. Default: run everything.
   */
  readonly phase?: number;
}

function partsOf(container: HTMLElement, component: string, name: string) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      `[data-scope="${CSS.escape(component)}"][data-part="${CSS.escape(name)}"]`,
    ),
  );
}

function toNodes(
  template: TemplateNode | readonly TemplateNode[],
): readonly TemplateNode[] {
  return Array.isArray(template) ? template : [template as TemplateNode];
}

export function runConformance(
  adapter: ConformanceAdapter,
  // Suites differ in their props and state types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suites: readonly ConformanceSuite<any, any>[],
  options: RunOptions = {},
): void {
  const phase = options.phase ?? Number.POSITIVE_INFINITY;

  for (const suite of suites) {
    describe(`${suite.component} (${adapter.name})`, () => {
      const mounted: { mount: AdapterMount; container: HTMLElement }[] = [];

      afterEach(async () => {
        await releaseInput();
        for (const { mount, container } of mounted.splice(0)) {
          await mount.unmount();
          container.remove();
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

      const context: ScenarioContext<unknown, unknown> = {
        pointer,
        keyboard,
        touch,
        spoken: () => spokenPhrases(),
        async mount(mountOptions: MountOptions<unknown>) {
          const container = document.createElement('div');
          document.body.appendChild(container);
          const events: RecordedEvent[] = [];

          const mount = await adapter.mount({
            component: suite.component,
            props: (mountOptions.props ?? {}) as Record<string, unknown>,
            template: toNodes(mountOptions.template),
            events: mountOptions.events ?? [],
            record: (name, detail) => events.push({ name, detail }),
            container,
          });
          mounted.push({ mount, container });

          const result: Mounted<unknown, unknown> = {
            container,
            events,
            part(name = 'root') {
              const found = partsOf(container, suite.component, name);
              if (found.length !== 1) {
                throw new Error(
                  `Expected one "${name}" part of ${suite.component}, found ${found.length}. ` +
                    'Check data-scope and data-part.',
                );
              }
              return found[0]!;
            },
            parts: (name) => partsOf(container, suite.component, name),
            eventNames: () => events.map((event) => event.name),
            clearEvents: () => {
              events.length = 0;
            },
            state: () => mount.state(),
            setProps: (props) =>
              mount.setProps(props as Record<string, unknown>),
            renderCount: () => mount.renderCount(),
          };
          return result;
        },
      };

      const register = (
        children: readonly (
          Scenario<unknown, unknown> | ScenarioGroup<unknown, unknown>
        )[],
      ) => {
        for (const child of children) {
          if (child.kind === 'group') {
            describe(child.name, () => register(child.children));
          } else if (child.phase > phase) {
            it.skip(`${child.name} (phase ${child.phase})`);
          } else {
            it(child.name, async ({ skip }) => {
              if (
                child.needs.includes('touch') &&
                !(await isTouchSupported())
              ) {
                skip('needs touch input, which only Chromium takes');
              }
              await child.run(context);
            });
          }
        }
      };
      register(suite.children);
    });
  }
}
