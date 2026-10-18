/**
 * Listbox conformance, from the spec approved by @tenphi on 2026-10-18
 * (`packages/core/src/components/listbox/spec.md`): Field composed on a
 * `role="listbox"` list whose options are item parts keyed by `data-key`;
 * selection in single and multiple mode with ranges from an anchor; the
 * keyboard map, typeahead and the page keys; roving focus, focus within and
 * focus moved off a removed option; presses, hover and touch; the modes and
 * states; the empty part; public state, render counts and spoken output.
 * Phase 4.
 *
 * Every scenario passes `items`, which React needs and the element then
 * takes as set; reading items from markup is the element's own test.
 */

import { defineConformance, h } from '@uniaria/testing';
import type {
  KeyboardInput,
  Mounted,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { ListboxItem, ListboxProps, ListboxState } from './types';

type MountedListbox = Mounted<ListboxProps, ListboxState>;

const PHASE = { phase: 4 } as const;
const TOUCH = { phase: 4, needs: ['touch'] } as const;

const PARTS = ['root', 'label', 'list', 'error', 'empty'];

const EVENTS = ['valueChange', 'action', 'focusChange'];

const FRUIT: readonly ListboxItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  { key: 'date', textValue: 'Date' },
];

const GROUPED: readonly ListboxItem[] = [
  { key: 'apple', textValue: 'Apple' },
  {
    key: 'citrus',
    textValue: 'Citrus',
    items: [
      { key: 'lemon', textValue: 'Lemon' },
      { key: 'lime', textValue: 'Lime' },
    ],
  },
  { key: 'kiwi', textValue: 'Kiwi' },
];

interface FruitOptions {
  readonly items?: readonly ListboxItem[];
  readonly hasDescription?: boolean;
  /** Attributes on the list part, such as a class that makes it scroll. */
  readonly list?: Readonly<Record<string, string>>;
  /** Attributes on every option part. */
  readonly option?: Readonly<Record<string, string>>;
  /** Nodes inside each option, for its label and description parts. */
  readonly content?: (item: ListboxItem) => TemplateNode[];
}

/**
 * A listbox "Fruit": a root around the label and the list, then the
 * description, the error and the empty part, as Cube UI Kit places them.
 * Groups and their options are `div`s, so the list is one too.
 */
function fruit({
  items = FRUIT,
  hasDescription = false,
  list = {},
  option = {},
  content = (item) => [item.textValue ?? item.key],
}: FruitOptions = {}): TemplateElement[] {
  const isGrouped = items.some((item) => item.items);
  const tag = isGrouped ? 'div' : 'li';
  const render = (item: ListboxItem): TemplateElement =>
    item.items
      ? h(
          'div',
          { part: 'group', 'data-key': item.key },
          h(
            'span',
            { part: 'groupLabel', 'data-key': item.key },
            item.textValue!,
          ),
          ...item.items.map(render),
        )
      : h(
          tag,
          { part: 'option', 'data-key': item.key, ...option },
          ...content(item),
        );
  return [
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Fruit'),
      h(
        isGrouped ? 'div' : 'ul',
        { part: 'list', ...list },
        ...items.map(render),
      ),
    ),
    ...(hasDescription ? [h('p', { part: 'description' }, 'Pick some')] : []),
    h('p', { part: 'error' }, 'Pick one'),
    h('p', { part: 'empty' }, 'No fruit'),
  ];
}

/** Text fields around the list, for Tab (WebKit's Tab skips buttons). */
function between(nodes: TemplateElement[]): TemplateElement[] {
  return [
    h('input', { id: 'before', 'aria-label': 'Before' }),
    ...nodes,
    h('input', { id: 'after', 'aria-label': 'After' }),
  ];
}

function byId(mounted: MountedListbox, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

/** The option part for a key. */
function option(mounted: MountedListbox, key: string): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `[data-scope="listbox"][data-part="option"][data-key="${key}"]`,
  );
  if (!element) throw new Error(`No option "${key}".`);
  return element;
}

/** An item part of another kind for a key. */
function itemPart(
  mounted: MountedListbox,
  part: string,
  key: string,
): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(
    `[data-scope="listbox"][data-part="${part}"][data-key="${key}"]`,
  )!;
}

/** Every option's key, in document order. */
function keysOf(mounted: MountedListbox): string[] {
  return mounted.parts('option').map((element) => element.dataset.key!);
}

/** The keys whose options read `aria-selected="true"`, in document order. */
function selectedKeys(mounted: MountedListbox): string[] {
  return mounted
    .parts('option')
    .filter((element) => element.getAttribute('aria-selected') === 'true')
    .map((element) => element.dataset.key!);
}

/** Each option's `tabindex`, in document order. */
function tabStops(mounted: MountedListbox): (string | null)[] {
  return mounted
    .parts('option')
    .map((element) => element.getAttribute('tabindex'));
}

/** The key of the option with focus, or `null`. */
function focusedKey(mounted: MountedListbox): string | null {
  const active = mounted.container.ownerDocument.activeElement as HTMLElement;
  return active?.dataset.part === 'option'
    ? (active.dataset.key ?? null)
    : null;
}

function details(mounted: MountedListbox, name: string): unknown[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail);
}

const changes = (mounted: MountedListbox) => details(mounted, 'valueChange');
const actions = (mounted: MountedListbox) => details(mounted, 'action');

/** A state attribute is on every named part, or on none. */
function expectOnEveryPart(
  mounted: MountedListbox,
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

/** Focuses the first field, then Tabs into the list. */
async function tabIn(
  mounted: MountedListbox,
  keyboard: KeyboardInput,
): Promise<void> {
  byId(mounted, 'before').focus();
  await keyboard.tab();
}

/** Presses `key` with modifiers held, released in reverse. */
async function chord(
  keyboard: KeyboardInput,
  modifiers: readonly string[],
  key: string,
): Promise<void> {
  for (const modifier of modifiers) await keyboard.down(modifier);
  await keyboard.press(key);
  for (const modifier of [...modifiers].reverse()) await keyboard.up(modifier);
}

/** Cmd on Apple platforms, Ctrl elsewhere. */
function mod(): string {
  return /^Mac/i.test(navigator.platform) ? 'Meta' : 'Control';
}

/**
 * Records whether each keydown was prevented once the page has seen it,
 * until `stop()`.
 */
function watchKeys(mounted: MountedListbox): {
  readonly prevented: Record<string, boolean>;
  stop(): void;
} {
  const prevented: Record<string, boolean> = {};
  const document = mounted.container.ownerDocument;
  const onKeyDown = (event: KeyboardEvent) => {
    prevented[event.key] = event.defaultPrevented;
  };
  document.addEventListener('keydown', onKeyDown);
  return {
    prevented,
    stop: () => document.removeEventListener('keydown', onKeyDown),
  };
}

/** Twenty options of 20px in a list 100px tall that scrolls. */
const SCROLLING: FruitOptions = {
  items: Array.from({ length: 20 }, (_, index) => ({
    key: `item-${index}`,
    textValue: `Item ${index}`,
  })),
  list: { class: 'sc-scroll' },
  option: { class: 'sc-row' },
};

/** The styles `SCROLLING` names, as a node to put beside the listbox. */
const SCROLLING_STYLE = h(
  'style',
  null,
  '.sc-scroll { height: 100px; overflow: auto; margin: 0; padding: 0; list-style: none }' +
    ' .sc-row { height: 20px; margin: 0; padding: 0 }',
);

export const listboxConformance = defineConformance<ListboxProps, ListboxState>(
  'listbox',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'composes Field on a listbox list, named by the label',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ hasDescription: true }),
            props: { items: FRUIT },
          });
          const list = mounted.part('list');
          const label = mounted.part('label');
          expect(list.getAttribute('role')).toBe('listbox');
          expect(list.getAttribute('aria-labelledby')).toBe(label.id);
          expect(list.getAttribute('aria-describedby')).toBe(
            mounted.part('description').id,
          );
          expect(list.getAttribute('aria-orientation')).toBe('vertical');
          expect(label.hasAttribute('for')).toBe(false);
          expect(mounted.part('error').hidden).toBe(true);
          expect(mounted.part('empty').hidden).toBe(true);
          for (const name of [
            'aria-multiselectable',
            'aria-disabled',
            'aria-readonly',
            'aria-invalid',
            'aria-required',
            'aria-activedescendant',
          ]) {
            expect(list.hasAttribute(name), name).toBe(false);
          }
          // Out of the tab order while an option is the tab stop.
          expect(list.getAttribute('tabindex')).toBe('-1');
          for (const attribute of [
            'data-disabled',
            'data-readonly',
            'data-invalid',
            'data-required',
            'data-multiple',
            'data-empty',
            'data-focus-within',
            'data-focus-visible',
          ]) {
            expectOnEveryPart(mounted, attribute, false);
          }
          for (const name of PARTS) {
            expect(mounted.part(name).getAttribute('data-orientation')).toBe(
              'vertical',
            );
          }
        },
        PHASE,
      );

      scenario(
        'writes every option: role, an id from the list and the key, unselected, one tab stop',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
          });
          const list = mounted.part('list');
          expect(keysOf(mounted)).toEqual([
            'apple',
            'banana',
            'cherry',
            'date',
          ]);
          for (const element of mounted.parts('option')) {
            expect(element.getAttribute('role')).toBe('option');
            expect(element.id).toBe(`${list.id}-option-${element.dataset.key}`);
            expect(element.getAttribute('aria-selected')).toBe('false');
            expect(element.hasAttribute('aria-disabled')).toBe(false);
            expect(element.hasAttribute('data-selected')).toBe(false);
          }
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1', '-1']);
        },
        PHASE,
      );

      scenario(
        'option ids follow listId and encode the key',
        async ({ mount }) => {
          const items = [
            { key: 'a b', textValue: 'A B' },
            { key: 'ab', textValue: 'AB' },
          ];
          const mounted = await mount({
            template: fruit({ items }),
            props: { items, listId: 'fruit' },
          });
          expect(mounted.part('list').id).toBe('fruit');
          expect(option(mounted, 'a b').id).toBe('fruit-option-a%20b');
          expect(option(mounted, 'ab').id).toBe('fruit-option-ab');
        },
        PHASE,
      );

      scenario(
        'an option is named by its label part and described by its description part',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({
              content: (item) => [
                h(
                  'span',
                  { part: 'optionLabel', 'data-key': item.key },
                  item.textValue!,
                ),
                h(
                  'small',
                  { part: 'optionDescription', 'data-key': item.key },
                  'Sweet',
                ),
              ],
            }),
            props: { items: FRUIT },
          });
          const apple = option(mounted, 'apple');
          const label = itemPart(mounted, 'optionLabel', 'apple');
          const description = itemPart(mounted, 'optionDescription', 'apple');
          expect(label.id).not.toBe('');
          expect(description.id).not.toBe('');
          expect(apple.getAttribute('aria-labelledby')).toBe(label.id);
          expect(apple.getAttribute('aria-describedby')).toBe(description.id);
          expect(
            option(mounted, 'banana').getAttribute('aria-labelledby'),
          ).toBe(itemPart(mounted, 'optionLabel', 'banana').id);
        },
        PHASE,
      );

      scenario(
        'groups are named by their labels, which are presentational',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ items: GROUPED }),
            props: { items: GROUPED },
          });
          const group = itemPart(mounted, 'group', 'citrus');
          const groupLabel = itemPart(mounted, 'groupLabel', 'citrus');
          expect(group.getAttribute('role')).toBe('group');
          expect(groupLabel.getAttribute('role')).toBe('presentation');
          expect(group.getAttribute('aria-labelledby')).toBe(groupLabel.id);
          expect(keysOf(mounted)).toEqual(['apple', 'lemon', 'lime', 'kiwi']);
        },
        PHASE,
      );

      scenario(
        'multiple mode makes the list multi-selectable',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, selectionMode: 'multiple' },
          });
          expect(
            mounted.part('list').getAttribute('aria-multiselectable'),
          ).toBe('true');
          expectOnEveryPart(mounted, 'data-multiple', true);
          await mounted.setProps({ selectionMode: 'single' });
          expect(
            mounted.part('list').hasAttribute('aria-multiselectable'),
          ).toBe(false);
          expectOnEveryPart(mounted, 'data-multiple', false);
        },
        PHASE,
      );

      scenario(
        'horizontal orientation is written on the list and every part',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, orientation: 'horizontal' },
          });
          expect(mounted.part('list').getAttribute('aria-orientation')).toBe(
            'horizontal',
          );
          for (const name of PARTS) {
            expect(mounted.part(name).getAttribute('data-orientation')).toBe(
              'horizontal',
            );
          }
        },
        PHASE,
      );
    });

    group('single selection', () => {
      scenario(
        'a click selects an option, replacing the selection, and reports it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'banana'));
          expect(selectedKeys(mounted)).toEqual(['banana']);
          expect(option(mounted, 'banana').hasAttribute('data-selected')).toBe(
            true,
          );
          expect(mounted.state().value).toEqual(['banana']);

          await pointer.click(option(mounted, 'cherry'));
          expect(selectedKeys(mounted)).toEqual(['cherry']);
          expect(option(mounted, 'banana').hasAttribute('data-selected')).toBe(
            false,
          );
          expect(changes(mounted)).toEqual([['banana'], ['cherry']]);
          expect(actions(mounted)).toEqual(['banana', 'cherry']);
        },
        PHASE,
      );

      scenario(
        'choosing the selected option again keeps it and reports only the action',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'banana'));
          await keyboard.press('Enter');
          await keyboard.press('Space');
          expect(selectedKeys(mounted)).toEqual(['banana']);
          expect(changes(mounted)).toEqual([]);
          expect(actions(mounted)).toEqual(['banana', 'banana', 'banana']);
        },
        PHASE,
      );

      scenario(
        'Enter and Space select the focused option',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('Enter');
          expect(selectedKeys(mounted)).toEqual(['apple']);
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          expect(selectedKeys(mounted)).toEqual(['banana']);
          expect(changes(mounted)).toEqual([['apple'], ['banana']]);
          expect(actions(mounted)).toEqual(['apple', 'banana']);
        },
        PHASE,
      );

      scenario(
        'Shift with Enter or Space selects as the key alone in single mode',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await chord(keyboard, ['Shift'], 'ArrowDown');
          expect(focusedKey(mounted)).toBe('banana');
          await chord(keyboard, ['Shift'], 'Space');
          expect(selectedKeys(mounted)).toEqual(['banana']);
          await keyboard.press('ArrowDown');
          await chord(keyboard, ['Shift'], 'Enter');
          expect(selectedKeys(mounted)).toEqual(['cherry']);
        },
        PHASE,
      );

      scenario(
        'defaultValue selects without reporting; the tab stop is the selected option',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['cherry'] },
            events: EVENTS,
          });
          expect(selectedKeys(mounted)).toEqual(['cherry']);
          expect(tabStops(mounted)).toEqual(['-1', '-1', '0', '-1']);
          expect(mounted.state().focusedKey).toBe('cherry');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a controlled value follows props, and a click only requests a change',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, value: ['apple'] },
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'date'));
          expect(changes(mounted)).toEqual([['date']]);
          expect(selectedKeys(mounted)).toEqual(['apple']);

          await mounted.setProps({ value: ['date'] });
          expect(selectedKeys(mounted)).toEqual(['date']);
          await mounted.setProps({ value: [] });
          expect(selectedKeys(mounted)).toEqual([]);
          expect(changes(mounted)).toEqual([['date']]);
        },
        PHASE,
      );

      scenario(
        'a key with no option stays in the value and selects nothing',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['mango'] },
          });
          expect(selectedKeys(mounted)).toEqual([]);
          expect(mounted.state().value).toEqual(['mango']);
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1', '-1']);
        },
        PHASE,
      );

      scenario(
        'arrows, Home, End and typeahead move focus without selecting',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, defaultValue: ['apple'] },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('End');
          await keyboard.press('Home');
          await keyboard.press('c');
          expect(focusedKey(mounted)).toBe('cherry');
          expect(selectedKeys(mounted)).toEqual(['apple']);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'Escape is left alone and keeps the selection',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'banana'));
          const keys = watchKeys(mounted);
          await keyboard.press('Escape');
          keys.stop();
          expect(keys.prevented.Escape).toBe(false);
          expect(selectedKeys(mounted)).toEqual(['banana']);
        },
        PHASE,
      );
    });

    group('multiple selection', () => {
      const MULTIPLE = { items: FRUIT, selectionMode: 'multiple' } as const;

      scenario(
        'a click toggles an option; the value keeps the order of selection',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: MULTIPLE,
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'cherry'));
          await pointer.click(option(mounted, 'apple'));
          expect(mounted.state().value).toEqual(['cherry', 'apple']);
          expect(selectedKeys(mounted)).toEqual(['apple', 'cherry']);
          await pointer.click(option(mounted, 'cherry'));
          expect(mounted.state().value).toEqual(['apple']);
          expect(changes(mounted)).toEqual([
            ['cherry'],
            ['cherry', 'apple'],
            ['apple'],
          ]);
          expect(actions(mounted)).toEqual(['cherry', 'apple', 'cherry']);
        },
        PHASE,
      );

      scenario(
        'Space and Enter toggle the focused option',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: MULTIPLE,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('Space');
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          expect(selectedKeys(mounted)).toEqual(['apple', 'banana']);
          await keyboard.press('Space');
          expect(selectedKeys(mounted)).toEqual(['apple']);
        },
        PHASE,
      );

      scenario(
        'Shift+Arrow selects from the anchor, replacing the range it made before',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: MULTIPLE,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          await chord(keyboard, ['Shift'], 'ArrowDown');
          await chord(keyboard, ['Shift'], 'ArrowDown');
          expect(focusedKey(mounted)).toBe('date');
          expect(selectedKeys(mounted)).toEqual(['banana', 'cherry', 'date']);
          await chord(keyboard, ['Shift'], 'ArrowUp');
          await chord(keyboard, ['Shift'], 'ArrowUp');
          await chord(keyboard, ['Shift'], 'ArrowUp');
          expect(focusedKey(mounted)).toBe('apple');
          expect(selectedKeys(mounted)).toEqual(['apple', 'banana']);
        },
        PHASE,
      );

      scenario(
        'with no anchor yet, a range starts at the option focused before',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { ...MULTIPLE, defaultValue: ['date'] },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('date');
          await keyboard.press('Home');
          await chord(keyboard, ['Shift'], 'ArrowDown');
          expect(selectedKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        },
        PHASE,
      );

      scenario(
        'Shift+click and Shift+Space select from the anchor',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: MULTIPLE,
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'banana'));
          await keyboard.down('Shift');
          await pointer.click(option(mounted, 'date'));
          await keyboard.up('Shift');
          expect(selectedKeys(mounted)).toEqual(['banana', 'cherry', 'date']);
          expect(
            mounted.container.ownerDocument.getSelection()?.isCollapsed ?? true,
          ).toBe(true);

          await keyboard.press('ArrowUp');
          await chord(keyboard, ['Shift'], 'Space');
          expect(selectedKeys(mounted)).toEqual(['banana', 'cherry']);
          expect(actions(mounted)).toEqual(['banana', 'date', 'cherry']);
        },
        PHASE,
      );

      scenario(
        'Ctrl+Shift+Home and End select to the first and last option and move there',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: MULTIPLE,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          await chord(keyboard, [mod(), 'Shift'], 'End');
          expect(focusedKey(mounted)).toBe('date');
          expect(selectedKeys(mounted)).toEqual(['cherry', 'date']);
          await chord(keyboard, [mod(), 'Shift'], 'Home');
          expect(focusedKey(mounted)).toBe('apple');
          expect(selectedKeys(mounted)).toEqual(['apple', 'banana', 'cherry']);
        },
        PHASE,
      );

      scenario(
        'Shift+Home and Shift+End move focus and select nothing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: MULTIPLE,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('Space');
          await chord(keyboard, ['Shift'], 'End');
          expect(focusedKey(mounted)).toBe('date');
          expect(selectedKeys(mounted)).toEqual(['apple']);
        },
        PHASE,
      );

      scenario(
        'Ctrl+A selects every enabled option and never deselects',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { ...MULTIPLE, disabledKeys: ['cherry'] },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          const keys = watchKeys(mounted);
          await chord(keyboard, [mod()], 'a');
          keys.stop();
          expect(keys.prevented.a).toBe(true);
          expect(mounted.state().value).toEqual(['banana', 'apple', 'date']);
          await chord(keyboard, [mod()], 'a');
          expect(changes(mounted)).toEqual([
            ['banana'],
            ['banana', 'apple', 'date'],
          ]);
        },
        PHASE,
      );

      scenario(
        'ranges skip disabled options',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { ...MULTIPLE, disabledKeys: ['banana'] },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('Space');
          await chord(keyboard, ['Shift'], 'ArrowDown');
          expect(focusedKey(mounted)).toBe('cherry');
          expect(selectedKeys(mounted)).toEqual(['apple', 'cherry']);
        },
        PHASE,
      );

      scenario(
        'in single mode Ctrl+A is left alone and Shift+Arrow only moves',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          await chord(keyboard, [mod()], 'a');
          keys.stop();
          expect(keys.prevented.a).toBe(false);
          await chord(keyboard, ['Shift'], 'ArrowDown');
          expect(focusedKey(mounted)).toBe('banana');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );
    });

    group('keyboard', () => {
      scenario(
        'the list is one tab stop: Tab enters at the first option and leaves',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('apple');
          await keyboard.tab();
          expect(mounted.container.ownerDocument.activeElement).toBe(
            byId(mounted, 'after'),
          );
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'Tab enters at the first selected option, then at the one focused last',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: {
              items: FRUIT,
              selectionMode: 'multiple',
              defaultValue: ['date', 'banana'],
            },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('banana');
          await keyboard.press('ArrowDown');
          await keyboard.tab();
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('cherry');
          expect(tabStops(mounted)).toEqual(['-1', '-1', '0', '-1']);
        },
        PHASE,
      );

      scenario(
        'Tab skips disabled options to the first enabled one',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, disabledKeys: ['apple'] },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('banana');
        },
        PHASE,
      );

      scenario(
        'ArrowDown and ArrowUp move across groups, skipping disabled options, and stop at the ends',
        async ({ mount, keyboard }) => {
          const items: ListboxItem[] = [
            ...GROUPED.slice(0, 2),
            { key: 'kiwi', textValue: 'Kiwi', isDisabled: true },
            { key: 'mango', textValue: 'Mango' },
          ];
          const mounted = await mount({
            template: between(fruit({ items })),
            props: { items },
          });
          await tabIn(mounted, keyboard);
          const visited: (string | null)[] = [];
          for (let step = 0; step < 4; step++) {
            await keyboard.press('ArrowDown');
            visited.push(focusedKey(mounted));
          }
          expect(visited).toEqual(['lemon', 'lime', 'mango', 'mango']);
          await keyboard.press('ArrowUp');
          expect(focusedKey(mounted)).toBe('lime');
          await keyboard.press('Home');
          const keys = watchKeys(mounted);
          await keyboard.press('ArrowUp');
          keys.stop();
          expect(focusedKey(mounted)).toBe('apple');
          expect(keys.prevented.ArrowUp).toBe(true);
        },
        PHASE,
      );

      scenario(
        'shouldFocusWrap wraps the arrows; Home and End never wrap',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, shouldFocusWrap: true },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowUp');
          expect(focusedKey(mounted)).toBe('date');
          await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('apple');
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'Home and End focus the first and last enabled options',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, disabledKeys: ['date', 'apple'] },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('cherry');
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('banana');
        },
        PHASE,
      );

      scenario(
        'vertical: ArrowLeft and ArrowRight are left alone',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          await keyboard.press('ArrowRight');
          await keyboard.press('ArrowLeft');
          keys.stop();
          expect(focusedKey(mounted)).toBe('apple');
          expect(keys.prevented).toEqual({
            ArrowRight: false,
            ArrowLeft: false,
          });
        },
        PHASE,
      );

      scenario(
        'horizontal: ArrowRight and ArrowLeft move, and ArrowDown and ArrowUp are left alone',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, orientation: 'horizontal' },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          await keyboard.press('ArrowRight');
          await keyboard.press('ArrowLeft');
          expect(focusedKey(mounted)).toBe('banana');
          const keys = watchKeys(mounted);
          await keyboard.press('ArrowDown');
          keys.stop();
          expect(focusedKey(mounted)).toBe('banana');
          expect(keys.prevented.ArrowDown).toBe(false);
        },
        PHASE,
      );

      scenario(
        'horizontal, right to left: ArrowLeft moves forward',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between([h('div', { dir: 'rtl' }, ...fruit())]),
            props: { items: FRUIT, orientation: 'horizontal' },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowLeft');
          expect(focusedKey(mounted)).toBe('banana');
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'arrows with Alt, Ctrl or Meta are left to the browser',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          for (const modifier of ['Alt', 'Control', 'Meta']) {
            const keys = watchKeys(mounted);
            await chord(keyboard, [modifier], 'ArrowDown');
            keys.stop();
            expect(keys.prevented.ArrowDown, modifier).toBe(false);
            expect(focusedKey(mounted), modifier).toBe('apple');
          }
        },
        PHASE,
      );

      scenario(
        'PageDown and PageUp move a page of the scrolling list',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [SCROLLING_STYLE, ...between(fruit(SCROLLING))],
            props: { items: SCROLLING.items! },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('PageDown');
          expect(focusedKey(mounted)).toBe('item-5');
          await keyboard.press('PageDown');
          expect(focusedKey(mounted)).toBe('item-10');
          await keyboard.press('PageUp');
          expect(focusedKey(mounted)).toBe('item-5');
        },
        PHASE,
      );

      scenario(
        'a list that scrolls is still one tab stop, and focus on it goes to the option',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [SCROLLING_STYLE, ...between(fruit(SCROLLING))],
            props: { items: SCROLLING.items! },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('item-0');
          await keyboard.press('ArrowDown');
          await keyboard.tab({ isBackward: true });
          expect(mounted.container.ownerDocument.activeElement).toBe(
            byId(mounted, 'before'),
          );
          mounted.part('list').focus();
          expect(focusedKey(mounted)).toBe('item-1');
        },
        PHASE,
      );

      scenario(
        'without scrolling, PageDown and PageUp go to the last and first option',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('PageDown');
          expect(focusedKey(mounted)).toBe('date');
          await keyboard.press('PageUp');
          expect(focusedKey(mounted)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'keys scroll the focused option into view in the list',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [SCROLLING_STYLE, ...between(fruit(SCROLLING))],
            props: { items: SCROLLING.items! },
          });
          await tabIn(mounted, keyboard);
          const list = mounted.part('list');
          const isInView = (key: string) => {
            const box = list.getBoundingClientRect();
            const rect = option(mounted, key).getBoundingClientRect();
            return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
          };
          expect(isInView('item-19')).toBe(false);
          await keyboard.press('End');
          expect(list.scrollTop).toBeGreaterThan(0);
          expect(isInView('item-19')).toBe(true);
          await keyboard.press('Home');
          expect(list.scrollTop).toBe(0);
          expect(isInView('item-0')).toBe(true);
        },
        PHASE,
      );

      scenario(
        'typing focuses the next option whose text starts with what was typed',
        async ({ mount, keyboard }) => {
          const items = [
            { key: 'apple', textValue: 'Apple' },
            { key: 'banana', textValue: 'Banana' },
            { key: 'blueberry', textValue: 'Blueberry' },
            { key: 'cherry', textValue: 'Cherry', isDisabled: true },
          ];
          const mounted = await mount({
            template: between(fruit({ items })),
            props: { items },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('b');
          expect(focusedKey(mounted)).toBe('banana');
          await keyboard.press('l');
          expect(focusedKey(mounted)).toBe('blueberry');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'typeahead never lands on a disabled option',
        async ({ mount, keyboard }) => {
          const items = [
            { key: 'apple', textValue: 'Apple' },
            { key: 'cherry', textValue: 'Cherry', isDisabled: true },
          ];
          const mounted = await mount({
            template: between(fruit({ items })),
            props: { items },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('c');
          expect(focusedKey(mounted)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'Space joins a query typed within a second instead of selecting',
        async ({ mount, keyboard }) => {
          const items = [
            { key: 'newark', textValue: 'Newark' },
            { key: 'new-york', textValue: 'New York' },
          ];
          const mounted = await mount({
            template: between(fruit({ items })),
            props: { items },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          for (const key of ['n', 'e', 'w', 'Space', 'y']) {
            await keyboard.press(key);
          }
          expect(focusedKey(mounted)).toBe('new-york');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'keyboard focus shows focus-visible on the option and every part',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          const banana = option(mounted, 'banana');
          expect(banana.hasAttribute('data-focused')).toBe(true);
          expect(banana.hasAttribute('data-focus-visible')).toBe(true);
          expect(option(mounted, 'apple').hasAttribute('data-focused')).toBe(
            false,
          );
          expectOnEveryPart(mounted, 'data-focus-within', true);
          expectOnEveryPart(mounted, 'data-focus-visible', true);
          expect(mounted.state().isFocusVisible).toBe(true);
        },
        PHASE,
      );
    });

    group('pointer and touch', () => {
      scenario(
        'a press focuses the option on pointer down and selects on release over it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          const banana = option(mounted, 'banana');
          await pointer.down(banana);
          expect(focusedKey(mounted)).toBe('banana');
          expect(banana.hasAttribute('data-pressed')).toBe(true);
          expect(banana.hasAttribute('data-focus-visible')).toBe(false);
          expect(selectedKeys(mounted)).toEqual([]);
          await pointer.up();
          await expect.poll(() => selectedKeys(mounted)).toEqual(['banana']);
          expect(banana.hasAttribute('data-pressed')).toBe(false);
          expect(tabStops(mounted)).toEqual(['-1', '0', '-1', '-1']);
        },
        PHASE,
      );

      scenario(
        'a press released over another option selects nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.down(option(mounted, 'apple'));
          await pointer.move(option(mounted, 'cherry'));
          await pointer.up();
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(selectedKeys(mounted)).toEqual([]);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a screen reader click selects',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          option(mounted, 'cherry').click();
          expect(selectedKeys(mounted)).toEqual(['cherry']);
          expect(actions(mounted)).toEqual(['cherry']);
        },
        PHASE,
      );

      scenario(
        'a press on a disabled option does nothing and leaves focus where it was',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, disabledKeys: ['cherry'] },
            events: EVENTS,
          });
          await pointer.click(option(mounted, 'banana'));
          mounted.clearEvents();
          await pointer.click(option(mounted, 'cherry'));
          option(mounted, 'cherry').click();
          expect(focusedKey(mounted)).toBe('banana');
          expect(selectedKeys(mounted)).toEqual(['banana']);
          expect(changes(mounted)).toEqual([]);
          expect(actions(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a hovering mouse marks the option, never a disabled one',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, disabledKeys: ['cherry'] },
          });
          await pointer.move(option(mounted, 'banana'));
          expect(option(mounted, 'banana').hasAttribute('data-hovered')).toBe(
            true,
          );
          await pointer.move(option(mounted, 'cherry'));
          expect(option(mounted, 'banana').hasAttribute('data-hovered')).toBe(
            false,
          );
          expect(option(mounted, 'cherry').hasAttribute('data-hovered')).toBe(
            false,
          );
          await pointer.move(option(mounted, 'date'));
          expect(option(mounted, 'date').hasAttribute('data-hovered')).toBe(
            true,
          );
          expect(focusedKey(mounted)).toBe(null);
        },
        PHASE,
      );

      scenario(
        'shouldFocusOnHover moves focus within the list to the hovered option',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, shouldFocusOnHover: true },
          });
          await pointer.move(option(mounted, 'banana'));
          expect(focusedKey(mounted)).toBe(null);
          await pointer.click(option(mounted, 'apple'));
          await pointer.move(option(mounted, 'cherry'));
          expect(focusedKey(mounted)).toBe('cherry');
          // Keyboard focus stays where the keys put it.
          await keyboard.press('ArrowDown');
          await pointer.move(option(mounted, 'banana'));
          expect(focusedKey(mounted)).toBe('date');
        },
        PHASE,
      );

      scenario(
        'touch: a tap selects on release',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await touch.down(option(mounted, 'banana'));
          expect(selectedKeys(mounted)).toEqual([]);
          await touch.up();
          await expect.poll(() => selectedKeys(mounted)).toEqual(['banana']);
          expect(option(mounted, 'banana').hasAttribute('data-hovered')).toBe(
            false,
          );
        },
        TOUCH,
      );

      scenario(
        'touch: a finger that leaves the option selects nothing',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await touch.down(option(mounted, 'banana'));
          await touch.moveOutside(option(mounted, 'banana'));
          await touch.up();
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(selectedKeys(mounted)).toEqual([]);
        },
        TOUCH,
      );
    });

    group('states', () => {
      scenario(
        'disabled: no tab stop, nothing selects, every part marked',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, isDisabled: true },
            events: EVENTS,
          });
          const list = mounted.part('list');
          expect(list.getAttribute('aria-disabled')).toBe('true');
          expect(list.getAttribute('tabindex')).toBe('-1');
          for (const element of mounted.parts('option')) {
            expect(element.getAttribute('aria-disabled')).toBe('true');
            expect(element.hasAttribute('tabindex')).toBe(false);
            expect(element.hasAttribute('data-disabled')).toBe(true);
          }
          expectOnEveryPart(mounted, 'data-disabled', true);
          await tabIn(mounted, keyboard);
          expect(mounted.container.ownerDocument.activeElement).toBe(
            byId(mounted, 'after'),
          );
          await pointer.click(option(mounted, 'banana'));
          option(mounted, 'banana').click();
          expect(selectedKeys(mounted)).toEqual([]);
          expect(mounted.eventNames()).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'disabled options from disabledKeys or the item: marked, no tab index',
        async ({ mount }) => {
          const items = [
            { key: 'apple', textValue: 'Apple', isDisabled: true },
            ...FRUIT.slice(1),
          ];
          const mounted = await mount({
            template: fruit({ items }),
            props: { items, disabledKeys: ['cherry'] },
          });
          for (const key of ['apple', 'cherry']) {
            expect(
              option(mounted, key).getAttribute('aria-disabled'),
              key,
            ).toBe('true');
            expect(
              option(mounted, key).hasAttribute('data-disabled'),
              key,
            ).toBe(true);
            expect(option(mounted, key).hasAttribute('tabindex'), key).toBe(
              false,
            );
          }
          expect(tabStops(mounted)).toEqual([null, '0', null, '-1']);
          expect(option(mounted, 'banana').hasAttribute('aria-disabled')).toBe(
            false,
          );
        },
        PHASE,
      );

      scenario(
        'read-only: focus moves, nothing selects and no action is reported',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, isReadOnly: true, defaultValue: ['apple'] },
            events: EVENTS,
          });
          expect(mounted.part('list').getAttribute('aria-readonly')).toBe(
            'true',
          );
          expectOnEveryPart(mounted, 'data-readonly', true);
          expect(option(mounted, 'banana').hasAttribute('data-readonly')).toBe(
            true,
          );
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('banana');
          await keyboard.press('Space');
          await keyboard.press('Enter');
          await pointer.click(option(mounted, 'cherry'));
          expect(selectedKeys(mounted)).toEqual(['apple']);
          expect(changes(mounted)).toEqual([]);
          expect(actions(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'required and invalid: on the list, the error shown and linked',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ hasDescription: true }),
            props: { items: FRUIT, isRequired: true },
          });
          const list = mounted.part('list');
          expect(list.getAttribute('aria-required')).toBe('true');
          expectOnEveryPart(mounted, 'data-required', true);
          await mounted.setProps({ isInvalid: true });
          expect(list.getAttribute('aria-invalid')).toBe('true');
          expect(mounted.part('error').hidden).toBe(false);
          expect(list.getAttribute('aria-describedby')).toBe(
            `${mounted.part('description').id} ${mounted.part('error').id}`,
          );
          expectOnEveryPart(mounted, 'data-invalid', true);
          expect(mounted.state().isErrorShown).toBe(true);
        },
        PHASE,
      );
    });

    group('empty', () => {
      scenario(
        'an empty list takes the tab stop and is described by the empty part',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit({ items: [] })),
            props: { items: [] },
          });
          const list = mounted.part('list');
          const empty = mounted.part('empty');
          expect(empty.hidden).toBe(false);
          expect(list.getAttribute('tabindex')).toBe('0');
          expect(list.getAttribute('aria-describedby')).toBe(empty.id);
          expectOnEveryPart(mounted, 'data-empty', true);
          expect(mounted.state().isEmpty).toBe(true);
          await tabIn(mounted, keyboard);
          expect(mounted.container.ownerDocument.activeElement).toBe(list);

          await mounted.setProps({ items: FRUIT });
          expect(empty.hidden).toBe(true);
          expect(list.hasAttribute('aria-describedby')).toBe(false);
          expectOnEveryPart(mounted, 'data-empty', false);
          expect(mounted.state().isEmpty).toBe(false);
        },
        PHASE,
      );

      scenario(
        'a list whose options are all disabled takes the tab stop itself',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: {
              items: FRUIT,
              disabledKeys: ['apple', 'banana', 'cherry', 'date'],
            },
          });
          expect(mounted.part('list').getAttribute('tabindex')).toBe('0');
          expect(mounted.part('empty').hidden).toBe(true);
          expect(mounted.state().focusedKey).toBe(null);
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'focus within the list is reported on entering and leaving',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.tab();
          expect(details(mounted, 'focusChange')).toEqual([true, false]);
          expect(mounted.state().isFocusWithin).toBe(false);
        },
        PHASE,
      );

      scenario(
        'the focused option disabled or removed: focus moves to the next, else the previous',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await mounted.setProps({ disabledKeys: ['banana'] });
          await expect.poll(() => focusedKey(mounted)).toBe('cherry');
          await keyboard.press('End');
          await mounted.setProps({ items: FRUIT.slice(0, 3) });
          await expect.poll(() => focusedKey(mounted)).toBe('cherry');
          expect(mounted.state().focusedKey).toBe('cherry');
        },
        PHASE,
      );

      scenario(
        'the last focusable option going away leaves focus on the list',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: {
              items: FRUIT,
              disabledKeys: ['apple', 'banana', 'cherry'],
            },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('date');
          await mounted.setProps({
            disabledKeys: ['apple', 'banana', 'cherry', 'date'],
          });
          await expect
            .poll(() => mounted.container.ownerDocument.activeElement)
            .toBe(mounted.part('list'));
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'public state follows props, selection and focus',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, selectionMode: 'multiple' },
          });
          expect(mounted.state()).toEqual({
            value: [],
            selectionMode: 'multiple',
            focusedKey: 'apple',
            isEmpty: false,
            isDisabled: false,
            isReadOnly: false,
            isRequired: false,
            isInvalid: false,
            isErrorShown: false,
            isFocusWithin: false,
            isFocusVisible: false,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          expect(mounted.state()).toMatchObject({
            value: ['banana'],
            focusedKey: 'banana',
            isFocusWithin: true,
            isFocusVisible: true,
          });
        },
        PHASE,
      );

      scenario(
        'focus, hover, presses and uncontrolled selection never re-render the owner',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: between(fruit()),
            props: { items: FRUIT, selectionMode: 'multiple' },
            events: EVENTS,
          });
          const renders = mounted.renderCount();
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Space');
          await chord(keyboard, ['Shift'], 'ArrowDown');
          await keyboard.press('d');
          await pointer.move(option(mounted, 'apple'));
          await pointer.click(option(mounted, 'apple'));
          await keyboard.tab();
          expect(changes(mounted)).toHaveLength(3);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the list with its label and orientation',
        async ({ mount, spoken }) => {
          await mount({ template: fruit(), props: { items: FRUIT } });
          expect(await spoken()).toContain(
            'listbox, Fruit, orientated vertically',
          );
        },
        PHASE,
      );

      scenario(
        'reads a multi-selectable list',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: { items: FRUIT, selectionMode: 'multiple' },
          });
          expect(await spoken()).toContain(
            'listbox, Fruit, orientated vertically, multi-selectable',
          );
        },
        PHASE,
      );

      scenario(
        'reads the error, invalid and required',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: { items: FRUIT, isInvalid: true, isRequired: true },
          });
          expect(await spoken()).toContain(
            'listbox, Fruit, Pick one, orientated vertically, invalid, required',
          );
        },
        PHASE,
      );

      scenario(
        'reads a horizontal disabled list',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: {
              items: FRUIT,
              orientation: 'horizontal',
              isDisabled: true,
            },
          });
          expect(await spoken()).toContain(
            'listbox, Fruit, orientated horizontally, disabled',
          );
        },
        PHASE,
      );

      scenario(
        'reads options with their state and position',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: {
              items: FRUIT,
              defaultValue: ['banana'],
              disabledKeys: ['cherry'],
            },
          });
          const phrases = await spoken();
          expect(phrases).toContain(
            'option, Apple, not selected, position 1, set size 4',
          );
          expect(phrases).toContain(
            'option, Banana, selected, position 2, set size 4',
          );
          expect(phrases).toContain(
            'option, Cherry, not selected, disabled, position 3, set size 4',
          );
        },
        PHASE,
      );

      scenario(
        'reads an option by its label part, with its description',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit({
              items: FRUIT.slice(0, 1),
              content: (item) => [
                h(
                  'span',
                  { part: 'optionLabel', 'data-key': item.key },
                  item.textValue!,
                ),
                h(
                  'small',
                  { part: 'optionDescription', 'data-key': item.key },
                  'Red and sweet',
                ),
              ],
            }),
            props: { items: FRUIT.slice(0, 1) },
          });
          expect(await spoken()).toContain(
            'option, Apple, Red and sweet, not selected, position 1, set size 1',
          );
        },
        PHASE,
      );

      scenario(
        'reads a group by its label, and counts positions in the group',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit({ items: GROUPED }),
            props: { items: GROUPED },
          });
          const phrases = await spoken();
          expect(phrases).toContain('group, Citrus');
          expect(phrases).toContain(
            'option, Lemon, not selected, position 1, set size 2',
          );
        },
        PHASE,
      );

      scenario(
        'reads the empty part with an empty list',
        async ({ mount, spoken }) => {
          await mount({ template: fruit({ items: [] }), props: { items: [] } });
          expect(await spoken()).toContain(
            'listbox, Fruit, No fruit, orientated vertically',
          );
        },
        PHASE,
      );

      scenario(
        'reads a read-only list',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: { items: FRUIT, isReadOnly: true },
          });
          expect(await spoken()).toContain(
            'listbox, Fruit, orientated vertically, read only',
          );
        },
        PHASE,
      );
    });
  },
);
