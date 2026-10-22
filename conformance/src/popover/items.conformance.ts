/**
 * Popover's trigger parts, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the
 * `triggerLabel` and `triggerDescription` that name and describe the
 * trigger, the `triggerFrame` and `triggerExtras` beside it, all outside the
 * overlay; their state; the popover placed against the frame when there is
 * no anchor part, in both positioning modes; a press on an extra while open,
 * which is outside; render counts and spoken output. Phase 5: the adapters
 * reach it with the implementation.
 *
 * The positioning mode is UniAria's page-wide setting, as in the Popover
 * suite.
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { PopoverDismissEvent, PopoverProps, PopoverState } from './types';

type MountedPopover = Mounted<PopoverProps, PopoverState>;

const PHASE = { phase: 5 } as const;

const EVENTS = ['openChange', 'dismiss'];

/** UniAria's page-wide settings: `positioning` picks the mode. */
const SETTINGS = Symbol.for('@uniaria/settings/v1');

/** The trigger's state attributes the frame and the extras carry. */
const MIRRORED = ['data-open', 'data-hovered', 'data-pressed'];

/**
 * Fixed places: the frame at (150, 30): the trigger, a 40px gap that is
 * only the frame's, and the extras; the popover 160px wide below, its 8px
 * margin the gap; `#page` (not focusable) and `#before` at the left, `#after`
 * lower left.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 0; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 30px; width: 100px }
   .sc-after { position: fixed; left: 0; top: 340px; width: 100px }
   .sc-frame { position: fixed; left: 150px; top: 30px; display: flex; align-items: center; height: 30px; margin: 0; padding: 0 }
   .sc-trigger { width: 100px; height: 30px; margin: 0; padding: 0 }
   .sc-gap { display: block; width: 40px; height: 30px }
   .sc-extras { display: flex; align-items: center; gap: 4px; height: 30px }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-pop { width: 160px; margin: 8px; padding: 0; border: 0; box-sizing: border-box }
   .sc-pop h2 { margin: 0 }`,
);

interface PickerOptions {
  /** Markup before the page content, such as a stylesheet. */
  readonly head?: readonly TemplateNode[];
  /** Attributes the consumer puts on the popover. */
  readonly rootAttrs?: Readonly<Record<string, string>>;
}

/**
 * A frame: a trigger "Fruit" describing its value "Apple", a gap, and the
 * extras: a UniAria Button "Clear Fruit" and a count "3"; then a popover
 * "Fruit" with a Done close button.
 */
function picker({ head = [], rootAttrs = {} }: PickerOptions = {}) {
  return [
    LAYOUT,
    ...head,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    h(
      'div',
      { part: 'triggerFrame', class: 'sc-frame' },
      h(
        'button',
        { part: 'trigger', class: 'sc-trigger' },
        h('span', { part: 'triggerLabel' }, 'Fruit'),
        ' ',
        h('span', { part: 'triggerDescription' }, 'Apple'),
      ),
      h('span', { class: 'sc-gap' }),
      h(
        'span',
        { part: 'triggerExtras', class: 'sc-extras' },
        nested(
          'button',
          {},
          h(
            'button',
            {
              part: 'root',
              id: 'clear',
              class: 'sc-extra',
              'aria-label': 'Clear Fruit',
            },
            '×',
          ),
        ),
        h('span', { id: 'count' }, '3'),
      ),
    ),
    h(
      'div',
      { part: 'root', class: 'sc-pop', ...rootAttrs },
      h('h2', { part: 'title' }, 'Fruit'),
      h('button', { part: 'close' }, 'Done'),
    ),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

function byId(mounted: MountedPopover, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function root(mounted: MountedPopover): HTMLElement {
  return mounted.part('root');
}

const isInTopLayer = (element: Element) => element.matches(':popover-open');

const isShown = (element: Element) => element.getClientRects().length > 0;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rect = (element: Element) => element.getBoundingClientRect();

async function closed(popover: Element): Promise<void> {
  await expect.poll(() => isShown(popover)).toBe(false);
}

async function retire(mounted: MountedPopover): Promise<void> {
  await mounted.setProps({ isOpen: false });
  await closed(root(mounted));
  mounted.container.hidden = true;
}

function reasons(mounted: MountedPopover): PopoverDismissEvent['reason'][] {
  return mounted.events
    .filter((event) => event.name === 'dismiss')
    .map((event) => (event.detail as PopoverDismissEvent).reason);
}

function activeElement(mounted: MountedPopover): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

function expectNear(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} ≈ ${expected}`,
  ).toBeLessThanOrEqual(1);
}

/** The trigger, the frame and the extras, which carry the same state. */
function expectOnTriggerParts(
  mounted: MountedPopover,
  attribute: string,
  isSet: boolean,
): void {
  for (const name of ['trigger', 'triggerFrame', 'triggerExtras']) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(isSet);
  }
}

/**
 * Runs `run` once per positioning mode. In CSS mode the consumer's anchor
 * positioning places the popover: `css` gives its rule on `.sc-pop`.
 */
async function onEachMode(
  run: (mode: string, css: () => TemplateNode[]) => Promise<void>,
) {
  for (const mode of ['script', 'css'] as const) {
    Reflect.set(globalThis, SETTINGS, { positioning: mode });
    try {
      await run(mode, () =>
        mode === 'script'
          ? []
          : [
              h(
                'style',
                null,
                '.sc-pop { inset: auto; position-area: bottom; position-try-fallbacks: flip-block, flip-inline }',
              ),
            ],
      );
    } finally {
      Reflect.deleteProperty(globalThis, SETTINGS);
    }
  }
}

export const popoverItemsConformance = defineConformance<
  PopoverProps,
  PopoverState
>('popover', ({ scenario, group }) => {
  group('trigger parts', () => {
    scenario(
      'triggerLabel names the trigger and triggerDescription describes it; every trigger part is marked outside the popover',
      async ({ mount }) => {
        const mounted = await mount({ template: picker() });
        const trigger = mounted.part('trigger');
        const label = mounted.part('triggerLabel');
        const description = mounted.part('triggerDescription');
        expect(trigger.getAttribute('aria-labelledby')).toBe(label.id);
        expect(trigger.getAttribute('aria-describedby')).toBe(description.id);
        for (const [part, marker] of [
          ['triggerLabel', 'popover-trigger-label'],
          ['triggerDescription', 'popover-trigger-description'],
          ['triggerFrame', 'popover-trigger-frame'],
          ['triggerExtras', 'popover-trigger-extras'],
        ] as const) {
          expect(mounted.part(part).getAttribute('data-uni-part')).toBe(marker);
        }
        expect(mounted.part('triggerFrame').hasAttribute('role')).toBe(false);
      },
      PHASE,
    );

    scenario(
      'reads the trigger by its label and description, and each extra on its own',
      async ({ mount, spoken }) => {
        await mount({ template: picker() });
        const phrases = await spoken();
        expect(phrases).toContain('button, Fruit, Apple, not expanded');
        expect(phrases).toContain('button, Clear Fruit');
        expect(phrases).toContain('3');
      },
      PHASE,
    );

    scenario(
      'the frame and the extras carry data-open, and hover over the frame is the trigger’s',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: picker() });
        for (const attribute of MIRRORED) {
          expectOnTriggerParts(mounted, attribute, false);
        }

        await pointer.move(mounted.container.querySelector('.sc-gap')!);
        expectOnTriggerParts(mounted, 'data-hovered', true);
        await pointer.move(byId(mounted, 'count'));
        expectOnTriggerParts(mounted, 'data-hovered', true);

        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        expectOnTriggerParts(mounted, 'data-open', true);

        await pointer.move(byId(mounted, 'page'));
        expectOnTriggerParts(mounted, 'data-hovered', false);
        await mounted.setProps({ isOpen: false });
        expectOnTriggerParts(mounted, 'data-open', false);
      },
      PHASE,
    );

    scenario(
      'hover over the frame and opening never re-render the owner',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({ template: picker() });
        const renders = mounted.renderCount();
        await pointer.move(byId(mounted, 'count'));
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        await keyboard.press('Escape');
        await closed(root(mounted));
        await pointer.move(byId(mounted, 'page'));
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('placement', () => {
    scenario(
      'below the frame, centred on it, when there is no anchor part',
      async ({ mount, pointer }) => {
        await onEachMode(async (mode, css) => {
          const mounted = await mount({ template: picker({ head: css() }) });
          const popover = root(mounted);
          await pointer.click(mounted.part('trigger'));
          await expect
            .poll(() => popover.getAttribute('data-placement'))
            .toBe('bottom');
          const f = rect(mounted.part('triggerFrame'));
          const p = rect(popover);
          expectNear(p.top, f.bottom + 8, `${mode}: top`);
          expectNear(
            p.left + p.width / 2,
            f.left + f.width / 2,
            `${mode}: centre`,
          );
          await retire(mounted);
        });
      },
      PHASE,
    );

    scenario(
      'the anchor part takes the frame’s place',
      async ({ mount, pointer }) => {
        await onEachMode(async (mode, css) => {
          const mounted = await mount({
            template: [
              h(
                'style',
                null,
                '.sc-anchor { position: fixed; left: 150px; top: 200px; width: 200px; height: 40px }',
              ),
              h('div', { part: 'anchor', class: 'sc-anchor' }),
              ...picker({ head: css() }),
            ],
          });
          const popover = root(mounted);
          await pointer.click(mounted.part('trigger'));
          await expect
            .poll(() => popover.getAttribute('data-placement'))
            .toBe('bottom');
          const a = rect(mounted.part('anchor'));
          const p = rect(popover);
          expectNear(p.top, a.bottom + 8, `${mode}: top`);
          expectNear(
            p.left + p.width / 2,
            a.left + a.width / 2,
            `${mode}: centre`,
          );
          await retire(mounted);
        });
      },
      PHASE,
    );

    scenario(
      '--anchor-width is the frame’s width, extras included',
      async ({ mount, pointer }) => {
        const fit = h(
          'style',
          null,
          '.sc-pop.sc-fit { width: auto; margin: 8px 0 0; min-width: var(--anchor-width) }',
        );
        await onEachMode(async (mode, css) => {
          const mounted = await mount({
            template: picker({
              head: [fit, ...css()],
              rootAttrs: { class: 'sc-pop sc-fit' },
            }),
          });
          const popover = root(mounted);
          await pointer.click(mounted.part('trigger'));
          await expect
            .poll(() => popover.getAttribute('data-placement'))
            .toBe('bottom');
          const f = rect(mounted.part('triggerFrame'));
          expect(f.width).toBeGreaterThan(rect(mounted.part('trigger')).width);
          expectNear(rect(popover).width, f.width, `${mode}: width`);
          await retire(mounted);
        });
      },
      PHASE,
    );
  });

  group('extras while open', () => {
    scenario(
      'a press on an extra is outside: the popover closes with reason outside, the extra acts and keeps focus',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: picker(), events: EVENTS });
        const clear = byId(mounted, 'clear');
        let clicks = 0;
        clear.addEventListener('click', () => clicks++);
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        mounted.clearEvents();

        await pointer.click(clear);
        expect(clicks).toBe(1);
        expect(reasons(mounted)).toEqual(['outside']);
        await closed(root(mounted));
        await pause(100);
        expect(activeElement(mounted)).toBe(clear);
      },
      PHASE,
    );
  });
});
