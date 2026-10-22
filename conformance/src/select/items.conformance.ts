/**
 * Select's items parts, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the
 * `triggerFrame` and `triggerExtras` inside the root, with the trigger's
 * state and hover; the popover placed against the frame and as wide as it
 * through `--anchor-width`; a press on an extra while open, which is
 * outside; and the `optionExtras` item part, which describes its option.
 * Phase 5: the adapters reach it with the implementation. The trigger's
 * tooltip is in the Tooltip items suite; the option tooltip is linked by id
 * on elements, which the element tests cover.
 */

import { defineConformance, h, nested, partSelector } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { SelectItem, SelectProps, SelectState } from './types';

type MountedSelect = Mounted<SelectProps, SelectState>;

const PHASE = { phase: 5 } as const;

const EVENTS = ['valueChange', 'openChange'];

const FRUIT: readonly SelectItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

/** The trigger's state attributes the frame and the extras carry. */
const MIRRORED = ['data-open', 'data-invalid', 'data-hovered'];

/**
 * Fixed places: the select at (150, 30), its label above the frame: the
 * trigger 120×30, a 40px gap that is only the frame's, and the extras; the
 * popover 4px below; `#page` (not focusable) where the pointer rests,
 * `#before` and `#after` at the left.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-page { position: fixed; left: 0; top: 480px; width: 100px; height: 20px; margin: 0 }
   .sc-before { position: fixed; left: 0; top: 0; width: 100px }
   .sc-after { position: fixed; left: 0; top: 400px; width: 100px }
   .sc-root { position: fixed; left: 150px; top: 30px; margin: 0 }
   .sc-label { display: block; height: 20px }
   .sc-frame { display: flex; align-items: center; height: 30px; margin: 0; padding: 0 }
   .sc-trigger { display: block; width: 120px; height: 30px; margin: 0; padding: 0 }
   .sc-gap { display: block; width: 40px; height: 30px }
   .sc-extras { display: flex; align-items: center; gap: 4px; height: 30px }
   .sc-extra { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-root p { margin: 0 }
   .sc-root [hidden] { display: none }
   .sc-pop { width: auto; min-width: var(--anchor-width); margin: 4px 0 0; padding: 0; border: 0 }
   .sc-list { margin: 0; padding: 0; list-style: none }
   .sc-option { display: block; height: 24px; margin: 0; padding: 0 }`,
);

/**
 * A select "Fruit" whose trigger sits in a frame with a gap and the extras:
 * a UniAria Button "Clear Fruit" and a count "2". Each option holds its
 * label and the extras "New".
 */
function fruit(): TemplateNode[] {
  return [
    LAYOUT,
    h('p', { id: 'page', class: 'sc-page' }, 'Page'),
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    h(
      'div',
      { part: 'root', class: 'sc-root' },
      h('span', { part: 'label', class: 'sc-label' }, 'Fruit'),
      h(
        'div',
        { part: 'triggerFrame', class: 'sc-frame' },
        h(
          'button',
          { part: 'trigger', class: 'sc-trigger' },
          h('span', { part: 'value' }),
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
          h('span', { id: 'count' }, '2'),
        ),
      ),
      h('p', { part: 'error' }, 'Pick one'),
      h(
        'div',
        { part: 'popover', class: 'sc-pop' },
        h(
          'ul',
          { part: 'list', class: 'sc-list' },
          ...FRUIT.map((item) =>
            h(
              'li',
              { part: 'option', 'data-key': item.key, class: 'sc-option' },
              h(
                'span',
                { part: 'optionLabel', 'data-key': item.key },
                item.textValue!,
              ),
              ' ',
              h('span', { part: 'optionExtras', 'data-key': item.key }, 'New'),
            ),
          ),
        ),
      ),
      h('select', { part: 'hiddenSelect', name: 'fruit' }),
    ),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

function byId(mounted: MountedSelect, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function itemPart(
  mounted: MountedSelect,
  part: string,
  key: string,
): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('select', part)}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} for ${key}.`);
  return element;
}

function isOpen(mounted: MountedSelect): boolean {
  return (
    mounted.part('trigger').getAttribute('aria-expanded') === 'true' &&
    mounted.part('popover').matches(':popover-open')
  );
}

async function closed(mounted: MountedSelect): Promise<void> {
  await expect
    .poll(() => mounted.part('popover').matches(':popover-open'))
    .toBe(false);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rect = (element: Element) => element.getBoundingClientRect();

function expectNear(actual: number, expected: number, what: string): void {
  expect(
    Math.abs(actual - expected),
    `${what}: ${actual} ≈ ${expected}`,
  ).toBeLessThanOrEqual(1);
}

function expectOnTriggerParts(
  mounted: MountedSelect,
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

export const selectItemsConformance = defineConformance<
  SelectProps,
  SelectState
>('select', ({ scenario, group }) => {
  group('trigger frame and extras', () => {
    scenario(
      'the frame and the extras are parts inside the root, around and beside the trigger',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const frame = mounted.part('triggerFrame');
        const extras = mounted.part('triggerExtras');
        expect(frame.getAttribute('data-element')).toBe('TriggerFrame');
        expect(extras.getAttribute('data-element')).toBe('TriggerExtras');
        expect(frame.hasAttribute('role')).toBe(false);
        expect(frame.contains(mounted.part('trigger'))).toBe(true);
        expect(mounted.part('trigger').contains(extras)).toBe(false);
      },
      PHASE,
    );

    scenario(
      'they carry data-open and data-invalid, and hover over the frame is the trigger’s',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        for (const attribute of MIRRORED) {
          expectOnTriggerParts(mounted, attribute, false);
        }

        await pointer.move(mounted.container.querySelector('.sc-gap')!);
        expectOnTriggerParts(mounted, 'data-hovered', true);
        await pointer.move(byId(mounted, 'count'));
        expectOnTriggerParts(mounted, 'data-hovered', true);
        await pointer.move(byId(mounted, 'page'));
        expectOnTriggerParts(mounted, 'data-hovered', false);

        await mounted.setProps({ isInvalid: true });
        expectOnTriggerParts(mounted, 'data-invalid', true);

        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expectOnTriggerParts(mounted, 'data-open', true);
      },
      PHASE,
    );

    scenario(
      'the popover sits below the frame, as wide as it through --anchor-width',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        const f = rect(mounted.part('triggerFrame'));
        const p = rect(mounted.part('popover'));
        expect(f.width).toBeGreaterThan(rect(mounted.part('trigger')).width);
        expectNear(p.width, f.width, 'width');
        expectNear(p.left, f.left, 'left');
        expectNear(p.top, f.bottom + 4, 'top');
      },
      PHASE,
    );

    scenario(
      'a press on an extra while open closes the list without selecting; the extra acts and keeps focus',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const clear = byId(mounted, 'clear');
        let clicks = 0;
        clear.addEventListener('click', () => clicks++);
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        mounted.clearEvents();

        await pointer.click(clear);
        expect(clicks).toBe(1);
        await closed(mounted);
        expect(mounted.eventNames()).toEqual(['openChange']);
        await pause(100);
        expect(mounted.container.ownerDocument.activeElement).toBe(clear);
      },
      PHASE,
    );

    scenario(
      'hover over the frame never re-renders the owner',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const renders = mounted.renderCount();
        await pointer.move(mounted.container.querySelector('.sc-gap')!);
        await pointer.move(byId(mounted, 'count'));
        await pointer.move(byId(mounted, 'page'));
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('option extras', () => {
    scenario(
      'the extras describe their option',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        for (const key of ['apple', 'banana']) {
          const extras = itemPart(mounted, 'optionExtras', key);
          expect(extras.getAttribute('data-element')).toBe('OptionExtras');
          expect(extras.id).not.toBe('');
          expect(
            itemPart(mounted, 'option', key).getAttribute('aria-describedby'),
          ).toBe(extras.id);
        }
      },
      PHASE,
    );

    scenario(
      'reads an option’s extras after its name while open',
      async ({ mount, pointer, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await pointer.click(mounted.part('trigger'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(await spoken()).toContain(
          'option, Apple, New, not selected, position 1, set size 2',
        );
      },
      PHASE,
    );
  });
});
