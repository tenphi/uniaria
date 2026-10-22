/**
 * The overflow tooltip, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): a tooltip
 * that opens only while its trigger's text is cut off
 * (`shouldOpenOnlyWhenTruncated`), measured when it would open, overflow
 * under a pixel included; `relation: 'none'`, which links nothing and hides
 * the tooltip from assistive technology; the `text` part UniAria fills with
 * the cut-off text; a linked Button's label and description, and its hover
 * counted over the root alone; Select's trigger; and one tooltip for every
 * option of a Listbox or a Combobox (`optionTooltip`), driven by hover,
 * visible focus and the visible highlight. Phase 5: the adapters reach it
 * with the implementation.
 *
 * Every scenario starts on a cold page and rests the pointer on `#page`, as
 * in the Tooltip suite. A list nested in the tooltip takes it as its
 * `optionTooltip`: on custom elements only the `option-tooltip` attribute
 * links one (items spec, Runtime and harness changes 3), so the elements
 * adapter writes it, as a consumer would.
 *
 * Not here: Select's option tooltip (a Select nested in the tooltip takes it
 * for its trigger, and a template nests a component in one other only; the
 * element tests cover it), virtualized options leaving the rendered set,
 * Safari's own tooltip over cut-off text, and the development warnings.
 */

import { defineConformance, h, nested, partSelector } from '@uniaria/testing';
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

const PHASE = { phase: 5 } as const;

const EVENTS = ['openChange'];

/** The spec's default delay (Tooltip spec, Props). */
const DELAY = 250;

/** Long enough past the delay that a tooltip that would open has. */
const PAST_DELAY = DELAY + 200;

/** The page's tooltips (Tooltip spec, Warm-up). */
const TOOLTIPS = Symbol.for('@uniaria/tooltips/v1');

/** The overflow tooltip: visual only, and only while the text is cut off. */
const OVERFLOW = {
  shouldOpenOnlyWhenTruncated: true,
  relation: 'none',
} as const;

const FITS = 'Save';
const CUT = 'Save the quarterly report';

/**
 * Fixed places: triggers at (150, 100), 80×30, cutting their text with an
 * ellipsis, a second one at (330, 100); the lists at (20, 100), so a
 * tooltip beside them fits the 414px page; the tooltip beside what it
 * describes; `#page` (not focusable), where the pointer rests, lower left;
 * `#before` and `#after`, text fields for Tab, at the left; `#natural`, the
 * cut text at its natural width, out of the way.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 400px; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 300px; width: 100px }
   .sc-after { position: fixed; left: 0; top: 340px; width: 100px }
   .sc-trigger { position: fixed; left: 150px; top: 100px; display: block; width: 80px; height: 30px; margin: 0; padding: 0; border: 0; box-sizing: content-box; font: 14px/20px sans-serif; text-align: start; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
   .sc-trigger.sc-second { left: 330px }
   .sc-item { position: fixed; left: 150px; top: 100px; display: block; width: 120px; height: 44px; margin: 0; padding: 0; border: 0; font: 14px/20px sans-serif; text-align: start }
   .sc-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
   .sc-natural { position: fixed; left: 0; top: 500px; display: inline-block; margin: 0; padding: 0; font: 14px/20px sans-serif; white-space: nowrap }
   .sc-tip { width: 160px; margin: 8px; padding: 0; border: 0; box-sizing: border-box; font: 12px/16px sans-serif; white-space: pre-line }
   .sc-lists { position: fixed; left: 20px; top: 100px; margin: 0 }
   .sc-list { width: 120px; margin: 0; padding: 0; list-style: none }
   .sc-option { display: block; height: 24px; margin: 0; padding: 0; font: 14px/20px sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
   .sc-lists p, .sc-lists label { display: block; margin: 0; height: 20px }
   .sc-lists [hidden] { display: none }
   .sc-anchor { display: flex; width: 120px; height: 30px }
   .sc-input { width: 90px; height: 30px; margin: 0; padding: 0 4px; box-sizing: border-box }
   .sc-button { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-pop { width: 120px; margin: 4px 0 0; padding: 0; border: 0 }
   .sc-frame { position: fixed; left: 150px; top: 100px; display: flex; gap: 40px; margin: 0; padding: 0 }
   .sc-frame .sc-trigger { position: static }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }`,
);

/** A trigger part, a button with a tabindex: WebKit tabs to one only so. */
function trigger(text = CUT, className = ''): TemplateNode {
  return h(
    'button',
    {
      part: 'trigger',
      class: `sc-trigger ${className}`.trim(),
      tabindex: '0',
    },
    text,
  );
}

/** A trigger part that can't take focus, hovered only, cut or not by `css`. */
function textTrigger(text: string, style: string): TemplateNode {
  return h('span', { part: 'trigger', class: 'sc-trigger', style }, text);
}

interface TipOptions {
  /** What the tooltip describes: a trigger part with the cut text by default. */
  readonly target?: TemplateNode;
  /** The tooltip's content: its empty `text` part by default. */
  readonly content?: readonly TemplateNode[];
  /** Markup before the page content, such as a measuring element. */
  readonly head?: readonly TemplateNode[];
}

/** The page, what the tooltip describes, and the tooltip after it. */
function tip({
  target = trigger(),
  content = [h('span', { part: 'text' })],
  head = [],
}: TipOptions = {}): TemplateNode[] {
  return [
    LAYOUT,
    ...head,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    target,
    h('div', { part: 'root', class: 'sc-tip' }, ...content),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

/**
 * A UniAria Button with a label and a description, each cut to one line
 * in a 120px button, linked to the tooltip.
 */
function report(
  label: string,
  description: string,
  props: Readonly<Record<string, unknown>> = {},
): TemplateNode {
  return nested(
    'button',
    props,
    h(
      'button',
      { part: 'root', class: 'sc-item' },
      h('span', { part: 'label', class: 'sc-line' }, label),
      h('span', { part: 'description', class: 'sc-line' }, description),
    ),
  );
}

interface Fruit {
  readonly key: string;
  readonly textValue: string;
}

/**
 * Apple and Cherry are cut off in a 120px list; Banana and Date fit. Apple
 * and Cherry are next to each other: the pointer moves in two steps, and
 * its midpoint between them lands on neither of the others.
 */
const ORCHARD: readonly Fruit[] = [
  { key: 'apple', textValue: 'Apple, the long red one from the orchard' },
  { key: 'cherry', textValue: 'Cherry, the dark sweet one from the hill' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'date', textValue: 'Date' },
];

const textOf = (key: string) =>
  ORCHARD.find((item) => item.key === key)!.textValue;

const optionNodes = () =>
  ORCHARD.map((item) =>
    h(
      'li',
      { part: 'option', 'data-key': item.key, class: 'sc-option' },
      item.textValue,
    ),
  );

/** A Listbox "Fruit" of the orchard, linked to the tooltip. */
function orchardListbox(): TemplateNode {
  return nested(
    'listbox',
    { items: ORCHARD },
    h(
      'div',
      { part: 'root', class: 'sc-lists' },
      h('span', { part: 'label' }, 'Fruit'),
      h('ul', { part: 'list', class: 'sc-list' }, ...optionNodes()),
    ),
  );
}

/** A Combobox "Fruit" of the orchard, linked to the tooltip. */
function orchardCombobox(): TemplateNode {
  return nested(
    'combobox',
    { items: ORCHARD },
    h(
      'div',
      { part: 'root', class: 'sc-lists' },
      h('label', { part: 'label' }, 'Fruit'),
      h(
        'div',
        { part: 'anchor', class: 'sc-anchor' },
        h('input', { part: 'input', class: 'sc-input' }),
        h(
          'button',
          { part: 'button', class: 'sc-button' },
          h('span', { 'aria-hidden': 'true' }, '▾'),
        ),
      ),
      h('p', { part: 'error' }, 'Pick one'),
      h(
        'div',
        { part: 'popover', class: 'sc-pop' },
        h('ul', { part: 'list', class: 'sc-list' }, ...optionNodes()),
        h('p', { part: 'empty' }, 'No fruit'),
      ),
      h('input', { part: 'hiddenInput', name: 'fruit' }),
    ),
  );
}

/**
 * A Select "Fruit" whose value, Apple's long name, is cut off in its 80px
 * trigger, linked to the tooltip for its trigger only.
 */
function orchardSelect({
  hasDescription = false,
}: { readonly hasDescription?: boolean } = {}): TemplateNode {
  return nested(
    'select',
    { items: ORCHARD, defaultValue: ['apple'], optionTooltip: undefined },
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Fruit'),
      h(
        'button',
        { part: 'trigger', class: 'sc-trigger' },
        h('span', { part: 'value', class: 'sc-line' }),
      ),
      ...(hasDescription ? [h('p', { part: 'description' }, 'Pick one')] : []),
      h(
        'div',
        { part: 'popover', class: 'sc-pop' },
        h('ul', { part: 'list', class: 'sc-list' }, ...optionNodes()),
      ),
      h('select', { part: 'hiddenSelect', name: 'fruit' }),
    ),
  );
}

function byId(mounted: MountedTooltip, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

/** A part of a component nested in the template. */
function partOf(
  mounted: MountedTooltip,
  scope: string,
  part: string,
  key?: string,
): HTMLElement {
  const selector =
    key === undefined
      ? partSelector(scope, part)
      : `${partSelector(scope, part)}[data-key="${key}"]`;
  const element = mounted.container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`No ${part} of ${scope} ${key ?? ''}.`);
  return element;
}

function root(mounted: MountedTooltip): HTMLElement {
  return mounted.part('root');
}

/** The tooltip's `text` part, as UniAria filled it. */
function text(mounted: MountedTooltip): string {
  return mounted.part('text').textContent ?? '';
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

/** Waits past the delay, then checks the tooltip never opened. */
async function staysClosed(mounted: MountedTooltip): Promise<void> {
  await pause(PAST_DELAY);
  expect(isInTopLayer(root(mounted))).toBe(false);
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

/**
 * Closes the tooltip and hides its page, so the next mount in the same
 * scenario starts from a clean screen.
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

export const tooltipItemsConformance = defineConformance<
  TooltipProps,
  TooltipState
>('tooltip', ({ scenario: define, group }) => {
  /**
   * Every scenario starts on a cold page, and every mount rests the pointer
   * on `#page` (see the file comment).
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

  group('opening only while cut off', () => {
    scenario(
      'text that fits never opens it: not on hover, not on focus, not from open()',
      async (context) => {
        const { mount, pointer, keyboard } = context;
        const mounted = await mount({
          template: tip({ target: trigger(FITS) }),
          props: OVERFLOW,
          events: EVENTS,
        });
        await pointer.move(mounted.part('trigger'));
        await staysClosed(mounted);
        await rest(context, mounted);

        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(mounted.part('trigger'));
        await staysClosed(mounted);

        await mounted.call('open');
        expect(isInTopLayer(root(mounted))).toBe(false);
        expect(openChanges(mounted)).toEqual([]);
        expect(mounted.state().isOpen).toBe(false);
      },
    );

    scenario(
      'cut-off text opens it on hover after the delay, at once on visible focus, and from open()',
      async (context) => {
        const { mount, pointer, keyboard } = context;
        const mounted = await mount({
          template: tip(),
          props: OVERFLOW,
          events: EVENTS,
        });
        const tooltip = root(mounted);

        await pointer.move(mounted.part('trigger'));
        expect(isInTopLayer(tooltip)).toBe(false);
        await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
        expect(openChanges(mounted)).toEqual([true]);
        await rest(context, mounted);
        await closed(tooltip);

        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(isInTopLayer(tooltip)).toBe(true);
        (activeElement(mounted) as HTMLElement).blur();
        await closed(tooltip);

        await mounted.call('open');
        expect(isInTopLayer(tooltip)).toBe(true);
      },
    );

    scenario(
      'text that fits doesn’t warm the page up: a cut-off trigger hovered next waits its delay',
      async (context) => {
        const { mount, pointer } = context;
        const fitting = await mount({
          template: tip({ target: trigger(FITS) }),
          props: OVERFLOW,
        });
        const cut = await mount({
          template: tip({ target: trigger(CUT, 'sc-second') }),
          props: OVERFLOW,
        });
        await pointer.move(fitting.part('trigger'));
        await staysClosed(fitting);

        await pointer.move(cut.part('trigger'));
        expect(isInTopLayer(root(cut))).toBe(false);
        await expect.poll(() => isInTopLayer(root(cut))).toBe(true);
        expect(cut.state().isInstant).toBe(false);
        expect(root(cut).hasAttribute('data-instant')).toBe(false);
      },
    );

    scenario(
      'controlled, it asks to open only while the text is cut off',
      async (context) => {
        const { mount, pointer } = context;
        const fitting = await mount({
          template: tip({ target: trigger(FITS) }),
          props: { ...OVERFLOW, isOpen: false },
          events: EVENTS,
        });
        await pointer.move(fitting.part('trigger'));
        await pause(PAST_DELAY);
        expect(openChanges(fitting)).toEqual([]);
        await retire(context, fitting);

        const cut = await mount({
          template: tip({ target: trigger(CUT, 'sc-second') }),
          props: { ...OVERFLOW, isOpen: false },
          events: EVENTS,
        });
        await pointer.move(cut.part('trigger'));
        await expect.poll(() => openChanges(cut)).toEqual([true]);
        expect(isInTopLayer(root(cut))).toBe(false);
      },
    );

    scenario(
      'internal interactions and measuring never re-render the owner',
      async (context) => {
        const { mount, pointer, keyboard } = context;
        const mounted = await mount({ template: tip(), props: OVERFLOW });
        const renders = mounted.renderCount();
        await hoverOpen(context, mounted);
        await rest(context, mounted);
        await closed(root(mounted));
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(isInTopLayer(root(mounted))).toBe(true);
        (activeElement(mounted) as HTMLElement).blur();
        await closed(root(mounted));
        await pointer.move(mounted.part('trigger'));
        await mounted.call('open');
        expect(isInTopLayer(root(mounted))).toBe(true);
        expect(mounted.renderCount()).toBe(renders);
      },
    );
  });

  group('measuring', () => {
    scenario(
      'overflow under a pixel counts, and a box exactly as wide as its text doesn’t',
      async (context) => {
        const { mount, pointer } = context;
        const mounted = await mount({
          template: tip({
            target: textTrigger(CUT, ''),
            head: [h('span', { id: 'natural', class: 'sc-natural' }, CUT)],
          }),
          props: OVERFLOW,
        });
        const target = mounted.part('trigger');
        const natural = rect(byId(mounted, 'natural')).width;

        target.style.width = `${natural - 0.2}px`;
        await hoverOpen(context, mounted, target);
        await rest(context, mounted);
        await closed(root(mounted));

        target.style.width = `${natural}px`;
        await pointer.move(target);
        await staysClosed(mounted);
      },
    );

    scenario(
      'a single line that fits isn’t cut off by glyphs taller than its line',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: tip({
            target: textTrigger(
              'Typography gjpqy',
              'width: 300px; height: auto; line-height: 1; font-family: Georgia, serif',
            ),
          }),
          props: OVERFLOW,
        });
        await pointer.move(mounted.part('trigger'));
        await staysClosed(mounted);
      },
    );

    scenario('wrapped text a line clamp cuts off counts', async (context) => {
      const mounted = await context.mount({
        template: tip({
          target: textTrigger(
            'Save the quarterly report for the whole team today',
            'display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; height: auto',
          ),
        }),
        props: OVERFLOW,
      });
      await hoverOpen(context, mounted);
    });

    scenario(
      'text that overflows without being clipped isn’t cut off',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: tip({ target: textTrigger(CUT, 'overflow: visible') }),
          props: OVERFLOW,
        });
        await pointer.move(mounted.part('trigger'));
        await staysClosed(mounted);
      },
    );
  });

  group('the text part', () => {
    scenario(
      'holds the whole text of the cut-off trigger while open, not what the ellipsis left',
      async (context) => {
        const mounted = await context.mount({
          template: tip(),
          props: OVERFLOW,
        });
        await hoverOpen(context, mounted);
        expect(text(mounted)).toBe(CUT);
      },
    );

    scenario(
      'without shouldOpenOnlyWhenTruncated, the tooltip opens as any does and the text part holds the text all the same',
      async (context) => {
        const mounted = await context.mount({
          template: tip({ target: trigger(FITS) }),
          props: { relation: 'none' },
        });
        await hoverOpen(context, mounted);
        expect(text(mounted)).toBe(FITS);
      },
    );

    scenario(
      'for a linked Button, only its cut-off label or description, one per line',
      async (context) => {
        const { mount, pointer } = context;
        const label = 'Quarterly report, final version';
        const description = 'Edited by the whole finance team';

        const descriptionCut = await mount({
          template: tip({ target: report('Report', description) }),
          props: OVERFLOW,
        });
        await hoverOpen(
          context,
          descriptionCut,
          partOf(descriptionCut, 'button', 'root'),
        );
        expect(text(descriptionCut)).toBe(description);
        await retire(context, descriptionCut);

        const bothCut = await mount({
          template: tip({ target: report(label, description) }),
          props: OVERFLOW,
        });
        await hoverOpen(context, bothCut, partOf(bothCut, 'button', 'root'));
        expect(text(bothCut)).toBe(`${label}\n${description}`);
        await retire(context, bothCut);

        const neither = await mount({
          template: tip({ target: report('Report', 'Edited today') }),
          props: OVERFLOW,
        });
        await pointer.move(partOf(neither, 'button', 'root'));
        await staysClosed(neither);
      },
    );

    scenario(
      'a linked Button without a label part is measured and copied whole',
      async (context) => {
        const mounted = await context.mount({
          template: tip({
            target: nested(
              'button',
              {},
              h('button', { part: 'root', class: 'sc-trigger' }, CUT),
            ),
          }),
          props: OVERFLOW,
        });
        await hoverOpen(context, mounted, partOf(mounted, 'button', 'root'));
        expect(text(mounted)).toBe(CUT);
      },
    );
  });

  group('a linked Button', () => {
    scenario(
      'hover counts over the root alone, not over the frame and its extras',
      async (context) => {
        const { mount, pointer } = context;
        const mounted = await mount({
          template: tip({
            target: nested(
              'button',
              {},
              h(
                'div',
                { part: 'frame', class: 'sc-frame' },
                h('button', { part: 'root', class: 'sc-trigger' }, FITS),
                h(
                  'span',
                  { part: 'extras' },
                  h(
                    'button',
                    { id: 'share', class: 'sc-extra', 'aria-label': 'Share' },
                    '↗',
                  ),
                ),
              ),
            ),
            content: ['Saves the file'],
          }),
        });
        const share = byId(mounted, 'share');
        await pointer.move(share);
        expect(
          partOf(mounted, 'button', 'root').hasAttribute('data-hovered'),
        ).toBe(true);
        await staysClosed(mounted);
        await hoverOpen(context, mounted, partOf(mounted, 'button', 'root'));
        await pointer.move(share);
        await closed(root(mounted));
      },
    );

    scenario(
      'an overflow tooltip leaves a disabled Button natively disabled, out of the tab order',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: tip({
            target: report(CUT, 'Edited today', { isDisabled: true }),
          }),
          props: OVERFLOW,
        });
        const button = partOf(mounted, 'button', 'root');
        expect(button.hasAttribute('disabled')).toBe(true);
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(byId(mounted, 'after'));
      },
    );
  });

  group('relation none', () => {
    scenario(
      'links nothing to the trigger and hides the tooltip, which keeps its role',
      async ({ mount }) => {
        const mounted = await mount({
          template: tip({ target: trigger(FITS) }),
          props: { relation: 'none' },
        });
        const target = mounted.part('trigger');
        expect(target.hasAttribute('aria-describedby')).toBe(false);
        expect(target.hasAttribute('aria-labelledby')).toBe(false);
        expect(root(mounted).getAttribute('aria-hidden')).toBe('true');
        expect(root(mounted).getAttribute('role')).toBe('tooltip');
      },
    );

    scenario(
      'a linked Button’s description stays its only description',
      async ({ mount }) => {
        const mounted = await mount({
          template: tip({ target: report('Report', 'Edited today') }),
          props: { relation: 'none' },
        });
        const button = partOf(mounted, 'button', 'root');
        expect(button.getAttribute('aria-labelledby')).toBe(
          partOf(mounted, 'button', 'label').id,
        );
        expect(button.getAttribute('aria-describedby')).toBe(
          partOf(mounted, 'button', 'description').id,
        );
      },
    );

    scenario(
      'otherwise a linked Button’s description comes before the tooltip',
      async ({ mount }) => {
        const mounted = await mount({
          template: tip({ target: report('Report', 'Edited today') }),
        });
        const description = partOf(mounted, 'button', 'description');
        expect(description.id).not.toBe('');
        expect(
          partOf(mounted, 'button', 'root').getAttribute('aria-describedby'),
        ).toBe(`${description.id} ${root(mounted).id}`);
      },
    );

    scenario(
      'an open overflow tooltip adds nothing to what is spoken',
      async (context) => {
        const mounted = await context.mount({
          template: tip(),
          props: OVERFLOW,
        });
        await hoverOpen(context, mounted);
        const phrases = await context.spoken();
        expect(phrases).toContain(`button, ${CUT}`);
        expect(
          phrases.filter((phrase) => phrase.startsWith('tooltip')),
        ).toEqual([]);
      },
    );
  });

  group('Select’s trigger', () => {
    scenario(
      'a Select takes a tooltip for its trigger, and a cut-off value opens it with the value’s text',
      async (context) => {
        const mounted = await context.mount({
          template: tip({ target: orchardSelect() }),
          props: OVERFLOW,
        });
        const selectTrigger = partOf(mounted, 'select', 'trigger');
        await hoverOpen(context, mounted, selectTrigger);
        expect(text(mounted)).toBe(textOf('apple'));
        expect(selectTrigger.hasAttribute('aria-describedby')).toBe(false);
        const tooltip = rect(root(mounted));
        expectNear(
          tooltip.left + tooltip.width / 2,
          rect(selectTrigger).left + rect(selectTrigger).width / 2,
          'centred on the trigger',
        );
      },
    );

    scenario(
      'the tooltip’s relation follows Field’s references on the trigger',
      async ({ mount }) => {
        const mounted = await mount({
          template: tip({ target: orchardSelect({ hasDescription: true }) }),
        });
        const description = partOf(mounted, 'select', 'description');
        expect(
          partOf(mounted, 'select', 'trigger').getAttribute('aria-describedby'),
        ).toBe(`${description.id} ${root(mounted).id}`);
      },
    );
  });

  group('option tooltips', () => {
    const BESIDE = { ...OVERFLOW, positionArea: 'right' } as const;

    scenario(
      'hovering a cut-off option opens it after the delay, beside that option, with its text; the list writes no relation',
      async (context) => {
        const mounted = await context.mount({
          template: tip({ target: orchardListbox() }),
          props: BESIDE,
          events: EVENTS,
        });
        const apple = partOf(mounted, 'listbox', 'option', 'apple');
        await context.pointer.move(apple);
        expect(isInTopLayer(root(mounted))).toBe(false);
        await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        expect(text(mounted)).toBe(textOf('apple'));
        const tooltip = rect(root(mounted));
        expectNear(tooltip.left, rect(apple).right + 8, 'beside the option');
        expectNear(
          tooltip.top + tooltip.height / 2,
          rect(apple).top + rect(apple).height / 2,
          'level with the option',
        );
        for (const option of mounted.container.querySelectorAll(
          partSelector('listbox', 'option'),
        )) {
          expect(option.hasAttribute('aria-describedby')).toBe(false);
        }
      },
    );

    scenario('an option that fits opens nothing', async (context) => {
      const mounted = await context.mount({
        template: tip({ target: orchardListbox() }),
        props: BESIDE,
        events: EVENTS,
      });
      await context.pointer.move(
        partOf(mounted, 'listbox', 'option', 'banana'),
      );
      await staysClosed(mounted);
      expect(openChanges(mounted)).toEqual([]);
    });

    scenario(
      'moving on moves it at once to another cut-off option, and closes it on one that fits',
      async (context) => {
        const mounted = await context.mount({
          template: tip({ target: orchardListbox() }),
          props: BESIDE,
          events: EVENTS,
        });
        await hoverOpen(
          context,
          mounted,
          partOf(mounted, 'listbox', 'option', 'apple'),
        );
        const cherry = partOf(mounted, 'listbox', 'option', 'cherry');
        await context.pointer.move(cherry);
        await expect.poll(() => text(mounted)).toBe(textOf('cherry'));
        expect(isInTopLayer(root(mounted))).toBe(true);
        expect(openChanges(mounted)).toEqual([true]);
        const tooltip = rect(root(mounted));
        expectNear(
          tooltip.top + tooltip.height / 2,
          rect(cherry).top + rect(cherry).height / 2,
          'level with Cherry',
        );

        await context.pointer.move(
          partOf(mounted, 'listbox', 'option', 'banana'),
        );
        await closed(root(mounted));
        expect(openChanges(mounted)).toEqual([true, false]);
      },
    );

    scenario(
      'a press on an option closes it until the pointer leaves that option',
      async (context) => {
        const { mount, pointer } = context;
        const mounted = await mount({
          template: tip({ target: orchardListbox() }),
          props: BESIDE,
        });
        const apple = partOf(mounted, 'listbox', 'option', 'apple');
        await hoverOpen(context, mounted, apple);
        await pointer.click(apple);
        await closed(root(mounted));
        await staysClosed(mounted);
        await hoverOpen(
          context,
          mounted,
          partOf(mounted, 'listbox', 'option', 'cherry'),
        );
        expect(text(mounted)).toBe(textOf('cherry'));
      },
    );

    scenario(
      'visible focus on a cut-off option opens it at once; typing closes it until a navigation key moves focus',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: tip({ target: orchardListbox() }),
          props: BESIDE,
        });
        const tooltip = root(mounted);
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(
          partOf(mounted, 'listbox', 'option', 'apple'),
        );
        expect(isInTopLayer(tooltip)).toBe(true);
        expect(text(mounted)).toBe(textOf('apple'));

        await keyboard.press('c');
        expect(activeElement(mounted)).toBe(
          partOf(mounted, 'listbox', 'option', 'cherry'),
        );
        await closed(tooltip);
        await staysClosed(mounted);

        // Apple is cut off too: open again, then moved to Cherry.
        await keyboard.press('ArrowUp');
        await keyboard.press('ArrowDown');
        expect(activeElement(mounted)).toBe(
          partOf(mounted, 'listbox', 'option', 'cherry'),
        );
        expect(isInTopLayer(tooltip)).toBe(true);
        expect(text(mounted)).toBe(textOf('cherry'));
      },
    );

    scenario(
      'in a Combobox, the visible highlight on a cut-off option opens it; typing closes it until the highlight moves with a key',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: tip({ target: orchardCombobox() }),
          props: BESIDE,
        });
        const tooltip = root(mounted);
        const input = partOf(mounted, 'combobox', 'input');
        const highlighted = () => {
          const id = input.getAttribute('aria-activedescendant');
          if (!id) return null;
          return (
            mounted.container.ownerDocument.getElementById(id)?.dataset.key ??
            null
          );
        };
        input.focus();
        await keyboard.press('ArrowDown');
        await expect.poll(highlighted).toBe('apple');
        await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
        expect(text(mounted)).toBe(textOf('apple'));
        expect(activeElement(mounted)).toBe(input);

        await keyboard.press('ArrowDown');
        expect(highlighted()).toBe('cherry');
        expect(isInTopLayer(tooltip)).toBe(true);
        await expect.poll(() => text(mounted)).toBe(textOf('cherry'));
        await keyboard.press('ArrowDown');
        expect(highlighted()).toBe('banana');
        await closed(tooltip);
        await keyboard.press('ArrowUp');
        expect(highlighted()).toBe('cherry');
        await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
        expect(text(mounted)).toBe(textOf('cherry'));

        await keyboard.press('h');
        await closed(tooltip);
        await staysClosed(mounted);

        // "h" leaves Apple and Cherry, and clears the highlight.
        await keyboard.press('ArrowDown');
        expect(highlighted()).toBe('apple');
        await expect.poll(() => isInTopLayer(tooltip)).toBe(true);
        expect(text(mounted)).toBe(textOf('apple'));
      },
    );
  });
});
