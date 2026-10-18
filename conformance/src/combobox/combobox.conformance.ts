/**
 * Combobox conformance, from the spec approved by @tenphi on 2026-10-18
 * (`packages/core/src/components/combobox/spec.md`): a `role="combobox"`
 * input with list autocomplete, named by its label, controlling Listbox's
 * list in a non-modal popover; a button that never takes focus; filtering as
 * the user types, with groups, a custom filter, the empty part and the
 * option count announced; the highlighted option in
 * `aria-activedescendant`, moved by the keys and by hover; choosing, and the
 * text settling on Enter and as focus leaves; Escape and Tab; presses on the
 * button, the options, the input and outside, and touch; the states; the
 * hidden input for forms, reset and required validation; focus within;
 * public state, render counts and spoken output. Phase 4.
 *
 * Every scenario passes `items`; reading them from markup is the element's
 * own test.
 */

import { defineConformance, h } from '@uniaria/testing';
import type {
  KeyboardInput,
  Mounted,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { ComboboxItem, ComboboxProps, ComboboxState } from './types';

type MountedCombobox = Mounted<ComboboxProps, ComboboxState>;

const PHASE = { phase: 4 } as const;
const TOUCH = { phase: 4, needs: ['touch'] } as const;

/** The named parts every template renders and the state attributes reach. */
const PARTS = [
  'root',
  'label',
  'anchor',
  'input',
  'button',
  'popover',
  'list',
  'empty',
  'error',
];

const EVENTS = ['valueChange', 'inputChange', 'openChange', 'focusChange'];

const FRUIT: readonly ComboboxItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  { key: 'date', textValue: 'Date' },
];

const GROUPED: readonly ComboboxItem[] = [
  {
    key: 'fruit',
    textValue: 'Fruit',
    items: [
      { key: 'apple', textValue: 'Apple' },
      { key: 'banana', textValue: 'Banana' },
    ],
  },
  {
    key: 'vegetables',
    textValue: 'Vegetables',
    items: [
      { key: 'carrot', textValue: 'Carrot' },
      { key: 'leek', textValue: 'Leek' },
    ],
  },
];

/** Twenty options, of which four fit the list at once. */
const MANY: readonly ComboboxItem[] = Array.from(
  { length: 20 },
  (_, index) => ({ key: `item-${index}`, textValue: `Item ${index}` }),
);

/**
 * Fixed places: the combo box at (150, 30) with its label above the anchor
 * (160×30 at y 50: the input, then the 30px button); the popover 160px
 * wide, 4px below the anchor, its options 24px tall; `#before` above-left
 * and `#after` and `#other` below, so nothing a scenario presses is covered.
 * A filtered-out option stays out of the layout.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-before { position: fixed; left: 0; top: 0; width: 100px }
   .sc-root { position: fixed; left: 150px; top: 30px; margin: 0 }
   .sc-label { display: block; height: 20px }
   .sc-anchor { display: flex; width: 160px; height: 30px }
   .sc-input { width: 130px; height: 30px; margin: 0; padding: 0 4px; box-sizing: border-box }
   .sc-button { width: 30px; height: 30px; margin: 0; padding: 0 }
   .sc-root p { margin: 0 }
   .sc-pop { width: 160px; margin: 4px 0 0; padding: 0; border: 0 }
   .sc-list { margin: 0; padding: 0; list-style: none }
   .sc-scroll { max-height: 96px; overflow: auto }
   .sc-option { display: block; height: 24px; margin: 0; padding: 0 }
   .sc-root [hidden] { display: none }
   .sc-after { position: fixed; left: 0; top: 400px; width: 100px }
   .sc-other { position: fixed; left: 0; top: 440px }`,
);

interface FruitOptions {
  readonly items?: readonly ComboboxItem[];
  readonly hasDescription?: boolean;
  /** Render the empty part. */
  readonly hasEmpty?: boolean;
  /** Extra classes on the list. */
  readonly listClass?: string;
  /** Wrap the combo box in `<form id="form">`. */
  readonly inForm?: boolean;
}

/**
 * A combo box "Fruit": the label, the anchor with the input and the button
 * (its chevron hidden from assistive technology), the description, the
 * error, the popover with the list and the empty part, and the hidden input
 * named `fruit`; `#before` before it, `#after` and `#other` after it.
 */
function fruit({
  items = FRUIT,
  hasDescription = false,
  hasEmpty = true,
  listClass = '',
  inForm = false,
}: FruitOptions = {}): TemplateNode[] {
  const isGrouped = items.some((item) => item.items);
  const tag = isGrouped ? 'div' : 'li';
  const render = (item: ComboboxItem): TemplateElement =>
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
          { part: 'option', 'data-key': item.key, class: 'sc-option' },
          item.textValue ?? item.key,
        );
  const combo = h(
    'div',
    { part: 'root', class: 'sc-root' },
    h('label', { part: 'label', class: 'sc-label' }, 'Fruit'),
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
    ...(hasDescription ? [h('p', { part: 'description' }, 'Pick some')] : []),
    h('p', { part: 'error' }, 'Pick one'),
    h(
      'div',
      { part: 'popover', class: 'sc-pop' },
      h(
        isGrouped ? 'div' : 'ul',
        { part: 'list', class: `sc-list ${listClass}`.trim() },
        ...items.map(render),
      ),
      ...(hasEmpty ? [h('p', { part: 'empty' }, 'No fruit')] : []),
    ),
    h('input', { part: 'hiddenInput', name: 'fruit' }),
  );
  return [
    LAYOUT,
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    inForm ? h('form', { id: 'form' }, combo) : combo,
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
    h('button', { id: 'other', class: 'sc-other' }, 'Other'),
  ];
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function byId(mounted: MountedCombobox, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function input(mounted: MountedCombobox): HTMLInputElement {
  return mounted.part('input') as HTMLInputElement;
}

function button(mounted: MountedCombobox): HTMLButtonElement {
  return mounted.part('button') as HTMLButtonElement;
}

function hiddenInput(mounted: MountedCombobox): HTMLInputElement {
  return mounted.part('hiddenInput') as HTMLInputElement;
}

function form(mounted: MountedCombobox): HTMLFormElement {
  return byId(mounted, 'form') as HTMLFormElement;
}

/** The item part of `part` for a key. */
function item(mounted: MountedCombobox, part: string, key: string) {
  const element = mounted.container.querySelector<HTMLElement>(
    `[data-scope="combobox"][data-part="${part}"][data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} "${key}".`);
  return element;
}

const option = (mounted: MountedCombobox, key: string) =>
  item(mounted, 'option', key);

/** The keys of the options the filter leaves, in document order. */
function shownKeys(mounted: MountedCombobox): string[] {
  return mounted
    .parts('option')
    .filter((element) => !element.hidden)
    .map((element) => element.dataset.key!);
}

/** The option `aria-activedescendant` points at, or `null`. */
function highlighted(mounted: MountedCombobox): string | null {
  const id = input(mounted).getAttribute('aria-activedescendant');
  if (!id) return null;
  const element = mounted.container.ownerDocument.getElementById(id);
  return element?.dataset.key ?? null;
}

function active(mounted: MountedCombobox): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** The popover is in the top layer. */
function isShown(mounted: MountedCombobox): boolean {
  return mounted.part('popover').matches(':popover-open');
}

/** Open: the input says so and the popover is shown. */
function isOpen(mounted: MountedCombobox): boolean {
  return (
    input(mounted).getAttribute('aria-expanded') === 'true' && isShown(mounted)
  );
}

/** Waits until the popover has closed. */
async function closed(mounted: MountedCombobox): Promise<void> {
  await expect.poll(() => isShown(mounted)).toBe(false);
  expect(input(mounted).getAttribute('aria-expanded')).toBe('false');
}

function details(mounted: MountedCombobox, name: string): unknown[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail);
}

const changes = (mounted: MountedCombobox) => details(mounted, 'valueChange');
const texts = (mounted: MountedCombobox) => details(mounted, 'inputChange');
const opens = (mounted: MountedCombobox) => details(mounted, 'openChange');

/** A state attribute is on every named part, or on none. */
function expectOnEveryPart(
  mounted: MountedCombobox,
  attribute: string,
  present: boolean,
  parts: readonly string[] = PARTS,
): void {
  for (const name of parts) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(present);
  }
}

/** Types `text` into the focused element, one key press per character. */
async function typeText(keyboard: KeyboardInput, text: string): Promise<void> {
  for (const character of text) {
    await keyboard.press(character === ' ' ? 'Space' : character);
  }
}

/** Focuses the input, selects its text and types `text` over it. */
async function retype(
  mounted: MountedCombobox,
  keyboard: KeyboardInput,
  text: string,
): Promise<void> {
  const field = input(mounted);
  field.focus();
  field.select();
  if (text === '') await keyboard.press('Backspace');
  else await typeText(keyboard, text);
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

/**
 * Records, for every keydown until `stop()`, whether it was prevented once
 * the page had seen it, in order.
 */
function watchKeys(mounted: MountedCombobox): {
  readonly prevented: [string, boolean][];
  stop(): void;
} {
  const prevented: [string, boolean][] = [];
  const document = mounted.container.ownerDocument;
  const onKeyDown = (event: KeyboardEvent) => {
    prevented.push([event.key, event.defaultPrevented]);
  };
  document.addEventListener('keydown', onKeyDown);
  return {
    prevented,
    stop: () => document.removeEventListener('keydown', onKeyDown),
  };
}

/** Focuses the input and opens the list with `key`. */
async function openWith(
  mounted: MountedCombobox,
  keyboard: KeyboardInput,
  key = 'ArrowDown',
): Promise<void> {
  input(mounted).focus();
  await keyboard.press(key);
  await expect.poll(() => isOpen(mounted)).toBe(true);
}

export const comboboxConformance = defineConformance<
  ComboboxProps,
  ComboboxState
>('combobox', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'the input is a combobox with list autocomplete, named by the label, controlling the list',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const field = input(mounted);
        const label = mounted.part('label');
        const list = mounted.part('list');
        expect(field.getAttribute('role')).toBe('combobox');
        expect(field.getAttribute('aria-autocomplete')).toBe('list');
        expect(field.getAttribute('aria-expanded')).toBe('false');
        expect(field.getAttribute('aria-controls')).toBe(list.id);
        expect(field.getAttribute('aria-labelledby')).toBe(label.id);
        expect(label.getAttribute('for')).toBe(field.id);
        expect(field.getAttribute('autocomplete')).toBe('off');
        expect(field.getAttribute('autocorrect')).toBe('off');
        expect(field.getAttribute('spellcheck')).toBe('false');
        for (const name of [
          'aria-activedescendant',
          'aria-describedby',
          'aria-required',
          'aria-invalid',
          'required',
          'readonly',
          'disabled',
        ]) {
          expect(field.hasAttribute(name), name).toBe(false);
        }
        expect(field.value).toBe('');
        expect(list.getAttribute('role')).toBe('listbox');
        expect(list.getAttribute('aria-labelledby')).toBe(label.id);
        expect(list.hasAttribute('tabindex')).toBe(false);
        for (const each of mounted.parts('option')) {
          expect(each.hasAttribute('tabindex')).toBe(false);
          expect(each.hidden).toBe(false);
        }
        expect(mounted.part('error').hidden).toBe(true);
        for (const name of [
          'data-open',
          'data-disabled',
          'data-readonly',
          'data-required',
          'data-invalid',
          'data-empty',
          'data-focus-within',
          'data-focus-visible',
        ]) {
          expectOnEveryPart(mounted, name, false);
        }
      },
      PHASE,
    );

    scenario(
      'the button is out of the tab order, named "Show suggestions" and the label, with a listbox popup',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const chevron = button(mounted);
        expect(chevron.type).toBe('button');
        expect(chevron.getAttribute('tabindex')).toBe('-1');
        expect(chevron.getAttribute('aria-label')).toBe('Show suggestions');
        expect(chevron.getAttribute('aria-labelledby')).toBe(
          `${chevron.id} ${mounted.part('label').id}`,
        );
        expect(chevron.getAttribute('aria-haspopup')).toBe('listbox');
        expect(chevron.getAttribute('aria-expanded')).toBe('false');
        expect(chevron.getAttribute('aria-controls')).toBe(
          mounted.part('list').id,
        );
        expect(chevron.disabled).toBe(false);

        await mounted.setProps({ buttonLabel: 'Montrer les suggestions' });
        expect(chevron.getAttribute('aria-label')).toBe(
          'Montrer les suggestions',
        );
      },
      PHASE,
    );

    scenario(
      'the popover is a manual popover with no role, tabindex or name, hidden while closed',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const popover = mounted.part('popover');
        expect(popover.getAttribute('popover')).toBe('manual');
        expect(popover.id).not.toBe('');
        for (const name of [
          'role',
          'tabindex',
          'aria-labelledby',
          'aria-describedby',
          'aria-modal',
        ]) {
          expect(popover.hasAttribute(name), name).toBe(false);
        }
        expect(isShown(mounted)).toBe(false);
        expect(mounted.parts('option')).toHaveLength(4);
      },
      PHASE,
    );

    scenario(
      'the description and the error describe the input, not the list',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ hasDescription: true }),
          props: { items: FRUIT, isInvalid: true },
        });
        expect(input(mounted).getAttribute('aria-describedby')).toBe(
          `${mounted.part('description').id} ${mounted.part('error').id}`,
        );
        expect(mounted.part('list').hasAttribute('aria-describedby')).toBe(
          false,
        );
      },
      PHASE,
    );

    scenario(
      'inputId names the input and option ids follow listId',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, inputId: 'pick', listId: 'fruit' },
        });
        expect(input(mounted).id).toBe('pick');
        expect(mounted.part('label').getAttribute('for')).toBe('pick');
        expect(mounted.part('list').id).toBe('fruit');
        expect(input(mounted).getAttribute('aria-controls')).toBe('fruit');
        expect(option(mounted, 'banana').id).toBe('fruit-option-banana');
      },
      PHASE,
    );

    scenario(
      "the input shows the selected option's text and follows the value the consumer sets",
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['banana'] },
          events: EVENTS,
        });
        expect(input(mounted).value).toBe('Banana');
        expect(hiddenInput(mounted).value).toBe('banana');
        expect(option(mounted, 'banana').getAttribute('aria-selected')).toBe(
          'true',
        );

        await mounted.setProps({ value: ['cherry'] });
        await expect.poll(() => input(mounted).value).toBe('Cherry');
        expect(hiddenInput(mounted).value).toBe('cherry');
        await mounted.setProps({ value: [] });
        await expect.poll(() => input(mounted).value).toBe('');
        expect(hiddenInput(mounted).value).toBe('');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'defaultInputValue seeds the text; a custom value shows its own text',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultInputValue: 'Ch' },
        });
        expect(input(mounted).value).toBe('Ch');
        expect(mounted.state()).toMatchObject({ value: [], inputValue: 'Ch' });

        const custom = await mount({
          template: fruit(),
          props: {
            items: FRUIT,
            allowsCustomValue: true,
            defaultValue: ['Mango'],
          },
        });
        expect(input(custom).value).toBe('Mango');
        expect(hiddenInput(custom).value).toBe('Mango');
      },
      PHASE,
    );

    scenario(
      'the hidden input is a hidden input holding the selected key',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['date'] },
        });
        const hidden = hiddenInput(mounted);
        expect(hidden.type).toBe('hidden');
        expect(hidden.name).toBe('fruit');
        expect(hidden.value).toBe('date');
        expect(hidden.disabled).toBe(false);
      },
      PHASE,
    );
  });

  group('typing and filtering', () => {
    scenario(
      'typing opens the list on the matching options, with nothing highlighted and the value kept',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        mounted.clearEvents();
        await typeText(keyboard, 'an');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual(['banana']);
        expect(option(mounted, 'apple').hidden).toBe(true);
        expect(highlighted(mounted)).toBe(null);
        expect(active(mounted)).toBe(input(mounted));
        expect(texts(mounted)).toEqual(['a', 'an']);
        expect(opens(mounted)).toEqual([true]);
        expect(changes(mounted)).toEqual([]);
        expectOnEveryPart(mounted, 'data-open', true);
        expect(mounted.state()).toMatchObject({
          value: [],
          inputValue: 'an',
          isOpen: true,
          focusedKey: null,
          isEmpty: false,
        });
      },
      PHASE,
    );

    scenario(
      'the filter ignores case, accents and surrounding spaces',
      async ({ mount, keyboard }) => {
        const items = [
          { key: 'acai', textValue: 'Açaí' },
          { key: 'creme', textValue: 'Crème brûlée' },
          { key: 'apple', textValue: 'Apple' },
        ];
        const mounted = await mount({
          template: fruit({ items }),
          props: { items },
        });
        input(mounted).focus();
        await typeText(keyboard, ' ACA');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual(['acai']);
        await retype(mounted, keyboard, 'brulee ');
        expect(shownKeys(mounted)).toEqual(['creme']);
      },
      PHASE,
    );

    scenario(
      'clearing the text shows every option again, and the list stays open',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        await expect.poll(() => shownKeys(mounted)).toEqual(['cherry']);
        await keyboard.press('Backspace');
        await keyboard.press('Backspace');
        expect(shownKeys(mounted)).toEqual([
          'apple',
          'banana',
          'cherry',
          'date',
        ]);
        expect(isOpen(mounted)).toBe(true);
        expect(opens(mounted)).toEqual([true]);
      },
      PHASE,
    );

    scenario(
      'a group with no matching option is hidden with its heading',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: GROUPED }),
          props: { items: GROUPED },
        });
        input(mounted).focus();
        await typeText(keyboard, 'car');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual(['carrot']);
        expect(item(mounted, 'group', 'fruit').hidden).toBe(true);
        expect(item(mounted, 'group', 'vegetables').hidden).toBe(false);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('carrot');
      },
      PHASE,
    );

    scenario(
      'with the empty part, text that matches nothing opens the list on it and marks every part',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'xy');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual([]);
        const empty = mounted.part('empty');
        expect(empty.hidden).toBe(false);
        expect(mounted.part('list').getAttribute('aria-describedby')).toBe(
          empty.id,
        );
        expectOnEveryPart(mounted, 'data-empty', true);
        expect(mounted.state().isEmpty).toBe(true);
        expect(opens(mounted)).toEqual([true]);

        await keyboard.press('Backspace');
        await keyboard.press('Backspace');
        expect(empty.hidden).toBe(true);
        expectOnEveryPart(mounted, 'data-empty', false);
      },
      PHASE,
    );

    scenario(
      'without the empty part, text that matches nothing closes the list once, until something matches',
      async ({ mount, keyboard }) => {
        const parts = PARTS.filter((part) => part !== 'empty');
        const mounted = await mount({
          template: fruit({ hasEmpty: false }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'a');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await typeText(keyboard, 'xy');
        await closed(mounted);
        expectOnEveryPart(mounted, 'data-empty', true, parts);
        await keyboard.press('Backspace');
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        await keyboard.press('Backspace');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(opens(mounted)).toEqual([true, false, true]);
      },
      PHASE,
    );

    scenario(
      'a custom filter decides the matches, and filter false shows every item',
      async ({ mount, keyboard }) => {
        const startsWith = (text: string, query: string) =>
          text.toLowerCase().startsWith(query.toLowerCase());
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, filter: startsWith },
        });
        input(mounted).focus();
        await typeText(keyboard, 'an');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual([]);
        await retype(mounted, keyboard, 'b');
        expect(shownKeys(mounted)).toEqual(['banana']);

        await mounted.setProps({ filter: false });
        await retype(mounted, keyboard, 'zz');
        expect(shownKeys(mounted)).toEqual([
          'apple',
          'banana',
          'cherry',
          'date',
        ]);
      },
      PHASE,
    );

    scenario(
      "popoverTrigger 'focus' opens the list on focus with every option; 'manual' leaves typing closed",
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, popoverTrigger: 'focus' },
          events: EVENTS,
        });
        await pointer.click(mounted.part('label'));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        expect(shownKeys(mounted)).toHaveLength(4);
        expect(highlighted(mounted)).toBe(null);

        const manual = await mount({
          template: fruit(),
          props: { items: FRUIT, popoverTrigger: 'manual' },
          events: EVENTS,
        });
        input(manual).focus();
        await typeText(keyboard, 'ba');
        await pause(100);
        expect(isOpen(manual)).toBe(false);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(manual)).toBe(true);
        expect(shownKeys(manual)).toEqual(['banana']);
        expect(highlighted(manual)).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'after choosing, the list opens on every option; after typing, on the matches, or every option when none match',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ hasEmpty: false }),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        await closed(mounted);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toHaveLength(4);
        expect(highlighted(mounted)).toBe('cherry');
        await keyboard.press('Escape');
        await closed(mounted);

        await retype(mounted, keyboard, 'a');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('Escape');
        await closed(mounted);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('Escape');
        await closed(mounted);

        await retype(mounted, keyboard, 'zz');
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(shownKeys(mounted)).toHaveLength(4);
        expect(input(mounted).value).toBe('zz');
      },
      PHASE,
    );
  });

  group('announcements', () => {
    scenario(
      'the option count is announced politely as the list opens and as typing changes it',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        const heard = await listen();
        await keyboard.press('ArrowDown');
        await expect.poll(heard).toEqual(['polite: 4 options available']);
        await keyboard.press('b');
        await expect
          .poll(heard)
          .toEqual([
            'polite: 4 options available',
            'polite: 1 option available',
          ]);
      },
      PHASE,
    );

    scenario(
      'optionCountAnnouncement translates the count',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: fruit(),
          props: {
            items: FRUIT,
            optionCountAnnouncement: (count) => `${count} fruits`,
          },
        });
        input(mounted).focus();
        const heard = await listen();
        await typeText(keyboard, 'e');
        await expect.poll(heard).toEqual(['polite: 3 fruits']);
      },
      PHASE,
    );
  });

  group('keys', () => {
    scenario(
      'ArrowDown opens on the first option and ArrowUp on the last; focus stays in the input',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        mounted.clearEvents();
        const keys = watchKeys(mounted);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe('apple');
        const apple = option(mounted, 'apple');
        expect(input(mounted).getAttribute('aria-activedescendant')).toBe(
          apple.id,
        );
        expect(apple.hasAttribute('data-focused')).toBe(true);
        expect(apple.hasAttribute('data-focus-visible')).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        await keyboard.press('Escape');
        await closed(mounted);
        await keyboard.press('ArrowUp');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe('date');
        keys.stop();
        expect(keys.prevented).toEqual([
          ['ArrowDown', true],
          ['Escape', true],
          ['ArrowUp', true],
        ]);
        expect(opens(mounted)).toEqual([true, false, true]);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'the arrows open on the selected option',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['banana'] },
        });
        await openWith(mounted, keyboard, 'ArrowUp');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('Escape');
        await closed(mounted);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'the arrows move the highlight past disabled options and stop at the ends',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['cherry'] },
          events: EVENTS,
        });
        await openWith(mounted, keyboard);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('banana');
        expect(changes(mounted)).toEqual([]);
        expect(input(mounted).value).toBe('');
      },
      PHASE,
    );

    scenario(
      'from no highlight, ArrowDown highlights the first match and ArrowUp the last, skipping filtered-out options',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await typeText(keyboard, 'e');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('cherry');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('b');
        expect(highlighted(mounted)).toBe(null);
      },
      PHASE,
    );

    scenario(
      'shouldFocusWrap wraps the arrows from the last option to the first',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, shouldFocusWrap: true },
        });
        await openWith(mounted, keyboard, 'ArrowUp');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('date');
      },
      PHASE,
    );

    scenario(
      'Alt+ArrowDown opens with nothing highlighted, and Alt+ArrowUp closes keeping the text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        mounted.clearEvents();
        const keys = watchKeys(mounted);
        await chord(keyboard, ['Alt'], 'ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowDown');
        await chord(keyboard, ['Alt'], 'ArrowUp');
        await closed(mounted);
        keys.stop();
        expect(
          keys.prevented.filter(([key]) => key.startsWith('Arrow')),
        ).toEqual([
          ['ArrowDown', true],
          ['ArrowDown', true],
          ['ArrowUp', true],
        ]);
        expect(changes(mounted)).toEqual([]);
        expect(opens(mounted)).toEqual([true, false]);
      },
      PHASE,
    );

    scenario(
      'Home, End, ArrowLeft and ArrowRight are left to the caret and clear the highlight',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const field = input(mounted);
        field.focus();
        await typeText(keyboard, 'ap');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        const keys = watchKeys(mounted);
        for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
          await keyboard.press('ArrowDown');
          expect(highlighted(mounted)).toBe('apple');
          await keyboard.press(key);
          expect(highlighted(mounted), key).toBe(null);
        }
        keys.stop();
        expect(keys.prevented.filter(([key]) => key !== 'ArrowDown')).toEqual([
          ['Home', false],
          ['End', false],
          ['ArrowLeft', false],
          ['ArrowRight', false],
        ]);
        expect(isOpen(mounted)).toBe(true);
      },
      PHASE,
    );

    scenario(
      'PageDown and PageUp move a highlight by a page of the list, and are left alone without one',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: MANY, listClass: 'sc-scroll' }),
          props: { items: MANY },
        });
        input(mounted).focus();
        const keys = watchKeys(mounted);
        await chord(keyboard, ['Alt'], 'ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('PageDown');
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowDown');
        await keyboard.press('PageDown');
        expect(highlighted(mounted)).toBe('item-4');
        await keyboard.press('PageUp');
        expect(highlighted(mounted)).toBe('item-0');
        keys.stop();
        expect(
          keys.prevented.filter(([key]) => key.startsWith('Page')),
        ).toEqual([
          ['PageDown', false],
          ['PageDown', true],
          ['PageUp', true],
        ]);
      },
      PHASE,
    );

    scenario(
      'Enter chooses the highlighted option: the value, its text, the list closed, focus kept',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await openWith(mounted, keyboard);
        mounted.clearEvents();
        await keyboard.press('ArrowDown');
        const keys = watchKeys(mounted);
        await keyboard.press('Enter');
        keys.stop();
        expect(keys.prevented).toEqual([['Enter', true]]);
        expect(changes(mounted)).toEqual([['banana']]);
        await closed(mounted);
        expect(input(mounted).value).toBe('Banana');
        expect(texts(mounted)).toEqual(['Banana']);
        expect(hiddenInput(mounted).value).toBe('banana');
        expect(option(mounted, 'banana').getAttribute('aria-selected')).toBe(
          'true',
        );
        expect(active(mounted)).toBe(input(mounted));
        expect(input(mounted).hasAttribute('aria-activedescendant')).toBe(
          false,
        );
        expect(opens(mounted)).toEqual([false]);
      },
      PHASE,
    );

    scenario(
      'choosing the selected option again closes the list with no change',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['cherry'] },
          events: EVENTS,
        });
        await openWith(mounted, keyboard);
        expect(highlighted(mounted)).toBe('cherry');
        await keyboard.press('Enter');
        await closed(mounted);
        expect(changes(mounted)).toEqual([]);
        expect(input(mounted).value).toBe('Cherry');
      },
      PHASE,
    );

    scenario(
      'Escape on the open list closes it and keeps the text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ba');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('ArrowDown');
        const keys = watchKeys(mounted);
        await keyboard.press('Escape');
        keys.stop();
        await closed(mounted);
        expect(keys.prevented).toEqual([['Escape', true]]);
        expect(input(mounted).value).toBe('ba');
        expect(mounted.state().value).toEqual([]);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'Escape on the closed input reverts typed text, and is left alone when there is none',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['apple'] },
          events: EVENTS,
        });
        await retype(mounted, keyboard, 'ba');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        const keys = watchKeys(mounted);
        await keyboard.press('Escape');
        await closed(mounted);
        expect(input(mounted).value).toBe('ba');
        await keyboard.press('Escape');
        expect(input(mounted).value).toBe('Apple');
        await keyboard.press('Escape');
        keys.stop();
        expect(keys.prevented).toEqual([
          ['Escape', true],
          ['Escape', true],
          ['Escape', false],
        ]);
        expect(texts(mounted).at(-1)).toBe('Apple');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'Tab closes the list without choosing the highlighted option; Shift+Tab too',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'a');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.tab();
        await closed(mounted);
        expect(active(mounted)).toBe(byId(mounted, 'after'));
        expect(changes(mounted)).toEqual([]);
        expect(input(mounted).value).toBe('');

        await openWith(mounted, keyboard);
        await keyboard.tab({ isBackward: true });
        await closed(mounted);
        expect(active(mounted)).toBe(byId(mounted, 'before'));
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'keys with Ctrl, and keys during IME composition, are left to the browser',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        const keys = watchKeys(mounted);
        await chord(keyboard, ['Control'], 'ArrowDown');
        keys.stop();
        expect(keys.prevented.at(-1)).toEqual(['ArrowDown', false]);
        expect(isOpen(mounted)).toBe(false);

        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        for (const key of ['ArrowDown', 'Enter']) {
          const composing = new KeyboardEvent('keydown', {
            key,
            isComposing: true,
            bubbles: true,
            cancelable: true,
          });
          input(mounted).dispatchEvent(composing);
          expect(composing.defaultPrevented, key).toBe(false);
        }
        expect(highlighted(mounted)).toBe('apple');
        expect(isOpen(mounted)).toBe(true);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('settling the text', () => {
    scenario(
      'Enter selects the option the text names, ignoring case, and the form still submits',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const submitted: unknown[] = [];
        form(mounted).addEventListener('submit', (event) => {
          event.preventDefault();
          submitted.push(new FormData(form(mounted)).get('fruit'));
        });
        input(mounted).focus();
        await typeText(keyboard, 'cherry');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('Enter');
        expect(changes(mounted)).toEqual([['cherry']]);
        expect(input(mounted).value).toBe('Cherry');
        await closed(mounted);
        await expect.poll(() => submitted).toEqual(['cherry']);
      },
      PHASE,
    );

    scenario(
      'Enter selects the only option the text matches',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'nan');
        await keyboard.press('Enter');
        expect(changes(mounted)).toEqual([['banana']]);
        expect(input(mounted).value).toBe('Banana');
      },
      PHASE,
    );

    scenario(
      'text that matches several options or none reverts; blank text clears the value',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['apple'] },
          events: EVENTS,
        });
        await retype(mounted, keyboard, 'a');
        await keyboard.press('Enter');
        expect(input(mounted).value).toBe('Apple');
        await retype(mounted, keyboard, 'zz');
        await keyboard.press('Enter');
        expect(input(mounted).value).toBe('Apple');
        expect(changes(mounted)).toEqual([]);

        await retype(mounted, keyboard, '');
        await keyboard.press('Enter');
        expect(changes(mounted)).toEqual([[]]);
        expect(input(mounted).value).toBe('');
        expect(hiddenInput(mounted).value).toBe('');
      },
      PHASE,
    );

    scenario(
      'disabled options never match the text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['date'] },
          events: EVENTS,
        });
        await retype(mounted, keyboard, 'date');
        await keyboard.press('Enter');
        expect(input(mounted).value).toBe('');
        await retype(mounted, keyboard, 'dat');
        await keyboard.press('Enter');
        expect(input(mounted).value).toBe('');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'allowsCustomValue: unmatched text becomes the value, trimmed; matching text still selects the option',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, allowsCustomValue: true },
          events: EVENTS,
        });
        await retype(mounted, keyboard, 'Mango ');
        await keyboard.press('Enter');
        expect(changes(mounted)).toEqual([['Mango']]);
        expect(input(mounted).value).toBe('Mango');
        expect(hiddenInput(mounted).value).toBe('Mango');

        await retype(mounted, keyboard, 'banana');
        await keyboard.press('Enter');
        expect(changes(mounted).at(-1)).toEqual(['banana']);
        expect(input(mounted).value).toBe('Banana');
      },
      PHASE,
    );

    scenario(
      'focus leaving settles the text before the press that moved it acts',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const seen: unknown[] = [];
        byId(mounted, 'other').addEventListener('click', () => {
          seen.push(mounted.state().value);
        });
        input(mounted).focus();
        await typeText(keyboard, 'che');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(byId(mounted, 'other'));
        await closed(mounted);
        expect(seen).toEqual([['cherry']]);
        expect(input(mounted).value).toBe('Cherry');
        expect(changes(mounted)).toEqual([['cherry']]);
      },
      PHASE,
    );

    scenario(
      'a controlled inputValue is the text, and typing reports the next text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, inputValue: 'Ch' },
          events: EVENTS,
        });
        expect(input(mounted).value).toBe('Ch');
        await mounted.setProps({ inputValue: 'Ba' });
        expect(input(mounted).value).toBe('Ba');
        const field = input(mounted);
        field.focus();
        field.setSelectionRange(2, 2);
        await keyboard.press('n');
        expect(texts(mounted)).toEqual(['Ban']);
        expect(field.value).toBe('Ban');
        await mounted.setProps({ inputValue: 'Ban' });
        expect(field.value).toBe('Ban');
        expect(shownKeys(mounted)).toEqual(['banana']);
      },
      PHASE,
    );
  });

  group('pointer and touch', () => {
    scenario(
      'a mouse press on the button opens the list on press start, highlighting the selected option, and focuses the input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['banana'] },
          events: EVENTS,
        });
        byId(mounted, 'before').focus();
        await pointer.down(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        expect(highlighted(mounted)).toBe('banana');
        expect(
          option(mounted, 'banana').hasAttribute('data-focus-visible'),
        ).toBe(false);
        await pointer.up();
        await pause(100);
        expect(isOpen(mounted)).toBe(true);
        expect(opens(mounted)).toEqual([true]);

        await pointer.click(button(mounted));
        await closed(mounted);
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        expect(opens(mounted)).toEqual([true, false]);
        expect(active(mounted)).toBe(input(mounted));
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'with nothing selected, the button opens the list with nothing highlighted',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe(null);
        expect(active(mounted)).toBe(input(mounted));
      },
      PHASE,
    );

    scenario(
      'a click on an option chooses it, closes the list and keeps focus in the input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(option(mounted, 'date'));
        await expect.poll(() => changes(mounted)).toEqual([['date']]);
        await closed(mounted);
        expect(input(mounted).value).toBe('Date');
        expect(active(mounted)).toBe(input(mounted));
        expect(details(mounted, 'focusChange')).toEqual([true]);
      },
      PHASE,
    );

    scenario(
      'a hovering mouse highlights options, never a disabled one',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['date'] },
        });
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.move(option(mounted, 'cherry'));
        const cherry = option(mounted, 'cherry');
        expect(highlighted(mounted)).toBe('cherry');
        expect(cherry.hasAttribute('data-hovered')).toBe(true);
        expect(cherry.hasAttribute('data-focused')).toBe(true);
        expect(cherry.hasAttribute('data-focus-visible')).toBe(false);
        await pointer.move(option(mounted, 'date'));
        expect(option(mounted, 'date').hasAttribute('data-hovered')).toBe(
          false,
        );
        expect(highlighted(mounted)).toBe('cherry');
      },
      PHASE,
    );

    scenario(
      'a press on a disabled option does nothing and the list stays open',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['date'] },
          events: EVENTS,
        });
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(option(mounted, 'date'));
        await pause(100);
        expect(isOpen(mounted)).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a press on the input while the list is open keeps it open',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ap');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(input(mounted));
        await pause(100);
        expect(isOpen(mounted)).toBe(true);
        expect(opens(mounted)).toEqual([true]);
        expect(input(mounted).value).toBe('ap');
      },
      PHASE,
    );

    scenario(
      'a press outside closes the list, settles the text, and acts on what it hit',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'nan');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(byId(mounted, 'after'));
        await closed(mounted);
        expect(active(mounted)).toBe(byId(mounted, 'after'));
        expect(changes(mounted)).toEqual([['banana']]);
        expect(input(mounted).value).toBe('Banana');
      },
      PHASE,
    );

    scenario(
      "a screen reader's click on the button opens the list on the first option, and on an option chooses it",
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        button(mounted).click();
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(highlighted(mounted)).toBe('apple');
        expect(active(mounted)).toBe(input(mounted));
        option(mounted, 'cherry').click();
        await expect.poll(() => changes(mounted)).toEqual([['cherry']]);
        await closed(mounted);
        expect(input(mounted).value).toBe('Cherry');
      },
      PHASE,
    );

    scenario(
      'touch: a finger down on the button opens nothing; the tap opens the list and focuses the input',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await touch.down(button(mounted));
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        await touch.up();
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        expect(highlighted(mounted)).toBe(null);
      },
      TOUCH,
    );

    scenario(
      'touch: a tap on an option chooses it and keeps focus in the input',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await touch.tap(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await touch.tap(option(mounted, 'banana'));
        await expect.poll(() => changes(mounted)).toEqual([['banana']]);
        await closed(mounted);
        await pause(100);
        expect(active(mounted)).toBe(input(mounted));
        expect(input(mounted).value).toBe('Banana');
      },
      TOUCH,
    );
  });

  group('the label', () => {
    scenario(
      'a press on the label focuses the input without opening the list',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await pointer.click(mounted.part('label'));
        await expect.poll(() => active(mounted)).toBe(input(mounted));
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        expect(opens(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('states', () => {
    scenario(
      'disabled: the input, the button and the hidden input are disabled, nothing opens, every part is marked',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, isDisabled: true, defaultValue: ['apple'] },
          events: EVENTS,
        });
        expect(input(mounted).disabled).toBe(true);
        expect(button(mounted).disabled).toBe(true);
        expect(hiddenInput(mounted).disabled).toBe(true);
        expect(new FormData(form(mounted)).has('fruit')).toBe(false);
        expectOnEveryPart(mounted, 'data-disabled', true);
        await pointer.click(button(mounted));
        button(mounted).click();
        byId(mounted, 'before').focus();
        await keyboard.tab();
        await pause(100);
        expect(isOpen(mounted)).toBe(false);
        expect(active(mounted)).not.toBe(input(mounted));
        expect(mounted.eventNames()).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'read-only: the list opens and the highlight moves, but nothing selects and the text stays',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isReadOnly: true, defaultValue: ['apple'] },
          events: EVENTS,
        });
        expect(input(mounted).readOnly).toBe(true);
        expect(mounted.part('list').getAttribute('aria-readonly')).toBe('true');
        expectOnEveryPart(mounted, 'data-readonly', true);
        input(mounted).focus();
        await keyboard.press('b');
        expect(input(mounted).value).toBe('Apple');
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('Enter');
        await pointer.click(option(mounted, 'cherry'));
        await pause(100);
        expect(isOpen(mounted)).toBe(true);
        expect(mounted.state().value).toEqual(['apple']);
        expect(changes(mounted)).toEqual([]);
        expect(texts(mounted)).toEqual([]);
        await keyboard.press('Escape');
        await closed(mounted);
      },
      PHASE,
    );

    scenario(
      'required and invalid: on the input, natively required, the error shown and linked',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isRequired: true },
        });
        const field = input(mounted);
        expect(field.getAttribute('aria-required')).toBe('true');
        expect(field.required).toBe(true);
        expectOnEveryPart(mounted, 'data-required', true);
        await mounted.setProps({ isInvalid: true });
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(field.getAttribute('aria-describedby')).toBe(
          mounted.part('error').id,
        );
        expect(mounted.part('error').hidden).toBe(false);
        expectOnEveryPart(mounted, 'data-invalid', true);
        expect(mounted.state().isErrorShown).toBe(true);
      },
      PHASE,
    );

    scenario(
      'with no items, the list opens on the empty part, which describes it',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: [] }),
          props: { items: [] },
        });
        await openWith(mounted, keyboard);
        const list = mounted.part('list');
        expect(mounted.part('empty').hidden).toBe(false);
        expect(list.getAttribute('aria-describedby')).toBe(
          mounted.part('empty').id,
        );
        expect(highlighted(mounted)).toBe(null);
        expect(mounted.state().isEmpty).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
      },
      PHASE,
    );
  });

  group('forms', () => {
    scenario(
      'the hidden input submits the selected key or a custom value; the input submits nothing',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, allowsCustomValue: true },
        });
        const entries = () => Array.from(new FormData(form(mounted)).entries());
        expect(entries()).toEqual([['fruit', '']]);
        await mounted.setProps({ value: ['cherry'] });
        expect(entries()).toEqual([['fruit', 'cherry']]);
        await mounted.setProps({ value: ['Mango'] });
        expect(entries()).toEqual([['fruit', 'Mango']]);
      },
      PHASE,
    );

    scenario(
      'a form reset restores the default value and its text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, defaultValue: ['banana'] },
        });
        await retype(mounted, keyboard, 'che');
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        expect(mounted.state().value).toEqual(['cherry']);
        form(mounted).reset();
        await expect.poll(() => mounted.state().value).toEqual(['banana']);
        await expect.poll(() => input(mounted).value).toBe('Banana');
        await expect.poll(() => hiddenInput(mounted).value).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'a required combo box with no value blocks the submit and takes focus',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, isRequired: true },
        });
        let submits = 0;
        form(mounted).addEventListener('submit', (event) => {
          submits++;
          event.preventDefault();
        });
        byId(mounted, 'before').focus();
        form(mounted).requestSubmit();
        await expect.poll(() => active(mounted)).toBe(input(mounted));
        expect(submits).toBe(0);
        // Firefox's validation bubble closes as focus leaves, so it doesn't
        // cover the next scenario.
        byId(mounted, 'before').focus();
        await mounted.setProps({ value: ['apple'] });
        await expect.poll(() => input(mounted).value).toBe('Apple');
        form(mounted).requestSubmit();
        expect(submits).toBe(1);
      },
      PHASE,
    );
  });

  group('focus', () => {
    scenario(
      'focus within is reported once for the input, the button and the popup together',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        expectOnEveryPart(mounted, 'data-focus-within', true);
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.click(option(mounted, 'banana'));
        await closed(mounted);
        expect(active(mounted)).toBe(input(mounted));
        byId(mounted, 'after').focus();
        expect(details(mounted, 'focusChange')).toEqual([true, false]);
        expectOnEveryPart(mounted, 'data-focus-within', false);
      },
      PHASE,
    );

    scenario(
      'keyboard focus shows focus-visible on every part, and on the option the keys highlight',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(active(mounted)).toBe(input(mounted));
        expectOnEveryPart(mounted, 'data-focus-visible', true);
        await keyboard.press('ArrowDown');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(
          option(mounted, 'apple').hasAttribute('data-focus-visible'),
        ).toBe(true);
        expect(mounted.state()).toMatchObject({
          isFocusWithin: true,
          isFocusVisible: true,
          focusedKey: 'apple',
        });
      },
      PHASE,
    );

    scenario(
      'the keys scroll the highlighted option into view',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: MANY, listClass: 'sc-scroll' }),
          props: { items: MANY },
        });
        await openWith(mounted, keyboard, 'ArrowUp');
        expect(highlighted(mounted)).toBe('item-19');
        const list = mounted.part('list').getBoundingClientRect();
        const box = option(mounted, 'item-19').getBoundingClientRect();
        expect(box.top).toBeGreaterThanOrEqual(list.top - 1);
        expect(box.bottom).toBeLessThanOrEqual(list.bottom + 1);
      },
      PHASE,
    );
  });

  group('state', () => {
    scenario(
      'public state follows the text, the highlight, the popup and the value',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        expect(mounted.state()).toEqual({
          value: [],
          inputValue: '',
          isOpen: false,
          focusedKey: null,
          isEmpty: false,
          isDisabled: false,
          isReadOnly: false,
          isRequired: false,
          isInvalid: false,
          isErrorShown: false,
          isFocusWithin: false,
          isFocusVisible: false,
        });
        input(mounted).focus();
        await typeText(keyboard, 'b');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        expect(mounted.state()).toMatchObject({
          inputValue: 'b',
          isOpen: true,
          focusedKey: null,
          isFocusWithin: true,
        });
        await keyboard.press('ArrowDown');
        expect(mounted.state().focusedKey).toBe('banana');
        await keyboard.press('Enter');
        await closed(mounted);
        expect(mounted.state()).toMatchObject({
          value: ['banana'],
          inputValue: 'Banana',
          isOpen: false,
          focusedKey: null,
        });
      },
      PHASE,
    );

    scenario(
      'a controlled combo box that refuses to close stays open',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isOpen: true },
          events: EVENTS,
        });
        await expect.poll(() => isOpen(mounted)).toBe(true);
        input(mounted).focus();
        await keyboard.press('Escape');
        expect(opens(mounted)).toEqual([false]);
        expect(isOpen(mounted)).toBe(true);
        await mounted.setProps({ isOpen: false });
        await closed(mounted);
      },
      PHASE,
    );

    scenario(
      'typing, opening, highlighting and uncontrolled selection never re-render the owner',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const renders = mounted.renderCount();
        input(mounted).focus();
        await typeText(keyboard, 'b');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        await closed(mounted);
        await pointer.click(button(mounted));
        await expect.poll(() => isOpen(mounted)).toBe(true);
        await pointer.move(option(mounted, 'date'));
        await pointer.click(option(mounted, 'date'));
        await closed(mounted);
        expect(changes(mounted)).toEqual([['banana'], ['date']]);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the closed input as a combobox named by the label, with its text',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['apple'] },
        });
        const phrases = await spoken();
        expect(phrases).toContain(
          'combobox, Fruit, Apple, has popup listbox, not expanded, autocomplete in list, 1 control',
        );
        expect(phrases).not.toContain('listbox, Fruit, orientated vertically');
        await mounted.setProps({ value: [] });
        expect(await spoken()).toContain(
          'combobox, Fruit, has popup listbox, not expanded, autocomplete in list, 1 control',
        );
      },
      PHASE,
    );

    scenario(
      'reads the description, the error, invalid and required',
      async ({ mount, spoken }) => {
        await mount({
          template: fruit({ hasDescription: true }),
          props: { items: FRUIT, isInvalid: true, isRequired: true },
        });
        expect(await spoken()).toContain(
          'combobox, Fruit, Pick some Pick one, has popup listbox, not expanded, autocomplete in list, 1 control, invalid, required',
        );
      },
      PHASE,
    );

    scenario(
      'reads a read-only and a disabled combo box',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isReadOnly: true },
        });
        expect(await spoken()).toContain(
          'combobox, Fruit, has popup listbox, not expanded, autocomplete in list, 1 control, read only',
        );
        await mounted.setProps({ isReadOnly: false, isDisabled: true });
        expect(await spoken()).toContain(
          'combobox, Fruit, has popup listbox, not expanded, autocomplete in list, 1 control, disabled',
        );
      },
      PHASE,
    );

    scenario(
      'reads the button by its own label and the field',
      async ({ mount, spoken }) => {
        await mount({ template: fruit(), props: { items: FRUIT } });
        expect(await spoken()).toContain(
          'button, Show suggestions Fruit, 1 control, not expanded, has popup listbox',
        );
      },
      PHASE,
    );

    scenario(
      'reads the open list and the active descendant, and not the filtered-out options',
      async ({ mount, keyboard, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await typeText(keyboard, 'a');
        await expect.poll(() => isOpen(mounted)).toBe(true);
        let phrases = await spoken();
        expect(phrases).toContain(
          'combobox, Fruit, a, has popup listbox, expanded, autocomplete in list, 1 control',
        );
        expect(phrases).toContain('listbox, Fruit, orientated vertically');
        expect(
          phrases.filter((phrase) => phrase.startsWith('option, ')),
        ).toHaveLength(3);
        expect(
          phrases.some((phrase) => phrase.startsWith('option, Cherry')),
        ).toBe(false);

        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        phrases = await spoken();
        expect(phrases).toContain(
          'combobox, Fruit, a, has popup listbox, expanded, active descendant Banana, autocomplete in list, 1 control',
        );
      },
      PHASE,
    );
  });
});
