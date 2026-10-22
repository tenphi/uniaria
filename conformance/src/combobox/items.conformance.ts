/**
 * Combobox's option extras, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the
 * `optionExtras` item part, which describes its option. Combobox has no
 * trigger frame: its extras go in the anchor. Phase 5: the adapters reach it
 * with the implementation. The option tooltip, which follows the visible
 * highlight, is in the Tooltip items suite.
 */

import { defineConformance, h, partSelector } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { ComboboxItem, ComboboxProps, ComboboxState } from './types';

type MountedCombobox = Mounted<ComboboxProps, ComboboxState>;

const PHASE = { phase: 5 } as const;

const FRUIT: readonly ComboboxItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

const LAYOUT = h(
  'style',
  null,
  `.sc-root { position: fixed; left: 150px; top: 30px; margin: 0 }
   .sc-anchor { display: flex; width: 160px; height: 30px }
   .sc-input { width: 130px; height: 30px; margin: 0; padding: 0 4px; box-sizing: border-box }
   .sc-button { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-root p { margin: 0 }
   .sc-root [hidden] { display: none }
   .sc-pop { width: 160px; margin: 4px 0 0; padding: 0; border: 0 }
   .sc-list { margin: 0; padding: 0; list-style: none }
   .sc-option { display: block; height: 24px; margin: 0; padding: 0 }`,
);

/**
 * A combo box "Fruit" whose options hold their label and, for Apple only,
 * the extras "New", hidden from assistive technology with `hiddenExtras`.
 */
function fruit({
  hiddenExtras = false,
}: { readonly hiddenExtras?: boolean } = {}): TemplateNode[] {
  return [
    LAYOUT,
    h(
      'div',
      { part: 'root', class: 'sc-root' },
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
              ...(item.key === 'apple'
                ? [
                    ' ',
                    h(
                      'span',
                      {
                        part: 'optionExtras',
                        'data-key': item.key,
                        ...(hiddenExtras ? { 'aria-hidden': 'true' } : {}),
                      },
                      'New',
                    ),
                  ]
                : []),
            ),
          ),
        ),
        h('p', { part: 'empty' }, 'No fruit'),
      ),
      h('input', { part: 'hiddenInput', name: 'fruit' }),
    ),
  ];
}

function itemPart(
  mounted: MountedCombobox,
  part: string,
  key: string,
): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('combobox', part)}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} for ${key}.`);
  return element;
}

async function open(
  mounted: MountedCombobox,
  click: (target: Element) => Promise<void>,
): Promise<void> {
  await click(mounted.part('button'));
  await expect
    .poll(() => mounted.part('popover').matches(':popover-open'))
    .toBe(true);
}

export const comboboxItemsConformance = defineConformance<
  ComboboxProps,
  ComboboxState
>('combobox', ({ scenario, group }) => {
  group('option extras', () => {
    scenario(
      'the extras describe their option; an option without them has no description',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await open(mounted, (target) => pointer.click(target));
        const extras = itemPart(mounted, 'optionExtras', 'apple');
        expect(extras.getAttribute('data-element')).toBe('OptionExtras');
        expect(extras.id).not.toBe('');
        expect(
          itemPart(mounted, 'option', 'apple').getAttribute('aria-describedby'),
        ).toBe(extras.id);
        expect(
          itemPart(mounted, 'option', 'banana').hasAttribute(
            'aria-describedby',
          ),
        ).toBe(false);
      },
      PHASE,
    );

    scenario(
      'extras hidden from assistive technology aren’t referenced',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit({ hiddenExtras: true }),
          props: { items: FRUIT },
        });
        await open(mounted, (target) => pointer.click(target));
        expect(
          itemPart(mounted, 'option', 'apple').hasAttribute('aria-describedby'),
        ).toBe(false);
      },
      PHASE,
    );
  });
});
