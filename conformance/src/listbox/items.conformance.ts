/**
 * Listbox's option extras, from the items spec approved by @tenphi on
 * 2026-10-22 (`packages/core/src/components/button/items.md`): the
 * `optionExtras` item part, which describes its option after the option's
 * description while rendered, and spoken output. Phase 5: the adapters
 * reach it with the implementation. The option tooltip is in the Tooltip
 * items suite, which mounts the tooltip around the list.
 */

import { defineConformance, h, partSelector } from '@uniaria/testing';
import type { Mounted, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { ListboxItem, ListboxProps, ListboxState } from './types';

type MountedListbox = Mounted<ListboxProps, ListboxState>;

const PHASE = { phase: 5 } as const;

const APPLE: readonly ListboxItem[] = [{ key: 'apple', textValue: 'Apple' }];

const FRUIT: readonly ListboxItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

interface FruitOptions {
  readonly items?: readonly ListboxItem[];
  readonly hasLabel?: boolean;
  readonly hasDescription?: boolean;
  /** Attributes on the extras, such as `aria-hidden`. */
  readonly extras?: Readonly<Record<string, string>>;
  /** Only these options have extras. */
  readonly withExtras?: readonly string[];
}

/**
 * A listbox "Fruit" whose options hold a label, a description "Red and
 * sweet" and the extras "New", each optional.
 */
function fruit({
  items = APPLE,
  hasLabel = true,
  hasDescription = false,
  extras = {},
  withExtras = items.map((item) => item.key),
}: FruitOptions = {}): TemplateNode[] {
  const content = (item: ListboxItem): TemplateNode[] => [
    hasLabel
      ? h(
          'span',
          { part: 'optionLabel', 'data-key': item.key },
          item.textValue!,
        )
      : item.textValue!,
    ...(hasDescription
      ? [
          ' ',
          h(
            'small',
            { part: 'optionDescription', 'data-key': item.key },
            'Red and sweet',
          ),
        ]
      : []),
    ...(withExtras.includes(item.key)
      ? [
          ' ',
          h(
            'span',
            { part: 'optionExtras', 'data-key': item.key, ...extras },
            'New',
          ),
        ]
      : []),
  ];
  return [
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Fruit'),
      h(
        'ul',
        { part: 'list' },
        ...items.map((item) =>
          h('li', { part: 'option', 'data-key': item.key }, ...content(item)),
        ),
      ),
    ),
  ];
}

function itemPart(
  mounted: MountedListbox,
  part: string,
  key: string,
): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('listbox', part)}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} for ${key}.`);
  return element;
}

export const listboxItemsConformance = defineConformance<
  ListboxProps,
  ListboxState
>('listbox', ({ scenario, group }) => {
  group('option extras', () => {
    scenario(
      'the extras describe their option after its description, by ids UniAria gives them',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ items: FRUIT, hasDescription: true }),
          props: { items: FRUIT },
        });
        const extras = itemPart(mounted, 'optionExtras', 'apple');
        const description = itemPart(mounted, 'optionDescription', 'apple');
        expect(extras.getAttribute('data-element')).toBe('OptionExtras');
        expect(extras.id).not.toBe('');
        expect(extras.id).not.toBe(
          itemPart(mounted, 'optionExtras', 'banana').id,
        );
        expect(
          itemPart(mounted, 'option', 'apple').getAttribute('aria-describedby'),
        ).toBe(`${description.id} ${extras.id}`);
      },
      PHASE,
    );

    scenario(
      'without a description, the extras alone describe the option; an option without extras has no description',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ items: FRUIT, withExtras: ['apple'] }),
          props: { items: FRUIT },
        });
        expect(
          itemPart(mounted, 'option', 'apple').getAttribute('aria-describedby'),
        ).toBe(itemPart(mounted, 'optionExtras', 'apple').id);
        expect(
          itemPart(mounted, 'option', 'banana').hasAttribute(
            'aria-describedby',
          ),
        ).toBe(false);
      },
      PHASE,
    );

    scenario(
      'reads the extras after the name, and after the description',
      async ({ mount, spoken }) => {
        const extrasOnly = await mount({
          template: fruit(),
          props: { items: APPLE },
        });
        expect(await spoken()).toContain(
          'option, Apple, New, not selected, position 1, set size 1',
        );
        extrasOnly.container.hidden = true;

        await mount({
          template: fruit({ hasDescription: true }),
          props: { items: APPLE },
        });
        expect(await spoken()).toContain(
          'option, Apple, Red and sweet New, not selected, position 1, set size 1',
        );
      },
      PHASE,
    );

    // A reference reads hidden content (accname, step 2A), so hidden extras
    // stay out of the option's aria-describedby.
    scenario(
      'extras hidden from assistive technology aren’t referenced or read',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: fruit({ extras: { 'aria-hidden': 'true' } }),
          props: { items: APPLE },
        });
        expect(
          itemPart(mounted, 'option', 'apple').hasAttribute('aria-describedby'),
        ).toBe(false);
        expect(await spoken()).toContain(
          'option, Apple, not selected, position 1, set size 1',
        );
      },
      PHASE,
    );
  });
});
