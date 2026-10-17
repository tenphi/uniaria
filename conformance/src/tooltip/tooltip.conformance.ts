/**
 * Tooltip conformance, from the spec approved by @tenphi on 2026-10-16
 * (`packages/core/src/components/tooltip/spec.md`): a manual popover with
 * the tooltip role that describes its trigger, or names it with
 * `relation: 'label'`; hover after `delay` and closing after `closeDelay`,
 * hovering the tooltip, visible focus, Escape from anywhere (prevented, not
 * stopped), presses, `trigger: 'focus'`, `isDisabled`, a controlled tooltip,
 * warm-up and one at a time, the closing phase, placement, scrolling, the
 * fallback without the Popover API, the UniAria components that link to it,
 * public state, render counts and spoken output. Phase 4.
 *
 * Warm-up is a per-window registry under `Symbol.for('@uniaria/tooltips/v1')`
 * (spec, Warm-up), so a tooltip a scenario opened would leave the next
 * scenario's page warm. Every scenario starts on a cold page: it removes the
 * registry once the previous scenario's tooltips are gone, and each mount
 * rests the pointer on `#page`, away from every trigger.
 *
 * Not here: removing the trigger of an open tooltip (a template can't remove
 * a part), focus coming back with the window, Escape while composing text,
 * the `tooltip` attribute that links an element by id, and the development
 * warnings; the element tests and the core tests cover them.
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type {
  InputNeed,
  Mounted,
  MountOptions,
  ScenarioContext,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { TooltipProps, TooltipState } from './types';

type MountedTooltip = Mounted<TooltipProps, TooltipState>;
type Context = ScenarioContext<TooltipProps, TooltipState>;

const PHASE = { phase: 4 } as const;

const EVENTS = ['openChange'];

/** The parts that carry the state attributes; the trigger never does. */
const STATE_PARTS = ['root', 'arrow'];

const STATE_ATTRIBUTES = [
  'data-open',
  'data-entering',
  'data-exiting',
  'data-instant',
];

/** The spec's defaults (spec, Props). */
const DELAY = 250;
const CLOSE_DELAY = 500;

/** An exit animation long enough to see the closing phase. */
const EXIT = 400;

/** The page's tooltips (spec, Warm-up). */
const TOOLTIPS = Symbol.for('@uniaria/tooltips/v1');

/** UniAria's development switch for its fallbacks (Popover spec). */
const FALLBACKS = Symbol.for('@uniaria/fallbacks/v1');

/** UniAria's page-wide settings: `positioning` picks the mode. */
const SETTINGS = Symbol.for('@uniaria/settings/v1');

/**
 * Fixed places, so the pointer's paths never cross what a scenario doesn't
 * mean to hover: the trigger at (150, 100), 80×30, and a second one at
 * (330, 100); the tooltip 120×20 above, its 8px margin the gap (spec,
 * Positioning); `#page` (not focusable), where the pointer rests, lower
 * left; `#before` and `#after`, text fields for Tab, at the left.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 400px; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 300px; width: 100px }
   .sc-trigger { position: fixed; left: 150px; top: 100px; width: 80px; height: 30px; margin: 0; padding: 0; box-sizing: border-box }
   .sc-trigger.sc-second { left: 330px }
   .sc-tip { width: 120px; height: 20px; margin: 8px; padding: 0; border: 0; box-sizing: border-box; font: 14px/20px sans-serif; overflow: visible }
   .sc-arrow { position: absolute; width: 10px; height: 10px }
   .sc-arrow[data-placement='top'] { bottom: -5px }
   .sc-arrow[data-placement='bottom'] { top: -5px }
   .sc-pop { width: 160px; margin: 8px; padding: 0; border: 0; box-sizing: border-box }
   .sc-after { position: fixed; left: 0; top: 340px; width: 100px }`,
);

interface TipOptions {
  /** What the tooltip describes: its trigger part "Save" by default. */
  readonly target?: TemplateNode;
  readonly text?: string;
  /** Markup before the page content, such as a stylesheet. */
  readonly head?: readonly TemplateNode[];
  /** Content between the target and the tooltip, such as an anchor part. */
  readonly between?: readonly TemplateNode[];
}

/**
 * The trigger part, a plain button. With a tabindex: WebKit tabs to a button
 * only with one, as macOS.
 */
function triggerPart(label = 'Save', className = ''): TemplateNode {
  return h(
    'button',
    {
      part: 'trigger',
      class: `sc-trigger ${className}`.trim(),
      tabindex: '0',
    },
    label,
  );
}

/** A UniAria Button "Save" in the trigger's place, linked to the tooltip. */
function saveButton(
  props: Readonly<Record<string, unknown>> = {},
): TemplateNode {
  return nested(
    'button',
    props,
    h('button', { part: 'root', class: 'sc-trigger' }, 'Save'),
  );
}

/**
 * The page and a tooltip "Saves the file" with an arrow, right after what
 * it describes.
 */
function tip({
  target = triggerPart(),
  text = 'Saves the file',
  head = [],
  between = [],
}: TipOptions = {}): TemplateNode[] {
  return [
    LAYOUT,
    ...head,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    target,
    ...between,
    h(
      'div',
      { part: 'root', class: 'sc-tip' },
      text,
      h('div', { part: 'arrow', class: 'sc-arrow' }),
    ),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

/** A second tooltip, "Opens a file" on the trigger "Open" to the right. */
function second(head: readonly TemplateNode[] = []): TemplateNode[] {
  return tip({
    target: triggerPart('Open', 'sc-second'),
    text: 'Opens a file',
    head,
  });
}

/** A stylesheet that animates the tooltip while it exits. */
const exitAnimation = h(
  'style',
  null,
  `@keyframes uni-conformance-fade { to { opacity: 0 } }
   .sc-tip[data-exiting] { animation: uni-conformance-fade ${EXIT}ms linear forwards }`,
);

function byId(mounted: MountedTooltip, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

/** A part of a component nested in the template. */
function partOf(
  mounted: MountedTooltip,
  scope: string,
  part: string,
): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(
    `[data-scope="${scope}"][data-part="${part}"]`,
  )!;
}

function root(mounted: MountedTooltip): HTMLElement {
  return mounted.part('root');
}

/** In the top layer through the Popover API. */
const isInTopLayer = (element: Element) => element.matches(':popover-open');

/** Rendered at all: in the top layer or, in the fallback, in place. */
const isShown = (element: Element) => element.getClientRects().length > 0;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rect = (element: Element) => element.getBoundingClientRect();

/** Layout positions agree to a pixel: engines round subpixels differently. */
function expectNear(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} ≈ ${expected}`,
  ).toBeLessThanOrEqual(1);
}

/** Waits until the tooltip has finished closing. */
async function closed(element: Element): Promise<void> {
  await expect.poll(() => isShown(element)).toBe(false);
}

/** The `openChange` details so far, in order. */
function openChanges(mounted: MountedTooltip): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'openChange')
    .map((event) => event.detail);
}

function activeElement(mounted: MountedTooltip): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** A state attribute is on the root and the arrow, or on neither. */
function expectState(
  mounted: MountedTooltip,
  attribute: string,
  present: boolean,
): void {
  for (const name of STATE_PARTS) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(present);
  }
}

/** Records which parts an attribute was ever added to, until `stop()`. */
function watchAttribute(
  mounted: MountedTooltip,
  attribute: string,
): { readonly parts: Set<string>; stop(): void } {
  const parts = new Set<string>();
  const view = mounted.container.ownerDocument.defaultView!;
  const observer = new view.MutationObserver((records) => {
    for (const record of records) {
      const element = record.target as Element;
      if (element.hasAttribute(attribute)) {
        parts.add(element.getAttribute('data-part') ?? '');
      }
    }
  });
  observer.observe(mounted.container, {
    attributes: true,
    attributeFilter: [attribute],
    subtree: true,
  });
  return { parts, stop: () => observer.disconnect() };
}

/** Rests the pointer on `#page`, off every trigger and tooltip. */
async function rest(
  { pointer }: Context,
  mounted: MountedTooltip,
): Promise<void> {
  await pointer.move(byId(mounted, 'page'));
}

/** Hovers `target` and waits for the tooltip to open. */
async function hoverOpen(
  { pointer }: Context,
  mounted: MountedTooltip,
  target: Element = mounted.part('trigger'),
): Promise<void> {
  await pointer.move(target);
  await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
}

/** Tabs from `#before` onto what follows it, the trigger. */
async function tabOnto(
  { keyboard }: Context,
  mounted: MountedTooltip,
): Promise<void> {
  byId(mounted, 'before').focus();
  await keyboard.tab();
}

/**
 * Closes the tooltip and hides its page, so the next mount in the same
 * scenario starts from a clean screen (the runner removes containers only
 * when the scenario ends).
 */
async function retire(
  context: Context,
  mounted: MountedTooltip,
): Promise<void> {
  (activeElement(mounted) as HTMLElement | null)?.blur();
  await rest(context, mounted);
  await closed(root(mounted));
  mounted.container.hidden = true;
}

/**
 * Runs `run` once per positioning mode, with UniAria's setting for it. In
 * CSS mode the consumer's anchor positioning places the tooltip: `css` gives
 * the defaults as the consumer's rule on `.sc-tip` there, and nothing in
 * script mode.
 */
async function onEachMode(
  run: (mode: string, css: TemplateNode[]) => Promise<void>,
) {
  for (const mode of ['script', 'css'] as const) {
    Reflect.set(globalThis, SETTINGS, { positioning: mode });
    try {
      await run(
        mode,
        mode === 'script'
          ? []
          : [
              h(
                'style',
                null,
                '.sc-tip { inset: auto; position-area: top; position-try-fallbacks: flip-block, flip-inline }',
              ),
            ],
      );
    } finally {
      Reflect.deleteProperty(globalThis, SETTINGS);
    }
  }
}

export const tooltipConformance = defineConformance<TooltipProps, TooltipState>(
  'tooltip',
  ({ scenario: define, group }) => {
    /**
     * Every scenario starts on a cold page, and every mount rests the
     * pointer on `#page` (see the file comment).
     */
    const scenario = (
      name: string,
      run: (context: Context) => Promise<void>,
      needs: readonly InputNeed[] = [],
    ) =>
      define(
        name,
        (context) => {
          Reflect.deleteProperty(window, TOOLTIPS);
          return run({
            ...context,
            async mount(options: MountOptions<TooltipProps>) {
              const mounted = await context.mount(options);
              await rest(context, mounted);
              return mounted;
            },
          });
        },
        { ...PHASE, needs },
      );

    group('anatomy', () => {
      scenario(
        'a hidden manual popover with the tooltip role, describing its trigger',
        async ({ mount }) => {
          const mounted = await mount({ template: tip() });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          expect(tooltip.getAttribute('popover')).toBe('manual');
          expect(tooltip.getAttribute('role')).toBe('tooltip');
          expect(tooltip.id).not.toBe('');
          expect(tooltip.hasAttribute('tabindex')).toBe(false);
          expect(isInTopLayer(tooltip)).toBe(false);
          expect(isShown(tooltip)).toBe(false);
          expect(mounted.part('arrow').getAttribute('aria-hidden')).toBe(
            'true',
          );

          expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
          for (const name of [
            'aria-labelledby',
            'aria-expanded',
            'aria-haspopup',
            'aria-controls',
          ]) {
            expect(trigger.hasAttribute(name), name).toBe(false);
          }
          for (const attribute of [...STATE_ATTRIBUTES, 'data-placement']) {
            expectState(mounted, attribute, false);
            expect(trigger.hasAttribute(attribute), attribute).toBe(false);
          }
          expect(mounted.state()).toEqual({
            isOpen: false,
            isEntering: false,
            isExiting: false,
            isInstant: false,
            placement: undefined,
          });
        },
      );

      scenario(
        'relation label names the trigger by the tooltip instead',
        async ({ mount }) => {
          const mounted = await mount({
            template: tip(),
            props: { relation: 'label' },
          });
          const trigger = mounted.part('trigger');
          expect(trigger.getAttribute('aria-labelledby')).toBe(
            root(mounted).id,
          );
          expect(trigger.hasAttribute('aria-describedby')).toBe(false);
          expect(root(mounted).getAttribute('role')).toBe('tooltip');
        },
      );
    });

    group('hover', () => {
      scenario(
        'the pointer resting on the trigger opens it after its delay, in the top layer above the trigger, and reports it',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const entering = watchAttribute(mounted, 'data-entering');

          const started = performance.now();
          await context.pointer.move(mounted.part('trigger'));
          expect(isShown(tooltip)).toBe(false);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
          expect(performance.now() - started).toBeGreaterThanOrEqual(DELAY);
          expect(openChanges(mounted)).toEqual([true]);
          expectState(mounted, 'data-open', true);
          expectState(mounted, 'data-instant', false);
          expect(mounted.part('trigger').hasAttribute('data-open')).toBe(false);

          // Entering for the first frames only, on the root and the arrow.
          await expect
            .poll(() => tooltip.hasAttribute('data-entering'))
            .toBe(false);
          entering.stop();
          expect([...entering.parts].sort()).toEqual([...STATE_PARTS].sort());
          await expect
            .poll(() => mounted.state())
            .toEqual({
              isOpen: true,
              isEntering: false,
              isExiting: false,
              isInstant: false,
              placement: 'top',
            });
        },
      );

      scenario(
        'delay sets how long the pointer rests first',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            props: { delay: 700 },
          });
          await context.pointer.move(mounted.part('trigger'));
          await pause(450);
          expect(isShown(root(mounted))).toBe(false);
          await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        },
      );

      scenario(
        'leaving the trigger before the delay ends cancels it',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          await context.pointer.move(mounted.part('trigger'));
          await pause(100);
          await rest(context, mounted);
          await pause(DELAY + 150);
          expect(isShown(root(mounted))).toBe(false);
          expect(mounted.events).toEqual([]);
        },
      );

      scenario(
        'leaving closes it after its close delay, and coming back before then keeps it open',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await hoverOpen(context, mounted);

          await rest(context, mounted);
          await pause(200);
          expect(isInTopLayer(tooltip)).toBe(true);
          await context.pointer.move(mounted.part('trigger'));
          await pause(CLOSE_DELAY);
          expect(isInTopLayer(tooltip)).toBe(true);
          expect(openChanges(mounted)).toEqual([true]);

          const left = performance.now();
          await rest(context, mounted);
          await expect.poll(() => mounted.state().isOpen).toBe(false);
          expect(performance.now() - left).toBeGreaterThanOrEqual(CLOSE_DELAY);
          expect(openChanges(mounted)).toEqual([true, false]);
          await closed(tooltip);
          expect(mounted.state().placement).toBe(undefined);
        },
      );

      scenario(
        'hovering the tooltip keeps it open, and leaving both closes it',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await hoverOpen(context, mounted);

          await context.pointer.move(tooltip);
          await pause(CLOSE_DELAY + 200);
          expect(isInTopLayer(tooltip)).toBe(true);
          expect(openChanges(mounted)).toEqual([true]);

          await rest(context, mounted);
          await closed(tooltip);
          expect(openChanges(mounted)).toEqual([true, false]);
        },
      );

      scenario(
        'touch never opens it',
        async (context) => {
          const { touch } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          await touch.tap(trigger);
          await pause(DELAY + 150);
          expect(isShown(root(mounted))).toBe(false);

          await touch.down(trigger);
          await pause(DELAY + 150);
          expect(isShown(root(mounted))).toBe(false);
          await touch.up();
          expect(mounted.events).toEqual([]);
        },
        ['touch'],
      );
    });

    group('focus', () => {
      scenario(
        'visible keyboard focus opens it at once, and focus leaving closes it at once',
        async (context) => {
          const { keyboard } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');

          await tabOnto(context, mounted);
          expect(activeElement(mounted)).toBe(trigger);
          expect(mounted.state().isOpen).toBe(true);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
          expectState(mounted, 'data-instant', false);

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'after'));
          expect(mounted.state().isOpen).toBe(false);
          await closed(tooltip);

          await keyboard.tab({ isBackward: true });
          expect(activeElement(mounted)).toBe(trigger);
          expect(mounted.state().isOpen).toBe(true);
          expect(openChanges(mounted)).toEqual([true, false, true]);
        },
      );

      scenario(
        'focus from a pointer press does not open it',
        async (context) => {
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          // Whether a click focuses a button is the browser's (WebKit
          // doesn't), so focus follows it from script.
          await context.pointer.click(trigger);
          trigger.focus();
          await pause(DELAY + 150);
          expect(isShown(root(mounted))).toBe(false);
          expect(mounted.events).toEqual([]);
        },
      );

      scenario(
        'focus a Popover returns to its trigger as it closes does not open it',
        async (context) => {
          const { keyboard } = context;
          const mounted = await context.mount({
            template: tip({
              target: nested(
                'popover',
                {},
                h('button', { part: 'trigger', class: 'sc-trigger' }, 'Size'),
                h(
                  'div',
                  { part: 'root', class: 'sc-pop' },
                  h('input', { id: 'width', 'aria-label': 'Width' }),
                ),
              ),
              text: 'Column size',
            }),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const size = partOf(mounted, 'popover', 'trigger');
          const popover = partOf(mounted, 'popover', 'root');

          await tabOnto(context, mounted);
          expect(activeElement(mounted)).toBe(size);
          expect(mounted.state().isOpen).toBe(true);

          // Enter is a press: it closes the tooltip and opens the popover.
          await keyboard.press('Enter');
          await expect.poll(() => isInTopLayer(popover)).toBe(true);
          expect(mounted.state().isOpen).toBe(false);

          await keyboard.press('Escape');
          await expect.poll(() => activeElement(mounted)).toBe(size);
          await pause(200);
          expect(isShown(tooltip)).toBe(false);
          expect(openChanges(mounted)).toEqual([true, false]);
        },
      );

      scenario('hover and focus each hold it open', async (context) => {
        const { pointer, keyboard } = context;
        const mounted = await context.mount({
          template: tip(),
          events: EVENTS,
        });
        const tooltip = root(mounted);
        const trigger = mounted.part('trigger');

        // Focus holds it while the pointer passes over and leaves.
        await tabOnto(context, mounted);
        await pointer.move(trigger);
        await rest(context, mounted);
        await pause(CLOSE_DELAY + 200);
        expect(isInTopLayer(tooltip)).toBe(true);

        // The pointer holds it after focus leaves.
        await pointer.move(trigger);
        await keyboard.tab();
        await pause(100);
        expect(isInTopLayer(tooltip)).toBe(true);
        expect(openChanges(mounted)).toEqual([true]);

        await rest(context, mounted);
        await closed(tooltip);
        expect(openChanges(mounted)).toEqual([true, false]);
      });
    });

    group('Escape', () => {
      scenario(
        'closes it from anywhere and prevents its default without stopping it; it stays closed until the pointer comes back',
        async (context) => {
          const { keyboard, pointer } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const document = mounted.container.ownerDocument;
          const prevented: boolean[] = [];
          const record = (event: KeyboardEvent) => {
            if (event.key === 'Escape') prevented.push(event.defaultPrevented);
          };
          document.addEventListener('keydown', record);
          try {
            // Closed, it leaves Escape alone.
            byId(mounted, 'after').focus();
            await keyboard.press('Escape');
            expect(prevented).toEqual([false]);

            await hoverOpen(context, mounted);
            await keyboard.press('Escape');
            expect(prevented).toEqual([false, true]);
            expect(mounted.state().isOpen).toBe(false);
            await closed(tooltip);

            // The pointer still rests on the trigger.
            await pause(DELAY + 150);
            expect(isShown(tooltip)).toBe(false);

            await rest(context, mounted);
            await pointer.move(mounted.part('trigger'));
            await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
            expect(openChanges(mounted)).toEqual([true, false, true]);
          } finally {
            document.removeEventListener('keydown', record);
          }
        },
      );

      scenario(
        'the first Escape closes the tooltip and the second the Popover it describes the trigger of',
        async (context) => {
          const { keyboard, pointer } = context;
          const mounted = await context.mount({
            template: tip({
              target: nested(
                'popover',
                { isNonModal: true },
                h('button', { part: 'trigger', class: 'sc-trigger' }, 'Size'),
                h(
                  'div',
                  { part: 'root', class: 'sc-pop' },
                  h('input', { id: 'width', 'aria-label': 'Width' }),
                ),
              ),
              text: 'Column size',
            }),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const size = partOf(mounted, 'popover', 'trigger');
          const popover = partOf(mounted, 'popover', 'root');

          await pointer.click(size);
          await expect.poll(() => isInTopLayer(popover)).toBe(true);
          // The press keeps the tooltip closed until the pointer comes back.
          await rest(context, mounted);
          await hoverOpen(context, mounted, size);

          await keyboard.press('Escape');
          expect(mounted.state().isOpen).toBe(false);
          await closed(tooltip);
          expect(isInTopLayer(popover)).toBe(true);

          await keyboard.press('Escape');
          await expect.poll(() => isInTopLayer(popover)).toBe(false);
        },
      );
    });

    group('presses', () => {
      scenario(
        'a pointer press on the trigger closes it at once, and it stays closed until the pointer leaves and comes back',
        async (context) => {
          const { pointer } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          await hoverOpen(context, mounted);

          await pointer.down(trigger);
          expect(mounted.state().isOpen).toBe(false);
          await pointer.up();
          await closed(tooltip);
          await pause(DELAY + 150);
          expect(isShown(tooltip)).toBe(false);

          await pointer.moveOutside(trigger);
          await pointer.move(trigger);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
          expect(openChanges(mounted)).toEqual([true, false, true]);
        },
      );

      scenario(
        'a key on the focused trigger closes it, but not a lone modifier; it stays closed until focus leaves and comes back',
        async (context) => {
          const { keyboard } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await tabOnto(context, mounted);
          expect(mounted.state().isOpen).toBe(true);

          for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
            await keyboard.press(key);
            expect(mounted.state().isOpen, key).toBe(true);
          }
          await keyboard.press('ArrowDown');
          expect(mounted.state().isOpen).toBe(false);
          await closed(tooltip);
          await pause(200);
          expect(isShown(tooltip)).toBe(false);

          await keyboard.tab();
          await keyboard.tab({ isBackward: true });
          expect(mounted.state().isOpen).toBe(true);
          expect(openChanges(mounted)).toEqual([true, false, true]);
        },
      );
    });

    group('trigger focus', () => {
      scenario(
        'opens on visible focus only: hover neither opens it nor holds it open',
        async (context) => {
          const { pointer, keyboard } = context;
          const mounted = await context.mount({
            template: tip(),
            props: { trigger: 'focus' },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          await pointer.move(trigger);
          await pause(DELAY + 150);
          expect(isShown(tooltip)).toBe(false);

          await tabOnto(context, mounted);
          expect(mounted.state().isOpen).toBe(true);
          await pointer.move(trigger);
          await keyboard.tab();
          expect(mounted.state().isOpen).toBe(false);
          await closed(tooltip);
          expect(openChanges(mounted)).toEqual([true, false]);
        },
      );
    });

    group('disabled', () => {
      scenario(
        'isDisabled never opens it and takes the relation off the trigger',
        async (context) => {
          const { pointer } = context;
          const mounted = await context.mount({
            template: tip(),
            props: { isDisabled: true },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          expect(trigger.hasAttribute('aria-describedby')).toBe(false);

          await pointer.move(trigger);
          await pause(DELAY + 150);
          expect(isShown(tooltip)).toBe(false);
          await rest(context, mounted);
          await tabOnto(context, mounted);
          expect(activeElement(mounted)).toBe(trigger);
          await pause(100);
          expect(isShown(tooltip)).toBe(false);
          expect(mounted.events).toEqual([]);

          await mounted.setProps({ isDisabled: false });
          expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
        },
      );

      scenario('setting isDisabled while open closes it', async (context) => {
        const mounted = await context.mount({
          template: tip(),
          events: EVENTS,
        });
        await hoverOpen(context, mounted);
        await mounted.setProps({ isDisabled: true });
        await closed(root(mounted));
        expect(openChanges(mounted)).toEqual([true, false]);
      });
    });

    group('controlled', () => {
      scenario(
        'isOpen opens and closes it without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: tip(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
          expectState(mounted, 'data-open', true);
          expect(mounted.state().isOpen).toBe(true);

          await mounted.setProps({ isOpen: false });
          await closed(tooltip);
          expect(mounted.events).toEqual([]);
        },
      );

      scenario(
        'a close only reports; the tooltip stays open until the consumer closes it',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: tip(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);

          await keyboard.press('Escape');
          expect(openChanges(mounted)).toEqual([false]);
          await pause(100);
          expect(isInTopLayer(tooltip)).toBe(true);

          await mounted.setProps({ isOpen: false });
          await closed(tooltip);
        },
      );

      scenario(
        'defaultOpen opens it on mount without reporting a change',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: tip(),
            props: { defaultOpen: true },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
          expect(mounted.events).toEqual([]);

          await keyboard.press('Escape');
          await closed(tooltip);
          expect(openChanges(mounted)).toEqual([false]);
        },
      );
    });

    group('warm-up', () => {
      scenario(
        'once one has shown, the next opens at once with data-instant and closes the first without its closing phase',
        async (context) => {
          const { pointer } = context;
          const first = await context.mount({
            template: tip({ head: [exitAnimation] }),
            events: EVENTS,
          });
          const next = await context.mount({
            template: second([exitAnimation]),
            events: EVENTS,
          });
          const exiting = watchAttribute(first, 'data-exiting');

          await hoverOpen(context, first);
          expectState(first, 'data-instant', false);

          await pointer.move(next.part('trigger'));
          await expect.poll(() => isInTopLayer(root(next))).toBe(true);
          expectState(next, 'data-instant', true);
          expect(next.state().isInstant).toBe(true);
          expect(isInTopLayer(root(first))).toBe(false);
          exiting.stop();
          expect([...exiting.parts]).toEqual([]);
          expect(openChanges(first)).toEqual([true, false]);
          expect(openChanges(next)).toEqual([true]);
        },
      );

      scenario(
        'the page stays warm for the longer of 500ms and the close delay after the last one closed, then the next waits again',
        async (context) => {
          const { pointer } = context;
          const first = await context.mount({
            template: tip(),
            props: { closeDelay: 100 },
          });
          const next = await context.mount({
            template: second(),
            props: { closeDelay: 900 },
          });

          // Cold: it waits.
          await hoverOpen(context, first);
          expectState(first, 'data-instant', false);

          // Warm for 500ms after a close delay of 100.
          await rest(context, first);
          await expect.poll(() => first.state().isOpen).toBe(false);
          await pointer.move(next.part('trigger'));
          await expect.poll(() => isInTopLayer(root(next))).toBe(true);
          expectState(next, 'data-instant', true);

          // Warm for 900ms after a close delay of 900.
          await rest(context, first);
          await expect
            .poll(() => next.state().isOpen, { timeout: 2000 })
            .toBe(false);
          await pause(650);
          await pointer.move(first.part('trigger'));
          await expect.poll(() => isInTopLayer(root(first))).toBe(true);
          expectState(first, 'data-instant', true);

          // Cold again.
          await rest(context, first);
          await expect.poll(() => first.state().isOpen).toBe(false);
          await pause(700);
          await pointer.move(next.part('trigger'));
          await pause(100);
          expect(isShown(root(next))).toBe(false);
          await expect.poll(() => isInTopLayer(root(next))).toBe(true);
          expectState(next, 'data-instant', false);
        },
      );

      scenario(
        'moving to another trigger while waiting starts the wait again, for that one',
        async (context) => {
          const { pointer } = context;
          const first = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const next = await context.mount({
            template: second(),
            events: EVENTS,
          });
          await pointer.move(first.part('trigger'));
          await pause(150);
          await pointer.move(next.part('trigger'));
          await pause(150);
          expect(isShown(root(first))).toBe(false);
          expect(isShown(root(next))).toBe(false);

          await expect.poll(() => isInTopLayer(root(next))).toBe(true);
          expect(first.events).toEqual([]);
          expectState(next, 'data-instant', false);
        },
      );

      scenario(
        'focus opens at once and makes the page warm',
        async (context) => {
          const { keyboard, pointer } = context;
          const first = await context.mount({ template: tip() });
          const next = await context.mount({ template: second() });
          await tabOnto(context, first);
          expect(first.state().isOpen).toBe(true);
          await keyboard.tab();
          expect(first.state().isOpen).toBe(false);

          await pointer.move(next.part('trigger'));
          await expect.poll(() => isInTopLayer(root(next))).toBe(true);
          expectState(next, 'data-instant', true);
        },
      );

      scenario(
        'a controlled tooltip kept open stays open beside the next one',
        async (context) => {
          const first = await context.mount({
            template: tip(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const next = await context.mount({ template: second() });
          await expect.poll(() => isInTopLayer(root(first))).toBe(true);

          await hoverOpen(context, next);
          expect(openChanges(first)).toEqual([false]);
          expect(isInTopLayer(root(first))).toBe(true);

          await rest(context, next);
          await closed(root(next));
          expect(isInTopLayer(root(first))).toBe(true);
        },
      );
    });

    group('closing phase', () => {
      scenario(
        'stays shown and exiting until its exit animation ends; hovering again while it exits opens it again',
        async (context) => {
          const { pointer } = context;
          const mounted = await context.mount({
            template: tip({ head: [exitAnimation] }),
            props: { closeDelay: 0 },
            events: EVENTS,
          });
          const tooltip = root(mounted);
          await hoverOpen(context, mounted);

          await rest(context, mounted);
          await expect
            .poll(() => tooltip.hasAttribute('data-exiting'))
            .toBe(true);
          expectState(mounted, 'data-exiting', true);
          expectState(mounted, 'data-open', false);
          expect(isInTopLayer(tooltip)).toBe(true);
          expect(mounted.state()).toMatchObject({
            isOpen: false,
            isExiting: true,
          });

          await pointer.move(mounted.part('trigger'));
          await expect.poll(() => tooltip.hasAttribute('data-open')).toBe(true);
          expectState(mounted, 'data-exiting', false);
          expect(isInTopLayer(tooltip)).toBe(true);

          await rest(context, mounted);
          await closed(tooltip);
          expect(openChanges(mounted)).toEqual([true, false, true, false]);
        },
      );
    });

    group('positioning', () => {
      scenario(
        'above the trigger by default: centred, its 8px margin away, with data-placement top on the tooltip and the arrow',
        async (context) => {
          await onEachMode(async (mode, css) => {
            const mounted = await context.mount({
              template: tip({ head: css }),
            });
            const tooltip = root(mounted);
            const trigger = mounted.part('trigger');
            await tabOnto(context, mounted);
            await expect
              .poll(() => tooltip.getAttribute('data-placement'))
              .toBe('top');
            expect(mounted.part('arrow').getAttribute('data-placement')).toBe(
              'top',
            );
            expect(mounted.state().placement, mode).toBe('top');
            expectNear(rect(tooltip).bottom, rect(trigger).top - 8, mode);
            expectNear(
              rect(tooltip).left + rect(tooltip).width / 2,
              rect(trigger).left + rect(trigger).width / 2,
              mode,
            );
            await retire(context, mounted);
          });
        },
      );

      scenario(
        'flips below the trigger without room above, and says so',
        async (context) => {
          const mounted = await context.mount({
            template: tip({
              head: [h('style', null, '.sc-trigger { top: 4px }')],
            }),
          });
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          await tabOnto(context, mounted);
          await expect
            .poll(() => tooltip.getAttribute('data-placement'))
            .toBe('bottom');
          expect(mounted.part('arrow').getAttribute('data-placement')).toBe(
            'bottom',
          );
          expect(mounted.state().placement).toBe('bottom');
          expectNear(rect(tooltip).top, rect(trigger).bottom + 8, 'top');
        },
      );

      scenario('the anchor part takes the trigger’s place', async (context) => {
        const mounted = await context.mount({
          template: tip({
            head: [
              h(
                'style',
                null,
                '.sc-anchor { position: fixed; left: 300px; top: 200px; width: 40px; height: 40px }',
              ),
            ],
            between: [h('div', { part: 'anchor', class: 'sc-anchor' })],
          }),
        });
        const tooltip = root(mounted);
        const anchor = mounted.part('anchor');
        await tabOnto(context, mounted);
        await expect
          .poll(() => tooltip.getAttribute('data-placement'))
          .toBe('top');
        expectNear(rect(tooltip).bottom, rect(anchor).top - 8, 'bottom');
        expectNear(
          rect(tooltip).left + rect(tooltip).width / 2,
          rect(anchor).left + rect(anchor).width / 2,
          'centre',
        );
      });

      scenario(
        'follows its trigger as it scrolls, and closes once the trigger is scrolled out of view, leaving focus alone',
        async (context) => {
          const box = h(
            'style',
            null,
            `.sc-box { position: fixed; left: 100px; top: 60px; width: 300px; height: 120px; overflow: auto }
             .sc-box .sc-trigger { position: static; display: block; margin: 60px 0 0 50px }
             .sc-spacer { height: 1000px }`,
          );
          const mounted = await context.mount({
            template: [
              LAYOUT,
              box,
              h('p', { id: 'page', class: 'sc-page' }, 'Page'),
              h('input', {
                id: 'before',
                class: 'sc-before',
                'aria-label': 'Before',
              }),
              // tabindex: Firefox's Tab stops on a scroller first.
              h(
                'div',
                { id: 'box', class: 'sc-box', tabindex: '-1' },
                triggerPart(),
                h('div', { part: 'root', class: 'sc-tip' }, 'Saves the file'),
                h('div', { class: 'sc-spacer' }),
              ),
            ],
            events: EVENTS,
          });
          const scroller = byId(mounted, 'box');
          const tooltip = root(mounted);
          const trigger = mounted.part('trigger');
          await tabOnto(context, mounted);
          await expect
            .poll(() => tooltip.getAttribute('data-placement'))
            .toBe('top');

          scroller.scrollTop = 20;
          await expect
            .poll(() => Math.round(rect(trigger).top - rect(tooltip).bottom))
            .toBe(8);
          expect(isInTopLayer(tooltip)).toBe(true);

          scroller.scrollTop = 300;
          await expect.poll(() => mounted.state().isOpen).toBe(false);
          await closed(tooltip);
          expect(activeElement(mounted)).toBe(trigger);
          expect(scroller.scrollTop).toBe(300);
          expect(openChanges(mounted)).toEqual([true, false]);
        },
      );
    });

    group('without the Popover API', () => {
      scenario(
        'opens in place with fixed position above the trigger, hidden while closed',
        async (context) => {
          const { keyboard } = context;
          Reflect.set(window, FALLBACKS, { popover: false });
          try {
            const mounted = await context.mount({ template: tip() });
            const tooltip = root(mounted);
            const trigger = mounted.part('trigger');
            await expect.poll(() => tooltip.hasAttribute('hidden')).toBe(true);
            expect(tooltip.hasAttribute('popover')).toBe(false);
            expect(isShown(tooltip)).toBe(false);

            await tabOnto(context, mounted);
            await expect
              .poll(() => tooltip.getAttribute('data-placement'))
              .toBe('top');
            expect(isInTopLayer(tooltip)).toBe(false);
            expect(isShown(tooltip)).toBe(true);
            expect(getComputedStyle(tooltip).position).toBe('fixed');
            expectNear(rect(tooltip).bottom, rect(trigger).top - 8, 'bottom');

            await keyboard.tab();
            await closed(tooltip);
            expect(tooltip.hasAttribute('hidden')).toBe(true);
          } finally {
            Reflect.deleteProperty(window, FALLBACKS);
          }
        },
      );
    });

    group('linked components', () => {
      scenario(
        'a Button linked to it carries the relation and drives it with hover, visible focus and presses, as its anchor',
        async (context) => {
          const { pointer } = context;
          const mounted = await context.mount({
            template: tip({ target: saveButton() }),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const button = partOf(mounted, 'button', 'root');
          expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);

          await hoverOpen(context, mounted, button);
          await expect
            .poll(() => tooltip.getAttribute('data-placement'))
            .toBe('top');
          expectNear(rect(tooltip).bottom, rect(button).top - 8, 'bottom');
          await pointer.down(button);
          expect(mounted.state().isOpen).toBe(false);
          await pointer.up();
          await rest(context, mounted);
          await closed(tooltip);

          await tabOnto(context, mounted);
          expect(activeElement(mounted)).toBe(button);
          expect(mounted.state().isOpen).toBe(true);
          expect(openChanges(mounted)).toEqual([true, false, true]);
        },
      );

      scenario(
        'a Checkbox takes hover on its root and focus on its input, which it describes',
        async (context) => {
          const { pointer } = context;
          const mounted = await context.mount({
            template: tip({
              target: nested(
                'checkbox',
                {},
                h(
                  'label',
                  { part: 'root', class: 'sc-trigger' },
                  // tabindex: WebKit tabs to a checkbox only with one, as macOS.
                  h('input', {
                    part: 'input',
                    type: 'checkbox',
                    tabindex: '0',
                  }),
                  h('span', { part: 'label' }, 'Email me'),
                ),
              ),
              text: 'Once a week',
            }),
            events: EVENTS,
          });
          const tooltip = root(mounted);
          const label = partOf(mounted, 'checkbox', 'root');
          const input = partOf(mounted, 'checkbox', 'input');
          expect(input.getAttribute('aria-describedby')).toBe(tooltip.id);
          expect(label.hasAttribute('aria-describedby')).toBe(false);

          await hoverOpen(
            context,
            mounted,
            partOf(mounted, 'checkbox', 'label'),
          );
          await expect
            .poll(() => tooltip.getAttribute('data-placement'))
            .toBe('top');
          expectNear(rect(tooltip).bottom, rect(label).top - 8, 'bottom');
          await rest(context, mounted);
          await closed(tooltip);

          await tabOnto(context, mounted);
          expect(activeElement(mounted)).toBe(input);
          expect(mounted.state().isOpen).toBe(true);
          await pointer.move(label);
          expect(openChanges(mounted)).toEqual([true, false, true]);
        },
      );

      scenario(
        'each linking component carries the relation on its focusable part; a component inside another one does not link',
        async ({ mount }) => {
          const targets: [string, TemplateNode, string, string][] = [
            [
              'toggle button',
              nested(
                'toggle-button',
                {},
                h('button', { part: 'root', class: 'sc-trigger' }, 'Bold'),
              ),
              'toggle-button',
              'root',
            ],
            [
              'switch',
              nested(
                'switch',
                {},
                h(
                  'label',
                  { part: 'root', class: 'sc-trigger' },
                  h('input', { part: 'input', type: 'checkbox' }),
                  h('span', { part: 'label' }, 'Wi-Fi'),
                ),
              ),
              'switch',
              'input',
            ],
            [
              'text field',
              nested(
                'text-field',
                {},
                h('label', { part: 'label' }, 'Name'),
                h('input', { part: 'input', class: 'sc-trigger' }),
              ),
              'text-field',
              'input',
            ],
            [
              'dialog trigger',
              nested(
                'dialog',
                {},
                h('button', { part: 'trigger', class: 'sc-trigger' }, 'Delete'),
                h(
                  'dialog',
                  { part: 'root' },
                  h('h2', { part: 'title' }, 'Delete the file'),
                ),
              ),
              'dialog',
              'trigger',
            ],
            [
              'popover trigger',
              nested(
                'popover',
                {},
                h('button', { part: 'trigger', class: 'sc-trigger' }, 'Size'),
                h('div', { part: 'root', class: 'sc-pop' }, saveButton()),
              ),
              'popover',
              'trigger',
            ],
          ];
          for (const [what, target, scope, part] of targets) {
            const mounted = await mount({ template: tip({ target }) });
            expect(
              partOf(mounted, scope, part).getAttribute('aria-describedby'),
              what,
            ).toBe(root(mounted).id);
            mounted.container.hidden = true;
          }
          // The Button inside the popover links to nothing.
          const inside = await mount({
            template: tip({ target: targets[4]![1] }),
          });
          expect(
            partOf(inside, 'button', 'root').hasAttribute('aria-describedby'),
          ).toBe(false);
        },
      );

      scenario(
        'a natively disabled Button still opens it on hover',
        async (context) => {
          const mounted = await context.mount({
            template: tip({ target: saveButton({ isDisabled: true }) }),
          });
          const button = partOf(mounted, 'button', 'root');
          expect((button as HTMLButtonElement).disabled).toBe(true);
          await hoverOpen(context, mounted, button);
        },
      );
    });

    group('state', () => {
      scenario(
        'opening, placing and closing never re-render the owner',
        async (context) => {
          const { keyboard } = context;
          const mounted = await context.mount({
            template: tip(),
            events: EVENTS,
          });
          const renders = mounted.renderCount();
          await hoverOpen(context, mounted);
          await expect
            .poll(() => root(mounted).getAttribute('data-placement'))
            .toBe('top');
          await keyboard.press('Escape');
          await closed(root(mounted));
          expect(openChanges(mounted)).toEqual([true, false]);
          expect(mounted.renderCount()).toBe(renders);
        },
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the trigger with the tooltip as its description, closed or open, and the open tooltip',
        async (context) => {
          const mounted = await context.mount({ template: tip() });
          const closedPhrases = await context.spoken();
          expect(closedPhrases).toContain('button, Save, Saves the file');
          expect(closedPhrases).not.toContain('tooltip, Saves the file');

          await hoverOpen(context, mounted);
          const openPhrases = await context.spoken();
          expect(openPhrases).toContain('button, Save, Saves the file');
          expect(openPhrases).toContain('tooltip, Saves the file');
        },
      );

      scenario(
        'with relation label, names an icon-only button',
        async ({ mount, spoken }) => {
          await mount({
            template: tip({
              target: h(
                'button',
                { part: 'trigger', class: 'sc-trigger' },
                h('span', { 'aria-hidden': 'true' }, '✎'),
              ),
              text: 'Edit',
            }),
            props: { relation: 'label' },
          });
          expect(await spoken()).toContain('button, Edit');
        },
      );

      scenario(
        'describes a focusable disabled Button',
        async ({ mount, spoken }) => {
          await mount({
            template: tip({
              target: saveButton({
                isDisabled: true,
                isFocusableWhenDisabled: true,
              }),
              text: 'No changes to save',
            }),
          });
          expect(await spoken()).toContain(
            'button, Save, No changes to save, disabled',
          );
        },
      );
    });
  },
);
