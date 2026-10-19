/**
 * Popover conformance, from the spec approved by @tenphi on 2026-10-16
 * (`packages/core/src/components/popover/spec.md`): a manual popover in the
 * top layer opened by its trigger, its anatomy, name and trigger ARIA,
 * initial focus, Escape, presses on the trigger, outside and on the close
 * part, a controlled popover refusing to close, Tab in modal and non-modal
 * popovers, focus restore, hiding the page from assistive technology, the
 * closing phase, placement in both positioning modes (script, from the
 * props, and CSS, from the consumer's anchor positioning), scrolling, nested
 * popovers, a Dialog opened from a popover, the fallback without the Popover
 * API, public state, render counts and spoken output. Phase 4.
 *
 * The mode is UniAria's page-wide `positioning` setting, under
 * `Symbol.for('@uniaria/settings/v1')` on `globalThis`. The fallback without
 * the Popover API is forced through UniAria's development switch, a window
 * property under `Symbol.for('@uniaria/fallbacks/v1')`: `{ popover: false }`
 * behaves as a browser without it. UniAria reads both when a popover starts.
 *
 * Not here: removing an open popover from the page (a template can't remove
 * a part), a popover inside a modal Dialog, the `'parent'` reason a nested
 * popover reports (only the outer instance's events are recorded) and the
 * development warnings; the element tests cover them.
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type {
  PopoverDismissEvent,
  PopoverPositionArea,
  PopoverProps,
  PopoverState,
} from './types';

type MountedPopover = Mounted<PopoverProps, PopoverState>;

const PHASE = { phase: 4 } as const;

const PARTS = ['trigger', 'root', 'arrow', 'title', 'description', 'close'];

const EVENTS = ['openChange', 'dismiss'];

/** An exit animation long enough to see the closing phase. */
const EXIT = 400;

/** UniAria's development switch for its fallbacks (spec, Resolved questions 2). */
const FALLBACKS = Symbol.for('@uniaria/fallbacks/v1');

/** UniAria's page-wide settings: `positioning` picks the mode (spec, Positioning). */
const SETTINGS = Symbol.for('@uniaria/settings/v1');

type Placing = Partial<
  Pick<PopoverProps, 'positionArea' | 'positionTryFallbacks'>
>;

/**
 * Fixed places for the page around the popover, so it never covers what a
 * scenario presses: the trigger at (150, 30), 80×30; the popover 160px wide
 * below it, its 8px margin the gap (spec, Positioning); `#page` (not
 * focusable) and `#before` above-left; `#other` (a button) and `#after` lower
 * left. `#before` and `#after` are text fields, which WebKit's Tab reaches.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 0; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 30px; width: 100px }
   .sc-trigger { position: fixed; left: 150px; top: 30px; width: 80px; height: 30px; margin: 0; padding: 0 }
   .sc-pop { width: 160px; margin: 8px; padding: 0; border: 0; box-sizing: border-box }
   .sc-pop h2, .sc-pop p { margin: 0 }
   .sc-arrow { position: absolute; width: 10px; height: 10px }
   .sc-arrow[data-placement='bottom'] { top: -5px }
   .sc-arrow[data-placement='top'] { bottom: -5px }
   .sc-other { position: fixed; left: 0; top: 300px }
   .sc-after { position: fixed; left: 0; top: 340px; width: 100px }`,
);

interface SizeOptions {
  readonly hasTrigger?: boolean;
  readonly hasTitle?: boolean;
  readonly hasDescription?: boolean;
  /** Content between the description and the close button. */
  readonly content?: readonly TemplateNode[];
  readonly hasClose?: boolean;
  /** Attributes the consumer puts on the popover. */
  readonly rootAttrs?: Readonly<Record<string, string>>;
  /** Extra classes on the trigger. */
  readonly triggerClass?: string;
  /** Markup before the page content, such as a stylesheet. */
  readonly head?: readonly TemplateNode[];
}

/**
 * The page and a popover "Column size", described by "Applies to every
 * row.", with a Width field and an Apply close button, right after its
 * trigger "Size".
 */
function size({
  hasTrigger = true,
  hasTitle = true,
  hasDescription = true,
  content = [h('input', { id: 'width', 'aria-label': 'Width' })],
  hasClose = true,
  rootAttrs = {},
  triggerClass = '',
  head = [],
}: SizeOptions = {}): TemplateNode[] {
  return [
    LAYOUT,
    ...head,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    ...(hasTrigger
      ? [
          h(
            'button',
            { part: 'trigger', class: `sc-trigger ${triggerClass}`.trim() },
            'Size',
          ),
        ]
      : []),
    h(
      'div',
      { part: 'root', class: 'sc-pop', ...rootAttrs },
      h('div', { part: 'arrow', class: 'sc-arrow' }),
      ...(hasTitle ? [h('h2', { part: 'title' }, 'Column size')] : []),
      ...(hasDescription
        ? [h('p', { part: 'description' }, 'Applies to every row.')]
        : []),
      ...content,
      ...(hasClose ? [h('button', { part: 'close' }, 'Apply')] : []),
    ),
    h('button', { id: 'other', class: 'sc-other' }, 'Other'),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

/** A second field, for Tab inside the popover. */
const HEIGHT = h('input', { id: 'height', 'aria-label': 'Height' });

/** A stylesheet that animates `selector` while the popover exits. */
function exitAnimation(selector: string): TemplateNode {
  return h(
    'style',
    null,
    `@keyframes uni-conformance-fade { to { opacity: 0 } }
     ${selector} { animation: uni-conformance-fade ${EXIT}ms linear forwards }`,
  );
}

function byId(mounted: MountedPopover, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function root(mounted: MountedPopover): HTMLElement {
  return mounted.part('root');
}

/** In the top layer through the Popover API. */
const isInTopLayer = (element: Element) => element.matches(':popover-open');

/** Rendered at all: in the top layer or, in the fallback, in place. */
const isShown = (element: Element) => element.getClientRects().length > 0;

const isHiddenFromAssistiveTechnology = (element: Element) =>
  element.closest('[aria-hidden="true"]') !== null;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the popover has finished closing. */
async function closed(popover: Element): Promise<void> {
  await expect.poll(() => isShown(popover)).toBe(false);
}

/**
 * Closes the popover and hides its page, so the next mount in the same
 * scenario starts from a clean screen (the runner removes containers only
 * when the scenario ends).
 */
async function retire(mounted: MountedPopover): Promise<void> {
  await mounted.setProps({ isOpen: false });
  await closed(mounted.parts('root')[0]!);
  mounted.container.hidden = true;
}

/** The `dismiss` reasons so far, in order. */
function reasons(mounted: MountedPopover): PopoverDismissEvent['reason'][] {
  return mounted.events
    .filter((event) => event.name === 'dismiss')
    .map((event) => (event.detail as PopoverDismissEvent).reason);
}

/** The `openChange` details so far, in order. */
function openChanges(mounted: MountedPopover): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'openChange')
    .map((event) => event.detail);
}

function activeElement(mounted: MountedPopover): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** A state attribute is on every part, or on none. */
function expectOnEveryPart(
  mounted: MountedPopover,
  attribute: string,
  present: boolean,
): void {
  for (const name of PARTS) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(present);
  }
}

/** Records which parts an attribute was ever added to, until `stop()`. */
function watchAttribute(
  mounted: MountedPopover,
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

const rect = (element: Element) => element.getBoundingClientRect();

/** Layout positions agree to a pixel: engines round subpixels differently. */
function expectNear(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} ≈ ${expected}`,
  ).toBeLessThanOrEqual(1);
}

/**
 * Runs `run` once per positioning mode, with UniAria's setting for it. In
 * CSS mode the consumer's anchor positioning places the popover and the
 * props are ignored: `css` gives the same options as the consumer's rule on
 * `.sc-pop` there, and nothing in script mode.
 */
async function onEachMode(
  run: (
    mode: string,
    css: (options?: Placing) => TemplateNode[],
  ) => Promise<void>,
) {
  for (const mode of ['script', 'css'] as const) {
    Reflect.set(globalThis, SETTINGS, { positioning: mode });
    try {
      await run(
        mode,
        ({
          positionArea = 'bottom',
          positionTryFallbacks = 'flip-block, flip-inline',
        } = {}) =>
          mode === 'script'
            ? []
            : [
                h(
                  'style',
                  null,
                  `.sc-pop { inset: auto; position-area: ${positionArea}; position-try-fallbacks: ${positionTryFallbacks} }`,
                ),
              ],
      );
    } finally {
      Reflect.deleteProperty(globalThis, SETTINGS);
    }
  }
}

/** Places the trigger with a stylesheet rule (`.sc-trigger.<name>`). */
function triggerAt(name: string, rule: string): TemplateNode {
  return h('style', null, `.sc-trigger.${name} { ${rule} }`);
}

export const popoverConformance = defineConformance<PopoverProps, PopoverState>(
  'popover',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'a closed manual popover with the dialog role, named by its title and described by its description',
        async ({ mount }) => {
          const mounted = await mount({ template: size() });
          const popover = root(mounted);
          expect(popover.getAttribute('popover')).toBe('manual');
          expect(isInTopLayer(popover)).toBe(false);
          expect(isShown(popover)).toBe(false);
          expect(popover.getAttribute('role')).toBe('dialog');
          expect(popover.getAttribute('tabindex')).toBe('-1');
          expect(popover.hasAttribute('aria-modal')).toBe(false);
          expect(popover.id).not.toBe('');
          expect(popover.getAttribute('aria-labelledby')).toBe(
            mounted.part('title').id,
          );
          expect(popover.getAttribute('aria-describedby')).toBe(
            mounted.part('description').id,
          );
          expect(mounted.part('arrow').getAttribute('aria-hidden')).toBe(
            'true',
          );

          const trigger = mounted.part('trigger');
          expect(trigger.getAttribute('type')).toBe('button');
          expect(trigger.getAttribute('aria-expanded')).toBe('false');
          for (const name of [
            'aria-controls',
            'aria-haspopup',
            'popovertarget',
          ]) {
            expect(trigger.hasAttribute(name), name).toBe(false);
          }
          expect(mounted.part('close').getAttribute('type')).toBe('button');
          for (const attribute of [
            'data-open',
            'data-entering',
            'data-exiting',
          ]) {
            expectOnEveryPart(mounted, attribute, false);
          }
          expect(mounted.state()).toEqual({
            isOpen: false,
            isEntering: false,
            isExiting: false,
            placement: undefined,
          });
        },
        PHASE,
      );

      scenario(
        'the trigger names it when nothing else does',
        async ({ mount }) => {
          const mounted = await mount({
            template: size({ hasTitle: false }),
          });
          const trigger = mounted.part('trigger');
          expect(trigger.id).not.toBe('');
          expect(root(mounted).getAttribute('aria-labelledby')).toBe(
            trigger.id,
          );

          await mounted.setProps({ labelledBy: 'extra-label' });
          expect(root(mounted).getAttribute('aria-labelledby')).toBe(
            'extra-label',
          );

          const labelled = await mount({
            template: size({
              hasTitle: false,
              rootAttrs: { 'aria-label': 'Column size' },
            }),
          });
          expect(root(labelled).hasAttribute('aria-labelledby')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'references only rendered parts, plus labelledBy and describedBy',
        async ({ mount }) => {
          const mounted = await mount({
            template: size({ hasDescription: false }),
          });
          const popover = root(mounted);
          expect(popover.hasAttribute('aria-describedby')).toBe(false);

          await mounted.setProps({
            labelledBy: 'extra-label',
            describedBy: 'extra-description',
          });
          expect(popover.getAttribute('aria-labelledby')).toBe(
            `${mounted.part('title').id} extra-label`,
          );
          expect(popover.getAttribute('aria-describedby')).toBe(
            'extra-description',
          );
        },
        PHASE,
      );
    });

    group('opening', () => {
      scenario(
        'a click on the trigger shows it in the top layer, reports it, expands the trigger and focuses the popover',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          const popover = root(mounted);
          const trigger = mounted.part('trigger');
          const entering = watchAttribute(mounted, 'data-entering');

          await pointer.click(trigger);
          expect(isInTopLayer(popover)).toBe(true);
          expect(activeElement(mounted)).toBe(popover);
          expect(trigger.getAttribute('aria-expanded')).toBe('true');
          expect(trigger.getAttribute('aria-controls')).toBe(popover.id);
          expect(openChanges(mounted)).toEqual([true]);
          expect(reasons(mounted)).toEqual([]);
          expectOnEveryPart(mounted, 'data-open', true);

          // Entering for the first frames only, on every part.
          await expect
            .poll(() => popover.hasAttribute('data-entering'))
            .toBe(false);
          entering.stop();
          expect([...entering.parts].sort()).toEqual([...PARTS].sort());
          expect(mounted.state()).toEqual({
            isOpen: true,
            isEntering: false,
            isExiting: false,
            placement: 'bottom',
          });
        },
        PHASE,
      );

      scenario(
        'Enter and Space on the trigger open it',
        async ({ mount, keyboard }) => {
          for (const key of ['Enter', 'Space']) {
            const mounted = await mount({ template: size(), events: EVENTS });
            mounted.part('trigger').focus();
            await keyboard.press(key);
            expect(isInTopLayer(root(mounted)), key).toBe(true);
            expect(openChanges(mounted), key).toEqual([true]);
            await keyboard.press('Escape');
            await closed(root(mounted));
          }
        },
        PHASE,
      );

      scenario(
        'focuses the first element marked data-autofocus instead of the popover',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size({
              content: [
                h('input', { id: 'width', 'aria-label': 'Width' }),
                h('input', {
                  id: 'height',
                  'aria-label': 'Height',
                  'data-autofocus': '',
                }),
              ],
            }),
          });
          await pointer.click(mounted.part('trigger'));
          expect(activeElement(mounted)).toBe(byId(mounted, 'height'));
        },
        PHASE,
      );

      scenario(
        'defaultOpen opens it on mount without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: size(),
            props: { defaultOpen: true },
            events: EVENTS,
          });
          const popover = root(mounted);
          await expect.poll(() => isInTopLayer(popover)).toBe(true);
          expect(activeElement(mounted)).toBe(popover);
          expectOnEveryPart(mounted, 'data-open', true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a disabled trigger does not open it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size(),
            props: { isDisabled: true },
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          expect(trigger.hasAttribute('data-disabled')).toBe(true);
          await pointer.click(trigger);
          expect(isShown(root(mounted))).toBe(false);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );
    });

    group('Escape', () => {
      scenario(
        'closes it with reason escape, reporting dismiss before openChange',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          const popover = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await keyboard.press('Escape');
          expect(mounted.eventNames()).toEqual(['dismiss', 'openChange']);
          expect(reasons(mounted)).toEqual(['escape']);
          expect(openChanges(mounted)).toEqual([false]);
          expect(mounted.state().isOpen).toBe(false);
          expect(mounted.part('trigger').getAttribute('aria-expanded')).toBe(
            'false',
          );
          expect(mounted.part('trigger').hasAttribute('aria-controls')).toBe(
            false,
          );
          await closed(popover);
          expect(isInTopLayer(popover)).toBe(false);
          expect(mounted.state().placement).toBe(undefined);
        },
        PHASE,
      );

      scenario(
        'does nothing when it is not dismissable or keyboard dismiss is disabled',
        async ({ mount, pointer, keyboard }) => {
          for (const props of [
            { isDismissable: false },
            { isKeyboardDismissDisabled: true },
          ]) {
            const mounted = await mount({
              template: size(),
              props,
              events: EVENTS,
            });
            await pointer.click(mounted.part('trigger'));
            mounted.clearEvents();
            await keyboard.press('Escape');
            await pause(100);
            expect(isInTopLayer(root(mounted)), JSON.stringify(props)).toBe(
              true,
            );
            expect(mounted.events).toEqual([]);
            await retire(mounted);
          }
        },
        PHASE,
      );

      scenario(
        'an Escape a widget inside prevents leaves it open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          await pointer.click(mounted.part('trigger'));
          const width = byId(mounted, 'width');
          width.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') event.preventDefault();
          });
          width.focus();
          mounted.clearEvents();

          await keyboard.press('Escape');
          await pause(100);
          expect(isInTopLayer(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );
    });

    group('pointer', () => {
      scenario(
        'a press on the trigger while open closes it once with reason trigger',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);
          mounted.clearEvents();

          await pointer.click(trigger);
          await closed(root(mounted));
          await pause(100);
          expect(isShown(root(mounted))).toBe(false);
          expect(reasons(mounted)).toEqual(['trigger']);
          expect(openChanges(mounted)).toEqual([false]);
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'a press outside closes it with reason outside, and the press still acts on what it hit',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          const other = byId(mounted, 'other');
          let clicks = 0;
          other.addEventListener('click', () => clicks++);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(other);
          expect(clicks).toBe(1);
          expect(reasons(mounted)).toEqual(['outside']);
          expect(openChanges(mounted)).toEqual([false]);
          await closed(root(mounted));
        },
        PHASE,
      );

      scenario(
        'a press inside does not close it; the close part does with reason close, even when not dismissable',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size(),
            props: { isDismissable: false },
            events: EVENTS,
          });
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(byId(mounted, 'width'));
          await pointer.click(mounted.part('title'));
          await pause(100);
          expect(isInTopLayer(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);

          await pointer.click(mounted.part('close'));
          expect(reasons(mounted)).toEqual(['close']);
          await closed(root(mounted));
        },
        PHASE,
      );

      scenario(
        'a press outside leaves it open when it is not dismissable, or for a target shouldCloseOnInteractOutside keeps',
        async ({ mount, pointer }) => {
          const strict = await mount({
            template: size(),
            props: { isDismissable: false },
            events: EVENTS,
          });
          await pointer.click(strict.part('trigger'));
          strict.clearEvents();
          await pointer.click(byId(strict, 'page'));
          await pause(100);
          expect(isInTopLayer(root(strict))).toBe(true);
          expect(strict.events).toEqual([]);
          await retire(strict);

          const keeping = await mount({
            template: size(),
            props: {
              shouldCloseOnInteractOutside: (target: Element) =>
                target.id !== 'other',
            },
            events: EVENTS,
          });
          await pointer.click(keeping.part('trigger'));
          keeping.clearEvents();
          await pointer.click(byId(keeping, 'other'));
          await pause(100);
          expect(isInTopLayer(root(keeping))).toBe(true);
          expect(keeping.events).toEqual([]);

          await pointer.click(byId(keeping, 'page'));
          expect(reasons(keeping)).toEqual(['outside']);
          await closed(root(keeping));
        },
        PHASE,
      );

      scenario(
        "one click on another popover's trigger closes this one and opens that one",
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: [
              ...size(),
              h(
                'style',
                null,
                '.sc-second { position: fixed; left: 300px; top: 30px }',
              ),
              nested(
                'popover',
                {},
                h('button', { part: 'trigger', class: 'sc-second' }, 'Filter'),
                h(
                  'div',
                  { part: 'root', class: 'sc-pop' },
                  h('input', { 'aria-label': 'Filter' }),
                ),
              ),
            ],
            events: EVENTS,
          });
          const [popover, second] = mounted.parts('root');
          const [trigger, secondTrigger] = mounted.parts('trigger');
          await pointer.click(trigger!);
          mounted.clearEvents();

          await pointer.click(secondTrigger!);
          expect(reasons(mounted)).toEqual(['outside']);
          await closed(popover!);
          expect(isInTopLayer(second!)).toBe(true);
          expect(secondTrigger!.getAttribute('aria-expanded')).toBe('true');
        },
        PHASE,
      );
    });

    group('controlled', () => {
      scenario(
        'isOpen opens and closes it without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: size(),
            props: { isOpen: false },
            events: EVENTS,
          });
          const popover = root(mounted);
          await mounted.setProps({ isOpen: true });
          expect(isInTopLayer(popover)).toBe(true);
          expectOnEveryPart(mounted, 'data-open', true);
          await mounted.setProps({ isOpen: false });
          await closed(popover);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a dismissal only reports; the popover stays open until the consumer closes it',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const popover = root(mounted);
          await expect.poll(() => isInTopLayer(popover)).toBe(true);

          await keyboard.press('Escape');
          await pointer.click(byId(mounted, 'page'));
          await pointer.click(mounted.part('trigger'));
          await pause(100);
          expect(reasons(mounted)).toEqual(['escape', 'outside', 'trigger']);
          expect(openChanges(mounted)).toEqual([false, false, false]);
          expect(isInTopLayer(popover)).toBe(true);
          expectOnEveryPart(mounted, 'data-open', true);

          await mounted.setProps({ isOpen: false });
          await closed(popover);
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'Tab and Shift+Tab wrap inside a modal popover',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size({
              content: [
                h('input', { id: 'width', 'aria-label': 'Width' }),
                HEIGHT,
              ],
            }),
          });
          await pointer.click(mounted.part('trigger'));
          const width = byId(mounted, 'width');
          const close = mounted.part('close');

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(width);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'height'));
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(close);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(width);
          await keyboard.tab({ isBackward: true });
          expect(activeElement(mounted)).toBe(close);
        },
        PHASE,
      );

      scenario(
        'a modal popover hides the page from assistive technology, not from the pointer, until it closes',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: size() });
          const page = byId(mounted, 'page');
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);
          expect(isHiddenFromAssistiveTechnology(page)).toBe(true);
          expect(isHiddenFromAssistiveTechnology(trigger)).toBe(true);
          expect(isHiddenFromAssistiveTechnology(root(mounted))).toBe(false);
          expect(page.closest('[inert]')).toBe(null);

          await keyboard.press('Escape');
          await closed(root(mounted));
          expect(isHiddenFromAssistiveTechnology(page)).toBe(false);
          expect(isHiddenFromAssistiveTechnology(trigger)).toBe(false);
        },
        PHASE,
      );

      scenario(
        'focus returns to the trigger after a keyboard or mouse open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: size() });
          const trigger = mounted.part('trigger');
          const popover = root(mounted);

          trigger.focus();
          await keyboard.press('Enter');
          await keyboard.press('Escape');
          await closed(popover);
          expect(activeElement(mounted)).toBe(trigger);

          // WebKit's own restore would land on the body: a click doesn't
          // focus a button on macOS.
          trigger.blur();
          await pointer.click(trigger);
          await pointer.click(mounted.part('close'));
          await closed(popover);
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'after a press outside, focus stays on the field it focused, or returns to the trigger when it focused nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: size() });
          const trigger = mounted.part('trigger');
          const after = byId(mounted, 'after');

          await pointer.click(trigger);
          await pointer.click(after);
          await closed(root(mounted));
          await pause(100);
          expect(activeElement(mounted)).toBe(after);

          await pointer.click(trigger);
          await pointer.click(byId(mounted, 'page'));
          await closed(root(mounted));
          await expect.poll(() => activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'focus a press outside takes from a popover that stays open comes back',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size(),
            props: { isDismissable: false },
          });
          await pointer.click(mounted.part('trigger'));
          await pointer.click(byId(mounted, 'after'));
          await expect
            .poll(() => root(mounted).contains(activeElement(mounted)))
            .toBe(true);
          expect(isInTopLayer(root(mounted))).toBe(true);
        },
        PHASE,
      );

      scenario(
        'without a trigger, focus returns to the element focused before it opened',
        async ({ mount }) => {
          const mounted = await mount({
            template: size({ hasTrigger: false }),
          });
          const before = byId(mounted, 'before');
          before.focus();
          await mounted.setProps({ isOpen: true });
          expect(activeElement(mounted)).toBe(root(mounted));
          await mounted.setProps({ isOpen: false });
          await closed(root(mounted));
          expect(activeElement(mounted)).toBe(before);
        },
        PHASE,
      );

      scenario(
        'shouldRestoreFocus false leaves focus where the browser puts it',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size(),
            props: { shouldRestoreFocus: false },
          });
          await pointer.click(mounted.part('trigger'));
          await keyboard.press('Escape');
          await closed(root(mounted));
          await pause(100);
          expect(activeElement(mounted)).not.toBe(mounted.part('trigger'));
        },
        PHASE,
      );
    });

    group('non-modal', () => {
      /**
       * The popover at the end of the page, away from its trigger in the DOM,
       * with `#next` right after the trigger. Fields only: WebKit's Tab skips
       * buttons.
       */
      const detached = (): TemplateNode[] => [
        LAYOUT,
        h('p', { id: 'page', class: 'sc-page' }, 'Page'),
        h('input', {
          id: 'before',
          class: 'sc-before',
          'aria-label': 'Before',
        }),
        h('button', { part: 'trigger', class: 'sc-trigger' }, 'Size'),
        h('input', { id: 'next', class: 'sc-after', 'aria-label': 'Next' }),
        h(
          'div',
          { part: 'root', class: 'sc-pop' },
          h('input', { id: 'width', 'aria-label': 'Width' }),
          HEIGHT,
        ),
      ];

      scenario(
        'Tab goes from the trigger into it and from its end to what follows the trigger, closing it with reason blur',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: detached(),
            props: { isNonModal: true },
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);
          trigger.focus();
          expect(isInTopLayer(root(mounted))).toBe(true);
          mounted.clearEvents();

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'width'));
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'height'));
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'next'));
          expect(reasons(mounted)).toEqual(['blur']);
          await closed(root(mounted));
          expect(activeElement(mounted)).toBe(byId(mounted, 'next'));
        },
        PHASE,
      );

      scenario(
        'focus moving to the trigger keeps it open, and Escape there closes it',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size(),
            props: { isNonModal: true },
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);
          trigger.focus();
          await pause(100);
          expect(isInTopLayer(root(mounted))).toBe(true);
          expect(mounted.events.map((event) => event.name)).toEqual([
            'openChange',
          ]);
          mounted.clearEvents();

          await keyboard.press('Escape');
          expect(reasons(mounted)).toEqual(['escape']);
          await closed(root(mounted));
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'leaves the page exposed to assistive technology',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size(),
            props: { isNonModal: true },
          });
          await pointer.click(mounted.part('trigger'));
          expect(isHiddenFromAssistiveTechnology(byId(mounted, 'page'))).toBe(
            false,
          );
          expect(isHiddenFromAssistiveTechnology(mounted.part('trigger'))).toBe(
            false,
          );
        },
        PHASE,
      );
    });

    group('closing phase', () => {
      scenario(
        'stays shown and exiting until its exit animation ends, then hides and restores focus',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size({
              head: [exitAnimation('.sc-pop[data-exiting]')],
            }),
          });
          const popover = root(mounted);
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);

          await keyboard.press('Escape');
          expectOnEveryPart(mounted, 'data-open', false);
          expectOnEveryPart(mounted, 'data-exiting', true);
          expect(mounted.state()).toMatchObject({
            isOpen: false,
            isExiting: true,
          });
          await pause(EXIT / 2);
          expect(isInTopLayer(popover)).toBe(true);
          expect(isHiddenFromAssistiveTechnology(byId(mounted, 'page'))).toBe(
            false,
          );

          await closed(popover);
          expectOnEveryPart(mounted, 'data-exiting', false);
          expect(mounted.state().isExiting).toBe(false);
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'a press on the trigger while it exits opens it again',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size({
              head: [exitAnimation('.sc-pop[data-exiting]')],
            }),
            events: EVENTS,
          });
          const popover = root(mounted);
          await pointer.click(mounted.part('trigger'));
          await keyboard.press('Escape');
          expect(popover.hasAttribute('data-exiting')).toBe(true);

          await pointer.click(mounted.part('trigger'));
          expect(openChanges(mounted)).toEqual([true, false, true]);
          expectOnEveryPart(mounted, 'data-exiting', false);
          expectOnEveryPart(mounted, 'data-open', true);
          await pause(EXIT + 100);
          expect(isInTopLayer(popover)).toBe(true);
        },
        PHASE,
      );
    });

    group('positioning', () => {
      scenario(
        'below the trigger by default: centred, its 8px margin away, with data-placement bottom on the popover and the arrow',
        async ({ mount, pointer }) => {
          await onEachMode(async (mode, css) => {
            const mounted = await mount({ template: size({ head: css() }) });
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            const t = rect(trigger);
            const p = rect(popover);
            expectNear(p.top, t.bottom + 8, `${mode}: top`);
            expectNear(
              p.left + p.width / 2,
              t.left + t.width / 2,
              `${mode}: centre`,
            );
            expect(mounted.part('arrow').getAttribute('data-placement')).toBe(
              'bottom',
            );
            expect(mounted.state().placement).toBe('bottom');
            await retire(mounted);
          });
        },
        PHASE,
      );

      scenario(
        'positionArea and the consumer’s margins move it',
        async ({ mount, pointer }) => {
          // Each with room on its side: the popover is 160px wide.
          const cases: readonly [
            PopoverPositionArea,
            string,
            string,
            string,
          ][] = [
            [
              'bottom span-right',
              'bottom',
              'top: 300px; left: 150px',
              '20px 0 0 10px',
            ],
            ['top span-left', 'top', 'top: 300px; left: 150px', '0 0 8px'],
            ['inline-end', 'right', 'top: 200px; left: 20px', '0 0 0 8px'],
            [
              'left span-bottom',
              'left',
              'top: 300px; left: 240px',
              '0 8px 0 0',
            ],
          ];
          await onEachMode(async (mode, css) => {
            for (const [positionArea, side, place, margin] of cases) {
              const what = `${mode}, ${positionArea}`;
              const mounted = await mount({
                template: size({
                  head: [
                    triggerAt('sc-placed', place),
                    h('style', null, `.sc-pop.sc-margin { margin: ${margin} }`),
                    ...css({ positionArea }),
                  ],
                  triggerClass: 'sc-placed',
                  rootAttrs: { class: 'sc-pop sc-margin' },
                }),
                props: { positionArea },
              });
              const trigger = mounted.part('trigger');
              const popover = root(mounted);
              await pointer.click(trigger);
              await expect
                .poll(() => popover.getAttribute('data-placement'), {
                  message: what,
                })
                .toBe(side);
              const t = rect(trigger);
              const p = rect(popover);
              if (positionArea === 'bottom span-right') {
                expectNear(p.top, t.bottom + 20, `${what}: top`);
                expectNear(p.left, t.left + 10, `${what}: left`);
              } else if (positionArea === 'top span-left') {
                expectNear(p.bottom, t.top - 8, `${what}: bottom`);
                expectNear(p.right, t.right, `${what}: right`);
              } else if (positionArea === 'inline-end') {
                expectNear(p.left, t.right + 8, `${what}: left`);
                expectNear(
                  p.top + p.height / 2,
                  t.top + t.height / 2,
                  `${what}: middle`,
                );
              } else {
                expectNear(p.right, t.left - 8, `${what}: right`);
                expectNear(p.top, t.top, `${what}: top`);
              }
              await retire(mounted);
            }
          });
        },
        PHASE,
      );

      scenario(
        'in script mode, self- keywords follow the popover’s direction: self-block-end span-self-inline-end aligns right edges in a right-to-left popover',
        async ({ mount, pointer }) => {
          // In CSS mode this is the browser's: Firefox 155 misplaces it.
          const gap = h('style', null, '.sc-pop.sc-gap { margin: 8px 0 0 }');
          {
            const mounted = await mount({
              template: h(
                'div',
                { dir: 'rtl' },
                ...size({ head: [gap], rootAttrs: { class: 'sc-pop sc-gap' } }),
              ),
              props: { positionArea: 'self-block-end span-self-inline-end' },
            });
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            expectNear(rect(popover).right, rect(trigger).right, 'right');
            await retire(mounted);
          }
        },
        PHASE,
      );

      scenario(
        'flips to the side with room and says so; positionTryFallbacks none keeps the side',
        async ({ mount, pointer }) => {
          const low = triggerAt('sc-low', 'top: auto; bottom: 10px');
          await onEachMode(async (mode, css) => {
            const mounted = await mount({
              template: size({ head: [low, ...css()], triggerClass: 'sc-low' }),
            });
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('top');
            expectNear(
              rect(popover).bottom,
              rect(trigger).top - 8,
              `${mode}: bottom`,
            );
            expect(mounted.part('arrow').getAttribute('data-placement')).toBe(
              'top',
            );
            expect(mounted.state().placement).toBe('top');
            await retire(mounted);

            const fixed = await mount({
              template: size({
                head: [low, ...css({ positionTryFallbacks: 'none' })],
                triggerClass: 'sc-low',
              }),
              props: { positionTryFallbacks: 'none' },
            });
            await pointer.click(fixed.part('trigger'));
            await pause(100);
            expect(root(fixed).getAttribute('data-placement'), mode).toBe(
              'bottom',
            );
            await retire(fixed);
          });
        },
        PHASE,
      );

      scenario(
        'its margins keep it off the edges of the viewport',
        async ({ mount, pointer }) => {
          const edge = triggerAt('sc-edge', 'left: 0');
          await onEachMode(async (mode, css) => {
            for (const margin of [12, 0]) {
              const mounted = await mount({
                template: size({
                  head: [
                    edge,
                    ...css(),
                    h(
                      'style',
                      null,
                      `.sc-pop.sc-edges { margin: 8px ${margin}px }`,
                    ),
                  ],
                  triggerClass: 'sc-edge',
                  rootAttrs: { class: 'sc-pop sc-edges' },
                }),
              });
              await pointer.click(mounted.part('trigger'));
              await expect
                .poll(() => root(mounted).getAttribute('data-placement'))
                .toBe('bottom');
              expectNear(
                rect(root(mounted)).left,
                margin,
                `${mode}, ${margin}`,
              );
              await retire(mounted);
            }
          });
        },
        PHASE,
      );

      scenario(
        'the anchor part takes the trigger’s place',
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
                ...size({ head: css() }),
              ],
            });
            const anchor = mounted.part('anchor');
            const popover = root(mounted);
            await pointer.click(mounted.part('trigger'));
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            const a = rect(anchor);
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
        '--anchor-width and --available-height size it from the consumer’s CSS',
        async ({ mount, pointer }) => {
          const sizing = h(
            'style',
            null,
            `.sc-trigger.sc-wide { width: 300px; left: 20px }
           .sc-pop.sc-fit { width: auto; margin: 8px 12px 12px; min-width: var(--anchor-width); max-height: var(--available-height); overflow: auto }
           .sc-tall { height: 3000px }`,
          );
          await onEachMode(async (mode, css) => {
            const mounted = await mount({
              template: size({
                head: [sizing, ...css()],
                triggerClass: 'sc-wide',
                rootAttrs: { class: 'sc-pop sc-fit' },
                content: [h('div', { class: 'sc-tall' })],
              }),
            });
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            const view = mounted.container.ownerDocument.defaultView!;
            const p = rect(popover);
            expectNear(p.width, 300, `${mode}: width`);
            expectNear(p.top, rect(trigger).bottom + 8, `${mode}: top`);
            expectNear(p.bottom, view.innerHeight - 12, `${mode}: bottom`);
            await retire(mounted);
          });
        },
        PHASE,
      );

      scenario(
        'the arrow points at the centre of the trigger',
        async ({ mount, pointer }) => {
          await onEachMode(async (mode, css) => {
            const mounted = await mount({
              template: size({
                head: css({ positionArea: 'bottom span-right' }),
              }),
              props: { positionArea: 'bottom span-right' },
            });
            const trigger = mounted.part('trigger');
            const arrow = mounted.part('arrow');
            await pointer.click(trigger);
            await expect
              .poll(() => arrow.getAttribute('data-placement'))
              .toBe('bottom');
            const t = rect(trigger);
            const a = rect(arrow);
            expectNear(
              a.left + a.width / 2,
              t.left + t.width / 2,
              `${mode}: arrow centre`,
            );
            await retire(mounted);
          });
        },
        PHASE,
      );

      scenario(
        'follows its trigger when the page scrolls',
        async ({ mount, pointer }) => {
          const scrolling = h(
            'style',
            null,
            `.sc-trigger.sc-scrolls { position: absolute; top: 100px }
           .sc-spacer { height: 3000px }`,
          );
          await onEachMode(async (mode, css) => {
            const mounted = await mount({
              template: [
                ...size({
                  head: [scrolling, ...css()],
                  triggerClass: 'sc-scrolls',
                }),
                h('div', { class: 'sc-spacer' }),
              ],
              events: EVENTS,
            });
            const view = mounted.container.ownerDocument.defaultView!;
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            view.scrollBy(0, 50);
            await expect
              .poll(() => Math.round(rect(popover).top - rect(trigger).bottom))
              .toBe(8);
            expect(isInTopLayer(popover), mode).toBe(true);
            expect(reasons(mounted)).toEqual([]);
            view.scrollTo(0, 0);
            await retire(mounted);
          });
        },
        PHASE,
      );

      scenario(
        'closes with reason scroll once its trigger is scrolled out of view, leaving focus and scroll alone',
        async ({ mount, pointer }) => {
          const box = h(
            'style',
            null,
            `.sc-box { position: fixed; left: 150px; top: 100px; width: 200px; height: 100px; overflow: auto }
           .sc-box .sc-trigger { position: static }
           .sc-spacer { height: 1000px }`,
          );
          await onEachMode(async (mode, css) => {
            const mounted = await mount({
              template: [
                box,
                h(
                  'div',
                  { id: 'box', class: 'sc-box' },
                  ...size({ head: css() }),
                  h('div', { class: 'sc-spacer' }),
                ),
              ],
              events: EVENTS,
            });
            const scroller = byId(mounted, 'box');
            const trigger = mounted.part('trigger');
            await pointer.click(trigger);
            mounted.clearEvents();

            scroller.scrollTop = 500;
            await expect.poll(() => reasons(mounted)).toEqual(['scroll']);
            await closed(root(mounted));
            expect(activeElement(mounted), mode).not.toBe(trigger);
            expect(scroller.scrollTop, mode).toBe(500);
            await retire(mounted);
          });
        },
        PHASE,
      );
    });

    group('nested', () => {
      /** A "More" popover opened from inside the main one. */
      const more = nested(
        'popover',
        {},
        h('button', { part: 'trigger' }, 'More'),
        h(
          'div',
          { part: 'root', class: 'sc-pop' },
          h('input', { id: 'more', 'aria-label': 'More' }),
        ),
      );

      scenario(
        'Escape closes only the top popover',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: size({ content: [more] }),
            events: EVENTS,
          });
          const [outer, inner] = mounted.parts('root');
          const innerTrigger = mounted.parts('trigger')[1]!;
          await pointer.click(mounted.parts('trigger')[0]!);
          await pointer.click(innerTrigger);
          expect(isInTopLayer(inner!)).toBe(true);
          mounted.clearEvents();

          await keyboard.press('Escape');
          await closed(inner!);
          expect(isInTopLayer(outer!)).toBe(true);
          expect(activeElement(mounted)).toBe(innerTrigger);
          expect(mounted.events).toEqual([]);

          await keyboard.press('Escape');
          expect(reasons(mounted)).toEqual(['escape']);
          await closed(outer!);
        },
        PHASE,
      );

      scenario(
        'a press in the outer popover closes only the inner one; a press outside both closes both',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size({ content: [more] }),
            events: EVENTS,
          });
          const [outer, inner] = mounted.parts('root');
          const innerTrigger = mounted.parts('trigger')[1]!;
          await pointer.click(mounted.parts('trigger')[0]!);
          await pointer.click(innerTrigger);
          mounted.clearEvents();

          await pointer.click(mounted.part('title'));
          await closed(inner!);
          expect(isInTopLayer(outer!)).toBe(true);
          expect(mounted.events).toEqual([]);

          await pointer.click(innerTrigger);
          expect(isInTopLayer(inner!)).toBe(true);
          await pointer.click(byId(mounted, 'page'));
          await closed(inner!);
          await closed(outer!);
          expect(reasons(mounted)).toEqual(['outside']);
        },
        PHASE,
      );

      scenario(
        'closing a popover closes the popovers opened from inside it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: size({ content: [more] }),
            props: { isOpen: true },
          });
          const [outer, inner] = mounted.parts('root');
          const innerTrigger = mounted.parts('trigger')[1]!;
          await expect.poll(() => isInTopLayer(outer!)).toBe(true);
          await pointer.click(innerTrigger);
          expect(isInTopLayer(inner!)).toBe(true);

          await mounted.setProps({ isOpen: false });
          await closed(outer!);
          await closed(inner!);
          expect(innerTrigger.getAttribute('aria-expanded')).toBe('false');
        },
        PHASE,
      );

      scenario(
        'a Dialog opened from inside stacks above it, and closing it returns focus into the popover',
        async ({ mount, pointer, keyboard }) => {
          const confirmation = nested(
            'dialog',
            {},
            h('button', { part: 'trigger' }, 'Reset'),
            h(
              'dialog',
              { part: 'root' },
              h('h2', { part: 'title' }, 'Reset sizes'),
              h('button', { part: 'close' }, 'Cancel'),
            ),
          );
          const mounted = await mount({
            template: size({ content: [confirmation] }),
            events: EVENTS,
          });
          const popover = root(mounted);
          const dialog = mounted.container.querySelector('dialog')!;
          const reset = mounted.container.querySelector<HTMLElement>(
            '[data-scope="dialog"][data-part="trigger"]',
          )!;
          await pointer.click(mounted.part('trigger'));
          await pointer.click(reset);
          expect(dialog.matches(':modal')).toBe(true);
          expect(isInTopLayer(popover)).toBe(true);
          mounted.clearEvents();

          await keyboard.press('Escape');
          await expect.poll(() => dialog.open).toBe(false);
          expect(isInTopLayer(popover)).toBe(true);
          expect(activeElement(mounted)).toBe(reset);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );
    });

    group('without the Popover API', () => {
      scenario(
        'opens in place with fixed position below the trigger, hidden while closed, and closes as usual',
        async ({ mount, pointer, keyboard }) => {
          Reflect.set(window, FALLBACKS, { popover: false });
          try {
            const mounted = await mount({ template: size(), events: EVENTS });
            const trigger = mounted.part('trigger');
            const popover = root(mounted);
            await expect.poll(() => popover.hasAttribute('hidden')).toBe(true);
            expect(isShown(popover)).toBe(false);

            await pointer.click(trigger);
            await expect
              .poll(() => popover.getAttribute('data-placement'))
              .toBe('bottom');
            expect(isInTopLayer(popover)).toBe(false);
            expect(isShown(popover)).toBe(true);
            expect(popover.hasAttribute('hidden')).toBe(false);
            expect(getComputedStyle(popover).position).toBe('fixed');
            expectNear(rect(popover).top, rect(trigger).bottom + 8, 'top');
            expect(activeElement(mounted)).toBe(popover);

            await keyboard.press('Escape');
            await closed(popover);
            expect(popover.hasAttribute('hidden')).toBe(true);
            expect(activeElement(mounted)).toBe(trigger);

            await pointer.click(trigger);
            await pointer.click(byId(mounted, 'page'));
            await closed(popover);
            expect(reasons(mounted)).toEqual(['escape', 'outside']);
          } finally {
            Reflect.deleteProperty(window, FALLBACKS);
          }
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'opening, placing and closing never re-render the owner',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: size(), events: EVENTS });
          const renders = mounted.renderCount();
          await pointer.click(mounted.part('trigger'));
          await expect
            .poll(() => root(mounted).getAttribute('data-placement'))
            .toBe('bottom');
          await keyboard.press('Escape');
          await closed(root(mounted));
          expect(openChanges(mounted)).toEqual([true, false]);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the collapsed trigger, then only the open popover, named by the trigger',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({
            template: size({ hasTitle: false, hasDescription: false }),
          });
          expect(await spoken()).toContain('button, Size, not expanded');

          await pointer.click(mounted.part('trigger'));
          const phrases = await spoken();
          expect(phrases).toContain('dialog, Size');
          expect(phrases).toContain('textbox, Width');
          expect(phrases).not.toContain('Page');
        },
        PHASE,
      );

      scenario(
        'reads a titled popover by its title and description',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({ template: size() });
          await pointer.click(mounted.part('trigger'));
          expect(await spoken()).toContain(
            'dialog, Column size, Applies to every row.',
          );
        },
        PHASE,
      );

      scenario(
        'reads a non-modal popover with the page and the expanded trigger',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({
            template: size({ hasTitle: false, hasDescription: false }),
            props: { isNonModal: true },
          });
          await pointer.click(mounted.part('trigger'));
          const phrases = await spoken();
          expect(phrases).toContain('button, Size, 1 control, expanded');
          expect(phrases).toContain('dialog, Size');
          expect(phrases).toContain('Page');
        },
        PHASE,
      );
    });

    group('real screen readers', () => {
      scenario(
        'Enter on the trigger reads the popover, and Escape reads the trigger again',
        async ({ mount, screenReader }) => {
          const heard = {
            voiceover: {
              trigger: /Size collapsed button/,
              popover:
                /Column size dialog with \d+ items heading level 2 Column size/,
              returned: /^Size collapsed button$/,
            },
            nvda: {
              trigger: /Size, button, collapsed/,
              popover: /Column size, dialog, Applies to every row\./,
              returned: /^Size, button, collapsed$/,
            },
          }[screenReader.name];
          const mounted = await mount({ template: size() });
          await screenReader.startFrom(
            mounted.container.querySelector<HTMLElement>('#before')!,
          );
          await screenReader.press('Tab');
          expect.soft(await screenReader.spoken()).toMatch(heard.trigger);
          await screenReader.press('Enter');
          expect.soft(await screenReader.spoken()).toMatch(heard.popover);
          await screenReader.press('Escape');
          expect.soft(await screenReader.spoken()).toMatch(heard.returned);
        },
        { ...PHASE, needs: ['screenReader'] },
      );
    });
  },
);
