/**
 * The inline popover, from the spec approved by @tenphi on 2026-10-26
 * (`packages/core/src/components/popover/inline.md`): a drawer that is a
 * modal popover on narrow screens and plain content on wide ones, on one
 * element. The inline state (`isInline`): a root with none of the overlay's
 * attributes and every part marked `data-inline`, nothing opening it, a
 * controlled `isOpen` ignored, Tab in the page's order; turning it on while
 * open (closed at once, `openChange(false)` without `dismiss`, focus kept)
 * and off with focus inside (focus to the trigger). A popover with no
 * trigger, opened with `open()` by a toggle of the consumer's: not placed in
 * either positioning mode, Tab wrapping inside, focus back to the toggle, a
 * press on the toggle counting as outside. A press on the dimmed
 * `::backdrop`, which reaches the page below. A popover nested in an inline
 * root. Spoken output. Phase 8: the adapters reach it with the
 * implementation.
 *
 * The positioning mode is UniAria's page-wide setting, as in the Popover
 * suite.
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { PopoverDismissEvent, PopoverProps, PopoverState } from './types';

type MountedPopover = Mounted<PopoverProps, PopoverState>;

const PHASE = { phase: 8 } as const;

const EVENTS = ['openChange', 'dismiss'];

/** UniAria's page-wide settings: `positioning` picks the mode. */
const SETTINGS = Symbol.for('@uniaria/settings/v1');

/** What the overlay form writes on the root, and the inline form never does. */
const OVERLAY_ATTRIBUTES = [
  'popover',
  'hidden',
  'role',
  'tabindex',
  'aria-labelledby',
  'aria-describedby',
  'data-placement',
];

/** Inline styles and variables UniAria writes to place a popover, in either mode. */
const PLACING_STYLES = [
  'position',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'inset-block-start',
  'inset-block-end',
  'inset-inline-start',
  'inset-inline-end',
  'position-anchor',
  '--anchor-width',
  '--available-width',
  '--available-height',
];

/** An exit animation long enough to see a closing phase if one ran. */
const EXIT = 400;

/**
 * Fixed places: the drawer 200px wide along the left edge, its `::backdrop`
 * dimming the rest; the toggle and the page's button `#below` to its right.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-drawer { position: fixed; inset: 0 auto 0 0; width: 200px; height: 100vh; margin: 0; padding: 0; border: 0; box-sizing: border-box }
   .sc-drawer::backdrop { background: rgb(0 0 0 / 0.3) }
   @keyframes sc-inline-fade { to { opacity: 0 } }
   .sc-drawer[data-exiting] { animation: sc-inline-fade ${EXIT}ms linear forwards }
   .sc-toggle { position: fixed; left: 300px; top: 20px; width: 100px; height: 30px; margin: 0 }
   .sc-below { position: fixed; left: 300px; top: 100px; width: 120px; height: 40px; margin: 0 }
   .sc-menu { width: 120px; margin: 0; padding: 0; border: 0 }`,
);

interface DrawerOptions {
  /** The toggle is the trigger part; without it, a consumer's button `#toggle`. */
  readonly hasTrigger?: boolean;
  /** More content at the end of the drawer. */
  readonly content?: readonly TemplateNode[];
}

/**
 * A toggle "Menu", then a drawer: a `<nav>` "Docs" with a Close button and
 * two more buttons, then the page's button "Below". The plain buttons have a
 * tabindex: WebKit tabs to a button only with one, as macOS.
 */
function drawer({ hasTrigger = true, content = [] }: DrawerOptions = {}) {
  return [
    LAYOUT,
    hasTrigger
      ? h('button', { part: 'trigger', class: 'sc-toggle' }, 'Menu')
      : h(
          'button',
          { id: 'toggle', class: 'sc-toggle', tabindex: '0' },
          'Menu',
        ),
    h(
      'nav',
      { part: 'root', id: 'docs', class: 'sc-drawer', 'aria-label': 'Docs' },
      h('button', { part: 'close', tabindex: '0' }, 'Close'),
      h('button', { id: 'intro', tabindex: '0' }, 'Intro'),
      h('button', { id: 'api', tabindex: '0' }, 'API'),
      ...content,
    ),
    h('button', { id: 'below', class: 'sc-below', tabindex: '0' }, 'Below'),
  ];
}

/** A language popover inside the drawer. */
const LANGUAGES = nested(
  'popover',
  {},
  h('button', { part: 'trigger' }, 'Language'),
  h(
    'div',
    { part: 'root', class: 'sc-menu', 'aria-label': 'Languages' },
    h('button', { id: 'en', tabindex: '0' }, 'English'),
  ),
);

function byId(mounted: MountedPopover, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function root(mounted: MountedPopover): HTMLElement {
  return mounted.part('root');
}

function partsOf(mounted: MountedPopover, hasTrigger = true): HTMLElement[] {
  const names = hasTrigger ? ['trigger', 'root', 'close'] : ['root', 'close'];
  return names.map((name) => mounted.part(name));
}

const isInTopLayer = (element: Element) => element.matches(':popover-open');

const isShown = (element: Element) => element.getClientRects().length > 0;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function closed(popover: Element): Promise<void> {
  await expect.poll(() => isShown(popover)).toBe(false);
}

function openChanges(mounted: MountedPopover): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'openChange')
    .map((event) => event.detail);
}

function reasons(mounted: MountedPopover): PopoverDismissEvent['reason'][] {
  return mounted.events
    .filter((event) => event.name === 'dismiss')
    .map((event) => (event.detail as PopoverDismissEvent).reason);
}

function activeElement(mounted: MountedPopover): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/**
 * The root is plain content: none of the overlay's attributes, not placed,
 * shown, not in the top layer.
 */
function expectInline(mounted: MountedPopover, hasTrigger = true): void {
  const popover = root(mounted);
  for (const attribute of OVERLAY_ATTRIBUTES) {
    expect(popover.hasAttribute(attribute), attribute).toBe(false);
  }
  // Not placed: where the consumer's CSS puts it.
  for (const property of PLACING_STYLES) {
    expect(popover.style.getPropertyValue(property), property).toBe('');
  }
  expect(isShown(popover)).toBe(true);
  expect(isInTopLayer(popover)).toBe(false);
  for (const part of partsOf(mounted, hasTrigger)) {
    expect(part.hasAttribute('data-inline'), 'data-inline').toBe(true);
    for (const attribute of ['data-open', 'data-entering', 'data-exiting']) {
      expect(part.hasAttribute(attribute), attribute).toBe(false);
    }
  }
  if (hasTrigger) {
    const trigger = mounted.part('trigger');
    expect(trigger.hasAttribute('aria-expanded')).toBe(false);
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
  }
}

/** Runs `run` once per positioning mode. */
async function onEachMode(run: (mode: string) => Promise<void>) {
  for (const mode of ['script', 'css'] as const) {
    Reflect.set(globalThis, SETTINGS, { positioning: mode });
    try {
      await run(mode);
    } finally {
      Reflect.deleteProperty(globalThis, SETTINGS);
    }
  }
}

export const popoverInlineConformance = defineConformance<
  PopoverProps,
  PopoverState
>('popover', ({ scenario, group }) => {
  group('the inline state', () => {
    scenario(
      'an inline root is plain content: no overlay attributes, shown, the consumer’s own attributes kept, data-inline on every part, no aria-expanded on the trigger',
      async ({ mount }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true },
        });
        expectInline(mounted);
        expect(root(mounted).id).toBe('docs');
        expect(root(mounted).getAttribute('aria-label')).toBe('Docs');
        expect(mounted.state().isInline).toBe(true);
        expect(mounted.state().isOpen).toBe(false);
      },
      PHASE,
    );

    scenario(
      'turning it on removes the overlay attributes UniAria wrote and keeps the consumer’s; turning it off writes them back, closed',
      async ({ mount }) => {
        const mounted = await mount({ template: drawer() });
        const popover = root(mounted);
        expect(popover.getAttribute('popover')).toBe('manual');
        expect(popover.getAttribute('role')).toBe('dialog');
        expect(popover.getAttribute('tabindex')).toBe('-1');
        expect(isShown(popover)).toBe(false);
        expect(mounted.state().isInline).toBe(false);

        await mounted.setProps({ isInline: true });
        expectInline(mounted);
        expect(popover.getAttribute('aria-label')).toBe('Docs');
        expect(mounted.state().isInline).toBe(true);

        await mounted.setProps({ isInline: false });
        expect(popover.getAttribute('popover')).toBe('manual');
        expect(popover.getAttribute('role')).toBe('dialog');
        expect(popover.getAttribute('tabindex')).toBe('-1');
        expect(mounted.part('trigger').getAttribute('aria-expanded')).toBe(
          'false',
        );
        for (const part of partsOf(mounted)) {
          expect(part.hasAttribute('data-inline')).toBe(false);
        }
        await closed(popover);
        expect(mounted.state().isInline).toBe(false);
      },
      PHASE,
    );

    scenario(
      'nothing opens it: a press on the trigger, Enter on it, open() and Escape inside do nothing',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true },
          events: EVENTS,
        });
        const trigger = mounted.part('trigger');
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(trigger);
        await keyboard.press('Enter');
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(mounted.part('close'));
        await keyboard.press('Escape');
        await mounted.call('open');
        await pointer.click(trigger);
        await pause(100);
        expect(mounted.events).toEqual([]);
        expect(mounted.state().isOpen).toBe(false);
        expectInline(mounted);
      },
      PHASE,
    );

    scenario(
      'a controlled isOpen: true is ignored while inline',
      async ({ mount }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true, isOpen: true },
        });
        expectInline(mounted);
      },
      PHASE,
    );

    scenario(
      'Tab moves through an inline root in the page’s order, without wrapping',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true },
        });
        for (const id of ['trigger', 'close', 'intro', 'api', 'below']) {
          await keyboard.tab();
          const expected =
            id === 'trigger' || id === 'close'
              ? mounted.part(id)
              : byId(mounted, id);
          expect(activeElement(mounted), id).toBe(expected);
        }
      },
      PHASE,
    );
  });

  group('changing the state', () => {
    scenario(
      'turning it on while open closes it at once: openChange(false), no dismiss, no closing phase; the root stays and focus stays inside',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({ template: drawer(), events: EVENTS });
        const popover = root(mounted);
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        await keyboard.tab();
        const close = mounted.part('close');
        expect(activeElement(mounted)).toBe(close);
        mounted.clearEvents();

        await mounted.setProps({ isInline: true });
        expect(popover.hasAttribute('data-exiting')).toBe(false);
        expect(mounted.state().isExiting).toBe(false);
        expectInline(mounted);
        expect(openChanges(mounted)).toEqual([false]);
        expect(reasons(mounted)).toEqual([]);
        expect(mounted.state().isOpen).toBe(false);
        await pause(100);
        expect(activeElement(mounted)).toBe(close);
      },
      PHASE,
    );

    scenario(
      'controlled, turning it on while open reports openChange(false); left open by the consumer, it opens again when it leaves the inline state',
      async ({ mount }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isOpen: true },
          events: EVENTS,
        });
        const popover = root(mounted);
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        mounted.clearEvents();

        await mounted.setProps({ isInline: true });
        expect(openChanges(mounted)).toEqual([false]);
        expect(reasons(mounted)).toEqual([]);
        expectInline(mounted);

        await mounted.setProps({ isInline: false });
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        await mounted.setProps({ isOpen: false });
        await closed(popover);
      },
      PHASE,
    );

    scenario(
      'turning it off with focus inside hides the root and moves focus to the trigger',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true },
          events: EVENTS,
        });
        await keyboard.tab();
        await keyboard.tab();
        expect(activeElement(mounted)).toBe(mounted.part('close'));

        await mounted.setProps({ isInline: false });
        await closed(root(mounted));
        expect(activeElement(mounted)).toBe(mounted.part('trigger'));
        expect(mounted.events).toEqual([]);
      },
      PHASE,
    );
  });

  group('no trigger part', () => {
    scenario(
      'opened with open(), a popover with no trigger or anchor isn’t placed in either positioning mode',
      async ({ mount }) => {
        await onEachMode(async (mode) => {
          const mounted = await mount({
            template: drawer({ hasTrigger: false }),
          });
          const popover = root(mounted);
          await mounted.call('open');
          expect(isInTopLayer(popover), mode).toBe(true);
          await pause(100);
          for (const property of PLACING_STYLES) {
            expect(
              popover.style.getPropertyValue(property),
              `${mode}: ${property}`,
            ).toBe('');
          }
          expect(popover.hasAttribute('data-placement'), mode).toBe(false);
          // Where its own CSS puts it, along the left edge.
          const box = popover.getBoundingClientRect();
          expect(Math.round(box.left), `${mode}: left`).toBe(0);
          expect(Math.round(box.top), `${mode}: top`).toBe(0);
          await mounted.call('close');
          await closed(popover);
          mounted.container.hidden = true;
        });
      },
      PHASE,
    );

    scenario(
      'its toggle opens it with open(); no ARIA state on the toggle; Tab wraps inside; Escape closes it and focus returns to the toggle',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: drawer({ hasTrigger: false }),
          events: EVENTS,
        });
        const popover = root(mounted);
        const toggle = byId(mounted, 'toggle');
        toggle.addEventListener('click', () => void mounted.call('open'));
        const before = toggle.getAttributeNames().sort();

        await keyboard.tab();
        expect(activeElement(mounted)).toBe(toggle);
        await keyboard.press('Enter');
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        expect(activeElement(mounted)).toBe(popover);
        // The modal popover hides the outside, the toggle with it, from
        // assistive technology while open; it writes no state there.
        expect(toggle.hasAttribute('aria-expanded')).toBe(false);
        expect(toggle.hasAttribute('aria-controls')).toBe(false);

        for (const id of ['close', 'intro', 'api', 'close']) {
          await keyboard.tab();
          const expected =
            id === 'close' ? mounted.part('close') : byId(mounted, id);
          expect(activeElement(mounted), id).toBe(expected);
        }

        await keyboard.press('Escape');
        await closed(popover);
        expect(reasons(mounted)).toEqual(['escape']);
        expect(openChanges(mounted)).toEqual([true, false]);
        expect(activeElement(mounted)).toBe(toggle);
        expect(toggle.getAttributeNames().sort()).toEqual(before);
      },
      PHASE,
    );

    scenario(
      'a press on the toggle while open is outside: the popover closes with reason outside',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: drawer({ hasTrigger: false }),
          events: EVENTS,
        });
        const popover = root(mounted);
        await mounted.call('open');
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        mounted.clearEvents();

        await pointer.click(byId(mounted, 'toggle'));
        expect(reasons(mounted)).toEqual(['outside']);
        await closed(popover);
      },
      PHASE,
    );

    scenario(
      'a toggle kept out by shouldCloseOnInteractOutside closes it with close() instead',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: drawer({ hasTrigger: false }),
          props: {
            shouldCloseOnInteractOutside: (target: Element) =>
              target.closest('#toggle') === null,
          },
          events: EVENTS,
        });
        const popover = root(mounted);
        const toggle = byId(mounted, 'toggle');
        toggle.addEventListener(
          'click',
          () => void mounted.call(mounted.state().isOpen ? 'close' : 'open'),
        );

        await pointer.click(toggle);
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        await pointer.click(toggle);
        await closed(popover);
        expect(openChanges(mounted)).toEqual([true, false]);
        expect(reasons(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('backdrop', () => {
    scenario(
      'a press on the dimmed backdrop over a page button closes the popover with reason outside, and the button gets the click',
      async ({ mount, pointer }) => {
        // No trigger, so the drawer stays along the left edge, clear of #below.
        const mounted = await mount({
          template: drawer({ hasTrigger: false }),
          events: EVENTS,
        });
        const popover = root(mounted);
        const below = byId(mounted, 'below');
        let clicks = 0;
        below.addEventListener('click', () => clicks++);
        await mounted.call('open');
        await expect.poll(() => isInTopLayer(popover)).toBe(true);
        mounted.clearEvents();

        await pointer.click(below);
        expect(clicks).toBe(1);
        expect(reasons(mounted)).toEqual(['outside']);
        await closed(popover);
      },
      PHASE,
    );
  });

  group('nested', () => {
    scenario(
      'a popover inside an inline root opens and dismisses on its own',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: drawer({ content: [LANGUAGES] }),
          props: { isInline: true },
          events: EVENTS,
        });
        const [outer, inner] = mounted.parts('root');
        const language = mounted.parts('trigger')[1]!;
        expect(language.textContent).toBe('Language');
        expect(isShown(language)).toBe(true);

        await pointer.click(language);
        await expect.poll(() => isInTopLayer(inner!)).toBe(true);
        expect(isInTopLayer(outer!)).toBe(false);
        expect(isShown(outer!)).toBe(true);

        await keyboard.press('Escape');
        await closed(inner!);
        expect(activeElement(mounted)).toBe(language);

        await pointer.click(language);
        await expect.poll(() => isInTopLayer(inner!)).toBe(true);
        await pointer.click(byId(mounted, 'below'));
        await closed(inner!);

        expect(isShown(outer!)).toBe(true);
        expect(outer!.hasAttribute('data-inline')).toBe(true);
        expect(mounted.events).toEqual([]);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads an inline root as its own landmark, never as a dialog; out of the inline state and open, as a dialog',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: drawer(),
          props: { isInline: true },
        });
        const inline = await spoken();
        expect(inline).toContain('navigation, Docs');
        expect(inline.filter((phrase) => phrase.includes('dialog'))).toEqual(
          [],
        );

        await mounted.setProps({ isInline: false });
        await mounted.call('open');
        await expect.poll(() => isInTopLayer(root(mounted))).toBe(true);
        expect(await spoken()).toContain('dialog, Docs');
        await mounted.call('close');
        await closed(root(mounted));
      },
      PHASE,
    );
  });
});
