/**
 * Autocomplete conformance, from the composition spec approved by @tenphi on
 * 2026-10-24 (`packages/core/src/components/composition.md`), in inline
 * mode: a `role="combobox"` input with list autocomplete, always expanded,
 * named by its label and controlling Listbox's list, which is out of the tab
 * order; typing filters the options, with groups, a custom filter that gets
 * the item, the empty part and the option count announced; the filter, on
 * from the start and stopped only by `showAll()`; the highlight in
 * `aria-activedescendant`, moved by the keys and by hover while focus is in,
 * and by typing with `shouldHighlightFirstMatch`; choosing, which reports
 * `action` and leaves the text; Escape clearing the text; presses in the
 * list keeping or bringing focus to the input, and touch; the states; the
 * text in forms and on reset; focus within; public state, render counts,
 * spoken output and the virtualized list. Phase 6.
 *
 * Popup mode is for definitions that compose Autocomplete, and Combobox's
 * suite covers it. Every scenario passes `items`; reading them from markup
 * is the element's own test.
 */

import {
  VIRTUALIZER,
  defineConformance,
  h,
  partSelector,
  rows,
} from '@uniaria/testing';
import type {
  KeyboardInput,
  Mounted,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type {
  AutocompleteItem,
  AutocompleteProps,
  AutocompleteState,
} from './types';

type MountedAutocomplete = Mounted<AutocompleteProps, AutocompleteState>;

const PHASE = { phase: 6 } as const;
const TOUCH = { phase: 6, needs: ['touch'] } as const;

/** The named parts every template renders and the state attributes reach. */
const PARTS = ['root', 'label', 'input', 'list', 'empty', 'error'];

const EVENTS = ['valueChange', 'action', 'inputChange', 'focusChange'];

const FRUIT: readonly AutocompleteItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  { key: 'date', textValue: 'Date' },
];

const GROUPED: readonly AutocompleteItem[] = [
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

/** Twenty options, of which four fit a scrolling list at once. */
const MANY: readonly AutocompleteItem[] = Array.from(
  { length: 20 },
  (_, index) => ({ key: `item-${index}`, textValue: `Item ${index}` }),
);

/**
 * Fixed places: the autocomplete at (150, 30), 160px wide, with its label
 * above the 30px input and the list under it, its options and group
 * headings 24px tall; `#before` above-left and `#after` and `#other` below,
 * so nothing a scenario presses is covered. A filtered-out option stays out
 * of the layout.
 */
const LAYOUT = h(
  'style',
  null,
  `.ac-before { position: fixed; left: 0; top: 0; width: 100px }
   .ac-root { position: fixed; left: 150px; top: 30px; width: 160px; margin: 0 }
   .ac-label { display: block; height: 20px }
   .ac-input { display: block; width: 160px; height: 30px; margin: 0; padding: 0 4px; box-sizing: border-box }
   .ac-root p { margin: 0 }
   .ac-list { margin: 0; padding: 0; list-style: none }
   .ac-scroll { max-height: 96px; overflow: auto }
   .ac-option, .ac-heading { display: block; height: 24px; margin: 0; padding: 0 }
   .ac-root [hidden] { display: none }
   .ac-after { position: fixed; left: 0; top: 400px; width: 100px }
   .ac-other { position: fixed; left: 0; top: 440px }`,
);

interface FruitOptions {
  readonly items?: readonly AutocompleteItem[];
  readonly hasDescription?: boolean;
  /** Render the empty part. */
  readonly hasEmpty?: boolean;
  /** Put a button, `#add`, in the empty part. */
  readonly hasEmptyButton?: boolean;
  /** Wrap the list in the scroller part, which scrolls. */
  readonly hasScroller?: boolean;
  /** Extra classes on the list. */
  readonly listClass?: string;
  /** Wrap the autocomplete in `<form id="form">`. */
  readonly inForm?: boolean;
  /** Render the root around the parts; it is optional. */
  readonly hasRoot?: boolean;
}

/**
 * An autocomplete "Fruit": the label, the input (named `q`), the
 * description, the error, the list and the empty part; `#before` before it,
 * `#after` and `#other` after it.
 */
function fruit({
  items = FRUIT,
  hasDescription = false,
  hasEmpty = true,
  hasEmptyButton = false,
  hasScroller = false,
  listClass = '',
  inForm = false,
  hasRoot = true,
}: FruitOptions = {}): TemplateNode[] {
  const isGrouped = items.some((item) => item.items);
  const tag = isGrouped ? 'div' : 'li';
  const render = (item: AutocompleteItem): TemplateElement =>
    item.items
      ? h(
          'div',
          { part: 'group', 'data-key': item.key },
          h(
            'span',
            { part: 'groupLabel', 'data-key': item.key, class: 'ac-heading' },
            item.textValue!,
          ),
          ...item.items.map(render),
        )
      : h(
          tag,
          { part: 'option', 'data-key': item.key, class: 'ac-option' },
          item.textValue ?? item.key,
        );
  const list = h(
    isGrouped ? 'div' : 'ul',
    { part: 'list', class: `ac-list ${listClass}`.trim() },
    ...items.map(render),
  );
  const empty = h(
    'p',
    { part: 'empty' },
    'No fruit',
    ...(hasEmptyButton
      ? [h('button', { id: 'add', type: 'button' }, 'Add')]
      : []),
  );
  const parts = [
    h('label', { part: 'label', class: 'ac-label' }, 'Fruit'),
    h('input', { part: 'input', class: 'ac-input', name: 'q' }),
    ...(hasDescription ? [h('p', { part: 'description' }, 'Pick some')] : []),
    h('p', { part: 'error' }, 'Pick one'),
    hasScroller
      ? h('div', { part: 'scroller', class: 'ac-scroll' }, list)
      : list,
    ...(hasEmpty ? [empty] : []),
  ];
  const search = hasRoot
    ? [h('div', { part: 'root', class: 'ac-root' }, ...parts)]
    : parts;
  return [
    LAYOUT,
    h('input', { id: 'before', class: 'ac-before', 'aria-label': 'Before' }),
    ...(inForm ? [h('form', { id: 'form' }, ...search)] : search),
    h('input', { id: 'after', class: 'ac-after', 'aria-label': 'After' }),
    h('button', { id: 'other', class: 'ac-other' }, 'Other'),
  ];
}

/** A thousand options, `item-0` to `item-999`, for virtualized lists. */
const THOUSAND: readonly AutocompleteItem[] = Array.from(
  { length: 1000 },
  (_, index) => ({ key: `item-${index}`, textValue: `Item ${index}` }),
);

/** The props of a virtualized autocomplete (Listbox virtualization spec). */
const VIRTUAL = {
  items: THOUSAND,
  virtualizer: VIRTUALIZER,
  itemSize: 20,
} as const;

/**
 * The autocomplete "Fruit" with a virtualized list: a scroller 100px tall
 * around the list, and 20px rows rendered from `renderedKeys`, as the
 * virtualization spec's consumer writes them.
 */
function virtualFruit(): TemplateNode[] {
  const text = new Map(THOUSAND.map((item) => [item.key, item.textValue!]));
  return [
    LAYOUT,
    h(
      'style',
      null,
      '.vs-scroller { height: 100px; overflow: auto }' +
        ' .vs-row { height: 20px; inset-inline-end: 0; margin: 0; padding: 0; font: 12px/20px sans-serif; overflow: hidden }',
    ),
    h('input', { id: 'before', class: 'ac-before', 'aria-label': 'Before' }),
    h(
      'div',
      { part: 'root', class: 'ac-root' },
      h('label', { part: 'label', class: 'ac-label' }, 'Fruit'),
      h('input', { part: 'input', class: 'ac-input' }),
      h(
        'div',
        { part: 'scroller', class: 'vs-scroller' },
        h(
          'div',
          { part: 'list', class: 'ac-list' },
          rows(({ keys }) =>
            keys.map((key) =>
              h(
                'div',
                { part: 'option', 'data-key': key, class: 'vs-row' },
                text.get(key)!,
              ),
            ),
          ),
        ),
      ),
      h('p', { part: 'empty' }, 'No fruit'),
    ),
    h('input', { id: 'after', class: 'ac-after', 'aria-label': 'After' }),
  ];
}

/** Whether an element lies wholly inside the scroller's view. */
function isInView(mounted: MountedAutocomplete, element: Element): boolean {
  const view = mounted.part('scroller').getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5;
}

/** Every rendered option's key, in document order. */
function renderedKeys(mounted: MountedAutocomplete): string[] {
  return mounted.parts('option').map((element) => element.dataset.key!);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function byId(mounted: MountedAutocomplete, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function input(mounted: MountedAutocomplete): HTMLInputElement {
  return mounted.part('input') as HTMLInputElement;
}

function form(mounted: MountedAutocomplete): HTMLFormElement {
  return byId(mounted, 'form') as HTMLFormElement;
}

/** The item part of `part` for a key. */
function item(mounted: MountedAutocomplete, part: string, key: string) {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('autocomplete', part)}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} "${key}".`);
  return element;
}

const option = (mounted: MountedAutocomplete, key: string) =>
  item(mounted, 'option', key);

/** The keys of the options the filter leaves, in document order. */
function shownKeys(mounted: MountedAutocomplete): string[] {
  return mounted
    .parts('option')
    .filter((element) => !element.hidden)
    .map((element) => element.dataset.key!);
}

const ALL = ['apple', 'banana', 'cherry', 'date'];

/** The option `aria-activedescendant` points at, or `null`. */
function highlighted(mounted: MountedAutocomplete): string | null {
  const id = input(mounted).getAttribute('aria-activedescendant');
  if (!id) return null;
  const element = mounted.container.ownerDocument.getElementById(id);
  return element?.dataset.key ?? null;
}

function active(mounted: MountedAutocomplete): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

function details(mounted: MountedAutocomplete, name: string): unknown[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail);
}

const changes = (mounted: MountedAutocomplete) =>
  details(mounted, 'valueChange');
const actions = (mounted: MountedAutocomplete) => details(mounted, 'action');
const texts = (mounted: MountedAutocomplete) => details(mounted, 'inputChange');
const focusChanges = (mounted: MountedAutocomplete) =>
  details(mounted, 'focusChange');

/** A state attribute is on every named part, or on none. */
function expectOnEveryPart(
  mounted: MountedAutocomplete,
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
  mounted: MountedAutocomplete,
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
 * Records, for every event of `type` until `stop()`, its `key` (for keys)
 * and whether it was prevented once the page had seen it, in order. It
 * listens on the window, after every listener in the document.
 */
function watch(
  mounted: MountedAutocomplete,
  type: 'keydown' | 'mousedown',
): { readonly prevented: [string, boolean][]; stop(): void } {
  const prevented: [string, boolean][] = [];
  const view = mounted.container.ownerDocument.defaultView!;
  const onEvent = (event: Event) => {
    prevented.push([
      event instanceof KeyboardEvent ? event.key : type,
      event.defaultPrevented,
    ]);
  };
  view.addEventListener(type, onEvent);
  return {
    prevented,
    stop: () => view.removeEventListener(type, onEvent),
  };
}

const watchKeys = (mounted: MountedAutocomplete) => watch(mounted, 'keydown');
const watchPresses = (mounted: MountedAutocomplete) =>
  watch(mounted, 'mousedown');

/** Sets the input's text as a paste does, with its `input` event. */
function paste(mounted: MountedAutocomplete, text: string): void {
  const field = input(mounted);
  field.value = text;
  field.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      inputType: 'insertFromPaste',
      data: text,
    }),
  );
}

export const autocompleteConformance = defineConformance<
  AutocompleteProps,
  AutocompleteState
>('autocomplete', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'the input is a combobox with list autocomplete, always expanded, named by the label, controlling the list',
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
        expect(field.getAttribute('aria-expanded')).toBe('true');
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
        expect(list.getAttribute('aria-orientation')).toBe('vertical');
        expect(list.getAttribute('tabindex')).toBe('-1');
        expect(list.hasAttribute('aria-multiselectable')).toBe(false);
        for (const each of mounted.parts('option')) {
          expect(each.getAttribute('role')).toBe('option');
          expect(each.getAttribute('aria-selected')).toBe('false');
          expect(each.hasAttribute('tabindex')).toBe(false);
          expect(each.hidden).toBe(false);
        }
        expect(mounted.part('error').hidden).toBe(true);
        expect(mounted.part('empty').hidden).toBe(true);
        expectOnEveryPart(mounted, 'data-open', true);
        for (const name of [
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
      'the list and its scroller are out of the tab order, so Tab passes them by',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: MANY, hasScroller: true }),
          props: { items: MANY },
        });
        const scroller = mounted.part('scroller');
        expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
        expect(scroller.getAttribute('tabindex')).toBe('-1');
        expect(mounted.part('list').getAttribute('tabindex')).toBe('-1');
        input(mounted).focus();
        await keyboard.tab();
        expect(active(mounted)).toBe(byId(mounted, 'after'));
        await keyboard.tab({ isBackward: true });
        expect(active(mounted)).toBe(input(mounted));
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
      'the selection marks the options and leaves the text alone',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['banana'] },
          events: EVENTS,
        });
        expect(option(mounted, 'banana').getAttribute('aria-selected')).toBe(
          'true',
        );
        expect(input(mounted).value).toBe('');

        await mounted.setProps({ value: ['cherry'] });
        expect(option(mounted, 'cherry').getAttribute('aria-selected')).toBe(
          'true',
        );
        expect(option(mounted, 'banana').getAttribute('aria-selected')).toBe(
          'false',
        );
        expect(input(mounted).value).toBe('');
        expect(mounted.state()).toMatchObject({
          value: ['cherry'],
          inputValue: '',
        });
        expect(changes(mounted)).toEqual([]);
        expect(texts(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'defaultInputValue seeds the text, which filters the list from the start',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultInputValue: 'a' },
          events: EVENTS,
        });
        const field = input(mounted);
        expect(field.value).toBe('a');
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(mounted.state().inputValue).toBe('a');

        field.focus();
        field.setSelectionRange(1, 1);
        await keyboard.press('n');
        expect(field.value).toBe('an');
        expect(texts(mounted)).toEqual(['an']);
        expect(shownKeys(mounted)).toEqual(['banana']);
      },
      PHASE,
    );

    scenario(
      'a controlled inputValue is the text, which filters; typing reports the next text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, inputValue: 'a' },
          events: EVENTS,
        });
        const field = input(mounted);
        expect(field.value).toBe('a');
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);

        field.focus();
        field.setSelectionRange(1, 1);
        await keyboard.press('z');
        expect(texts(mounted)).toEqual(['az']);
        expect(field.value).toBe('az');
        expect(mounted.state().inputValue).toBe('az');
        expect(shownKeys(mounted)).toEqual([]);

        await mounted.setProps({ inputValue: 'ch' });
        expect(field.value).toBe('ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        await mounted.setProps({ inputValue: 'zz' });
        expect(field.value).toBe('zz');
        expect(shownKeys(mounted)).toEqual([]);
        expect(mounted.state().isEmpty).toBe(true);
        expect(texts(mounted)).toEqual(['az']);
      },
      PHASE,
    );
  });

  group('typing and filtering', () => {
    scenario(
      'typing filters the options, with nothing highlighted and the value kept',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        mounted.clearEvents();
        await typeText(keyboard, 'an');
        expect(shownKeys(mounted)).toEqual(['banana']);
        expect(option(mounted, 'apple').hidden).toBe(true);
        expect(highlighted(mounted)).toBe(null);
        expect(active(mounted)).toBe(input(mounted));
        expect(texts(mounted)).toEqual(['a', 'an']);
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
        expect(input(mounted).getAttribute('aria-expanded')).toBe('true');
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
        expect(shownKeys(mounted)).toEqual(['acai']);
        await retype(mounted, keyboard, 'brulee ');
        expect(shownKeys(mounted)).toEqual(['creme']);
      },
      PHASE,
    );

    scenario(
      'clearing the text shows every option again',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        await keyboard.press('Backspace');
        await keyboard.press('Backspace');
        expect(shownKeys(mounted)).toEqual(ALL);
        expect(texts(mounted)).toEqual(['c', 'ch', 'c', '']);
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
        expect(shownKeys(mounted)).toEqual(['carrot']);
        expect(item(mounted, 'group', 'fruit').hidden).toBe(true);
        expect(item(mounted, 'group', 'vegetables').hidden).toBe(false);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('carrot');
      },
      PHASE,
    );

    scenario(
      'text that matches nothing shows the empty part, which describes the list, and marks every part',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await typeText(keyboard, 'xy');
        expect(shownKeys(mounted)).toEqual([]);
        const empty = mounted.part('empty');
        expect(empty.hidden).toBe(false);
        expect(mounted.part('list').getAttribute('aria-describedby')).toBe(
          empty.id,
        );
        expectOnEveryPart(mounted, 'data-empty', true);
        expectOnEveryPart(mounted, 'data-open', true);
        expect(mounted.state()).toMatchObject({ isEmpty: true, isOpen: true });

        await keyboard.press('Backspace');
        await keyboard.press('Backspace');
        expect(empty.hidden).toBe(true);
        expect(mounted.part('list').hasAttribute('aria-describedby')).toBe(
          false,
        );
        expectOnEveryPart(mounted, 'data-empty', false);
      },
      PHASE,
    );

    scenario(
      'without the empty part, text that matches nothing leaves the list shown and expanded',
      async ({ mount, keyboard }) => {
        const parts = PARTS.filter((part) => part !== 'empty');
        const mounted = await mount({
          template: fruit({ hasEmpty: false }),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await typeText(keyboard, 'xy');
        expect(shownKeys(mounted)).toEqual([]);
        expect(input(mounted).getAttribute('aria-expanded')).toBe('true');
        expect(mounted.part('list').hidden).toBe(false);
        expectOnEveryPart(mounted, 'data-empty', true, parts);
        expectOnEveryPart(mounted, 'data-open', true, parts);
      },
      PHASE,
    );

    scenario(
      'a custom filter gets the text, the typed text and the item; filter false shows every item',
      async ({ mount, keyboard }) => {
        const seen: unknown[] = [];
        const byKey = (
          textValue: string,
          inputValue: string,
          each: AutocompleteItem,
        ) => {
          seen.push([textValue, inputValue, each]);
          return each.key.startsWith(inputValue);
        };
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, filter: byKey },
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        expect(seen).toContainEqual(['Cherry', 'ch', FRUIT[2]]);
        await retype(mounted, keyboard, 'Ch');
        expect(shownKeys(mounted)).toEqual([]);

        await mounted.setProps({ filter: false });
        await retype(mounted, keyboard, 'zz');
        expect(shownKeys(mounted)).toEqual(ALL);
      },
      PHASE,
    );

    scenario(
      'a value set from outside keeps the filter; showAll() stops it, keeping the text, until the user types',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        await mounted.setProps({ value: ['apple'] });
        expect(shownKeys(mounted)).toEqual(['cherry']);

        await mounted.call('showAll');
        expect(shownKeys(mounted)).toEqual(ALL);
        expect(input(mounted).value).toBe('ch');
        expect(mounted.state()).toMatchObject({
          inputValue: 'ch',
          isEmpty: false,
        });
        expect(active(mounted)).toBe(input(mounted));

        await keyboard.press('e');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        expect(texts(mounted)).toEqual(['c', 'ch', 'che']);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('the highlight while typing', () => {
    scenario(
      'by default, typing clears the highlight, and ArrowDown highlights the first match',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await keyboard.press('a');
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('p');
        expect(highlighted(mounted)).toBe(null);
        expect(mounted.state().focusedKey).toBe(null);
        expect(option(mounted, 'apple').hasAttribute('data-focused')).toBe(
          false,
        );
      },
      PHASE,
    );

    scenario(
      'shouldHighlightFirstMatch: typing highlights the first match at once, and names it the active descendant after a pause',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, shouldHighlightFirstMatch: true },
        });
        const field = input(mounted);
        field.focus();
        await typeText(keyboard, 'an');
        const banana = option(mounted, 'banana');
        expect(mounted.state().focusedKey).toBe('banana');
        expect(banana.hasAttribute('data-focused')).toBe(true);
        expect(banana.hasAttribute('data-focus-visible')).toBe(false);
        expect(field.hasAttribute('aria-activedescendant')).toBe(false);
        await expect.poll(() => highlighted(mounted)).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'shouldHighlightFirstMatch: Enter chooses the first match at once',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, shouldHighlightFirstMatch: true },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        await keyboard.press('Enter');
        expect(changes(mounted)).toEqual([['cherry']]);
        expect(actions(mounted)).toEqual(['cherry']);
        expect(input(mounted).value).toBe('ch');
      },
      PHASE,
    );

    scenario(
      'shouldHighlightFirstMatch: a selected match comes first, and a disabled one never',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: {
            items: FRUIT,
            shouldHighlightFirstMatch: true,
            defaultValue: ['date'],
            disabledKeys: ['apple'],
          },
        });
        input(mounted).focus();
        await keyboard.press('a');
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(mounted.state().focusedKey).toBe('date');

        await mounted.setProps({ value: [] });
        await retype(mounted, keyboard, 'a');
        expect(mounted.state().focusedKey).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'shouldHighlightFirstMatch: deleting and pasting clear the highlight; the arrows name the active descendant at once',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, shouldHighlightFirstMatch: true },
        });
        input(mounted).focus();
        await keyboard.press('a');
        expect(mounted.state().focusedKey).toBe('apple');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        expect(
          option(mounted, 'banana').hasAttribute('data-focus-visible'),
        ).toBe(true);

        await keyboard.press('Backspace');
        expect(mounted.state().focusedKey).toBe(null);
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('d');
        expect(mounted.state().focusedKey).toBe('date');

        paste(mounted, 'ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        expect(mounted.state().focusedKey).toBe(null);
        await pause(700);
        expect(highlighted(mounted)).toBe(null);
      },
      PHASE,
    );
  });

  group('choosing', () => {
    scenario(
      'Enter chooses the highlighted option and reports action; the text, the filter and the highlight stay',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        mounted.clearEvents();
        await keyboard.press('a');
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        const keys = watchKeys(mounted);
        await keyboard.press('Enter');
        keys.stop();
        expect(keys.prevented).toEqual([['Enter', true]]);
        expect(changes(mounted)).toEqual([['banana']]);
        expect(actions(mounted)).toEqual(['banana']);
        expect(texts(mounted)).toEqual(['a']);
        expect(input(mounted).value).toBe('a');
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(highlighted(mounted)).toBe('banana');
        expect(option(mounted, 'banana').getAttribute('aria-selected')).toBe(
          'true',
        );
        expect(active(mounted)).toBe(input(mounted));
        expect(input(mounted).getAttribute('aria-expanded')).toBe('true');
      },
      PHASE,
    );

    scenario(
      'Enter with nothing highlighted is left alone, so the form submits',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const submitted: unknown[] = [];
        form(mounted).addEventListener('submit', (event) => {
          event.preventDefault();
          submitted.push(new FormData(form(mounted)).get('q'));
        });
        input(mounted).focus();
        await typeText(keyboard, 'ba');
        const keys = watchKeys(mounted);
        await keyboard.press('Enter');
        keys.stop();
        expect(keys.prevented).toEqual([['Enter', false]]);
        await expect.poll(() => submitted).toEqual(['ba']);
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a click on an option chooses it, keeps the text and brings focus to the input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        byId(mounted, 'before').focus();
        await pointer.click(option(mounted, 'date'));
        await expect.poll(() => changes(mounted)).toEqual([['date']]);
        expect(actions(mounted)).toEqual(['date']);
        expect(active(mounted)).toBe(input(mounted));
        expect(focusChanges(mounted)).toEqual([true]);
        expect(input(mounted).value).toBe('');
        expect(texts(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'choosing the selected option again reports action with no change',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['cherry'] },
          events: EVENTS,
        });
        input(mounted).focus();
        await pointer.click(option(mounted, 'cherry'));
        await expect.poll(() => actions(mounted)).toEqual(['cherry']);
        expect(changes(mounted)).toEqual([]);
        expect(mounted.state().value).toEqual(['cherry']);
      },
      PHASE,
    );

    scenario(
      'multiple mode: Enter and a press toggle options, and Space types',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, selectionMode: 'multiple' },
          events: EVENTS,
        });
        expect(mounted.part('list').getAttribute('aria-multiselectable')).toBe(
          'true',
        );
        input(mounted).focus();
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        await keyboard.press('Enter');
        await pointer.click(option(mounted, 'date'));
        await expect.poll(() => changes(mounted)).toHaveLength(4);
        expect(changes(mounted)).toEqual([
          ['apple'],
          ['apple', 'banana'],
          ['apple'],
          ['apple', 'date'],
        ]);
        expect(actions(mounted)).toEqual(['apple', 'banana', 'banana', 'date']);

        const keys = watchKeys(mounted);
        await keyboard.press('Space');
        keys.stop();
        expect(keys.prevented).toEqual([[' ', false]]);
        expect(input(mounted).value).toBe(' ');
        expect(texts(mounted)).toEqual([' ']);
        expect(changes(mounted)).toHaveLength(4);
      },
      PHASE,
    );
  });

  group('keys', () => {
    scenario(
      'ArrowDown highlights the first option and ArrowUp the last; focus stays in the input',
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
        expect(highlighted(mounted)).toBe('apple');
        const apple = option(mounted, 'apple');
        expect(input(mounted).getAttribute('aria-activedescendant')).toBe(
          apple.id,
        );
        expect(apple.hasAttribute('data-focused')).toBe(true);
        expect(apple.hasAttribute('data-focus-visible')).toBe(true);
        expect(active(mounted)).toBe(input(mounted));
        await keyboard.press('Home');
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('date');
        keys.stop();
        expect(keys.prevented).toEqual([
          ['ArrowDown', true],
          ['Home', false],
          ['ArrowUp', true],
        ]);
        expect(mounted.eventNames()).toEqual([]);
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
        input(mounted).focus();
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('ArrowUp');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('apple');
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
        await keyboard.press('e');
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
        input(mounted).focus();
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('date');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('date');
      },
      PHASE,
    );

    scenario(
      'Alt+ArrowDown and Alt+ArrowUp do nothing and are left to the browser',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await keyboard.press('ArrowDown');
        mounted.clearEvents();
        const keys = watchKeys(mounted);
        await chord(keyboard, ['Alt'], 'ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        await chord(keyboard, ['Alt'], 'ArrowUp');
        expect(highlighted(mounted)).toBe('apple');
        keys.stop();
        expect(
          keys.prevented.filter(([key]) => key.startsWith('Arrow')),
        ).toEqual([
          ['ArrowDown', false],
          ['ArrowUp', false],
        ]);
        expect(input(mounted).getAttribute('aria-expanded')).toBe('true');
        expect(mounted.eventNames()).toEqual([]);
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
        input(mounted).focus();
        await typeText(keyboard, 'ap');
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
        expect(input(mounted).value).toBe('ap');
      },
      PHASE,
    );

    scenario(
      'PageDown and PageUp move a highlight by a page of the list, and are left alone without one',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: MANY, listClass: 'ac-scroll' }),
          props: { items: MANY },
        });
        input(mounted).focus();
        const keys = watchKeys(mounted);
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
      'Escape clears the text and the highlight, showing every option; on an empty input it is left to the page',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, defaultValue: ['banana'] },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'ba');
        expect(shownKeys(mounted)).toEqual(['banana']);
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        const keys = watchKeys(mounted);
        await keyboard.press('Escape');
        expect(input(mounted).value).toBe('');
        expect(shownKeys(mounted)).toEqual(ALL);
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('Escape');
        keys.stop();
        expect(keys.prevented).toEqual([
          ['Escape', true],
          ['Escape', false],
        ]);
        expect(texts(mounted)).toEqual(['b', 'ba', '']);
        expect(mounted.state()).toMatchObject({
          value: ['banana'],
          inputValue: '',
        });
        expect(changes(mounted)).toEqual([]);
        expect(active(mounted)).toBe(input(mounted));
      },
      PHASE,
    );

    scenario(
      'Tab leaves without choosing, and the highlight clears as focus leaves; Shift+Tab too',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await keyboard.press('a');
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.tab();
        expect(active(mounted)).toBe(byId(mounted, 'after'));
        expect(highlighted(mounted)).toBe(null);
        expect(mounted.state().focusedKey).toBe(null);
        expect(option(mounted, 'banana').hasAttribute('data-focused')).toBe(
          false,
        );
        expect(input(mounted).value).toBe('a');
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);

        await keyboard.tab({ isBackward: true });
        expect(active(mounted)).toBe(input(mounted));
        expect(highlighted(mounted)).toBe(null);
        await keyboard.press('ArrowDown');
        await keyboard.tab({ isBackward: true });
        expect(active(mounted)).toBe(byId(mounted, 'before'));
        expect(highlighted(mounted)).toBe(null);
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'keys with Ctrl or Meta, and keys during IME composition, are left to the browser',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        const keys = watchKeys(mounted);
        await chord(keyboard, ['Control'], 'ArrowDown');
        await chord(keyboard, ['Meta'], 'ArrowDown');
        await chord(keyboard, ['Control'], 'a');
        keys.stop();
        expect(
          keys.prevented.filter(([key]) => key === 'ArrowDown' || key === 'a'),
        ).toEqual([
          ['ArrowDown', false],
          ['ArrowDown', false],
          ['a', false],
        ]);
        expect(highlighted(mounted)).toBe(null);

        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('apple');
        for (const key of ['ArrowDown', 'Enter', 'Escape']) {
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
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('announcements', () => {
    scenario(
      'the option count is announced politely as typing changes it, never on focus',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        const heard = await listen();
        input(mounted).focus();
        await pause(100);
        expect(await heard()).toEqual([]);
        await keyboard.press('b');
        await expect.poll(heard).toEqual(['polite: 1 option available']);
        await keyboard.press('Backspace');
        await expect
          .poll(heard)
          .toEqual([
            'polite: 1 option available',
            'polite: 4 options available',
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
        await keyboard.press('e');
        await expect.poll(heard).toEqual(['polite: 3 fruits']);
      },
      PHASE,
    );

    scenario(
      'Escape, text the consumer sets and showAll() announce a new count while focus is in; with focus elsewhere nothing is',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        const heard = await listen();
        const expected: string[] = [];
        const expectHeard = async (phrase: string) => {
          expected.push(`polite: ${phrase}`);
          await expect.poll(heard).toEqual(expected);
        };
        await typeText(keyboard, 'ch');
        await expectHeard('1 option available');
        await keyboard.press('Escape');
        await expectHeard('4 options available');
        await keyboard.press('d');
        await expectHeard('1 option available');
        await mounted.setProps({ inputValue: 'a' });
        await expectHeard('3 options available');

        byId(mounted, 'after').focus();
        await mounted.setProps({ inputValue: 'ch' });
        expect(shownKeys(mounted)).toEqual(['cherry']);
        input(mounted).focus();
        await pause(100);
        expect(await heard()).toEqual(expected);

        await mounted.call('showAll');
        await expectHeard('4 options available');
      },
      PHASE,
    );
  });

  group('focus, pointer and touch', () => {
    scenario(
      'focus within is reported once for the input and the list together',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        expectOnEveryPart(mounted, 'data-focus-within', true);
        await pointer.click(option(mounted, 'banana'));
        await expect.poll(() => changes(mounted)).toEqual([['banana']]);
        expect(active(mounted)).toBe(input(mounted));
        byId(mounted, 'other').focus();
        expect(focusChanges(mounted)).toEqual([true, false]);
        expectOnEveryPart(mounted, 'data-focus-within', false);
        expect(mounted.state().isFocusWithin).toBe(false);
      },
      PHASE,
    );

    scenario(
      'focus within counts the input alone with no root rendered',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit({ hasRoot: false }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        expect(input(mounted).hasAttribute('data-focus-within')).toBe(true);
        expect(mounted.part('list').hasAttribute('data-focus-within')).toBe(
          true,
        );
        byId(mounted, 'after').focus();
        expect(focusChanges(mounted)).toEqual([true, false]);
        expect(input(mounted).hasAttribute('data-focus-within')).toBe(false);
      },
      PHASE,
    );

    scenario(
      'keyboard focus shows focus-visible on every part and on the option the keys highlight; the input carries no hover or focus attributes',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(active(mounted)).toBe(input(mounted));
        expectOnEveryPart(mounted, 'data-focus-visible', true);
        await pointer.move(input(mounted));
        expect(input(mounted).hasAttribute('data-hovered')).toBe(false);
        expect(input(mounted).hasAttribute('data-focused')).toBe(false);
        await keyboard.press('ArrowDown');
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
          template: fruit({ items: MANY, listClass: 'ac-scroll' }),
          props: { items: MANY },
        });
        input(mounted).focus();
        await keyboard.press('ArrowUp');
        expect(highlighted(mounted)).toBe('item-19');
        const list = mounted.part('list').getBoundingClientRect();
        const box = option(mounted, 'item-19').getBoundingClientRect();
        expect(box.top).toBeGreaterThanOrEqual(list.top - 1);
        expect(box.bottom).toBeLessThanOrEqual(list.bottom + 1);
      },
      PHASE,
    );

    scenario(
      'a hovering mouse highlights options only while focus is in, never a disabled one',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['date'] },
        });
        byId(mounted, 'before').focus();
        await pointer.move(option(mounted, 'cherry'));
        const cherry = option(mounted, 'cherry');
        expect(cherry.hasAttribute('data-hovered')).toBe(true);
        expect(cherry.hasAttribute('data-focused')).toBe(false);
        expect(mounted.state().focusedKey).toBe(null);

        input(mounted).focus();
        await pointer.move(option(mounted, 'banana'));
        const banana = option(mounted, 'banana');
        expect(highlighted(mounted)).toBe('banana');
        expect(banana.hasAttribute('data-hovered')).toBe(true);
        expect(banana.hasAttribute('data-focused')).toBe(true);
        expect(banana.hasAttribute('data-focus-visible')).toBe(false);
        await pointer.move(option(mounted, 'date'));
        expect(option(mounted, 'date').hasAttribute('data-hovered')).toBe(
          false,
        );
        expect(highlighted(mounted)).toBe('banana');
      },
      PHASE,
    );

    scenario(
      'a mouse press in the list outside an option brings focus to the input and chooses nothing',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit({ items: GROUPED }),
          props: { items: GROUPED },
          events: EVENTS,
        });
        byId(mounted, 'before').focus();
        const presses = watchPresses(mounted);
        await pointer.click(item(mounted, 'groupLabel', 'fruit'));
        presses.stop();
        expect(presses.prevented).toEqual([['mousedown', true]]);
        expect(active(mounted)).toBe(input(mounted));
        expect(focusChanges(mounted)).toEqual([true]);
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a press on a control of its own in the empty part takes focus, which stays within',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit({ hasEmptyButton: true }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'zz');
        expect(mounted.part('empty').hidden).toBe(false);
        const presses = watchPresses(mounted);
        await pointer.click(byId(mounted, 'add'));
        presses.stop();
        expect(presses.prevented).toEqual([['mousedown', false]]);
        expect(active(mounted)).toBe(byId(mounted, 'add'));
        expect(focusChanges(mounted)).toEqual([true]);
        expectOnEveryPart(mounted, 'data-focus-within', true);
        expect(input(mounted).value).toBe('zz');
      },
      PHASE,
    );

    scenario(
      'a press on a disabled option does nothing',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, disabledKeys: ['date'] },
          events: EVENTS,
        });
        input(mounted).focus();
        await pointer.click(option(mounted, 'date'));
        await pause(100);
        expect(active(mounted)).toBe(input(mounted));
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a press on the label focuses the input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await pointer.click(mounted.part('label'));
        await expect.poll(() => active(mounted)).toBe(input(mounted));
        expect(mounted.eventNames()).toEqual(['focusChange']);
      },
      PHASE,
    );

    scenario(
      "a screen reader's click on an option chooses it",
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        option(mounted, 'cherry').click();
        await expect.poll(() => changes(mounted)).toEqual([['cherry']]);
        expect(actions(mounted)).toEqual(['cherry']);
        expect(input(mounted).value).toBe('');
      },
      PHASE,
    );

    scenario(
      'touch: a tap on an option chooses it without bringing focus to the input, and keeps focus there when it is',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, selectionMode: 'multiple' },
          events: EVENTS,
        });
        byId(mounted, 'before').focus();
        await touch.tap(option(mounted, 'banana'));
        await expect.poll(() => changes(mounted)).toEqual([['banana']]);
        await pause(100);
        expect(active(mounted)).not.toBe(input(mounted));

        input(mounted).focus();
        await touch.tap(option(mounted, 'cherry'));
        await expect
          .poll(() => changes(mounted))
          .toEqual([['banana'], ['banana', 'cherry']]);
        await pause(100);
        expect(active(mounted)).toBe(input(mounted));
      },
      TOUCH,
    );
  });

  group('states', () => {
    scenario(
      'disabled: the input is disabled, nothing highlights or selects, every part is marked',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, isDisabled: true, defaultValue: ['apple'] },
          events: EVENTS,
        });
        expect(input(mounted).disabled).toBe(true);
        expect(mounted.part('list').getAttribute('aria-disabled')).toBe('true');
        expect(new FormData(form(mounted)).has('q')).toBe(false);
        expectOnEveryPart(mounted, 'data-disabled', true);
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(active(mounted)).not.toBe(input(mounted));
        await pointer.move(option(mounted, 'banana'));
        await pointer.click(option(mounted, 'banana'));
        option(mounted, 'cherry').click();
        await pause(100);
        expect(mounted.state()).toMatchObject({
          value: ['apple'],
          focusedKey: null,
        });
        expect(mounted.eventNames()).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'read-only: the highlight moves, but nothing selects, typing changes nothing and Escape keeps the text',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: {
            items: FRUIT,
            isReadOnly: true,
            defaultValue: ['apple'],
            defaultInputValue: 'a',
          },
          events: EVENTS,
        });
        expect(input(mounted).readOnly).toBe(true);
        expect(mounted.part('list').getAttribute('aria-readonly')).toBe('true');
        expectOnEveryPart(mounted, 'data-readonly', true);
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        input(mounted).focus();
        const keys = watchKeys(mounted);
        await keyboard.press('b');
        expect(input(mounted).value).toBe('a');
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe('banana');
        await keyboard.press('Enter');
        await pointer.click(option(mounted, 'date'));
        await keyboard.press('Escape');
        keys.stop();
        await pause(100);
        expect(keys.prevented.filter(([key]) => key === 'Escape')).toEqual([
          ['Escape', false],
        ]);
        expect(input(mounted).value).toBe('a');
        expect(mounted.state().value).toEqual(['apple']);
        expect(changes(mounted)).toEqual([]);
        expect(actions(mounted)).toEqual([]);
        expect(texts(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'required and invalid: on the input as ARIA only, the error shown and linked',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isRequired: true },
        });
        const field = input(mounted);
        expect(field.getAttribute('aria-required')).toBe('true');
        expect(field.required).toBe(false);
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
      'with no items, the empty part shows and describes the list',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ items: [] }),
          props: { items: [] },
        });
        const list = mounted.part('list');
        expect(mounted.part('empty').hidden).toBe(false);
        expect(list.getAttribute('aria-describedby')).toBe(
          mounted.part('empty').id,
        );
        expectOnEveryPart(mounted, 'data-empty', true);
        expect(mounted.state().isEmpty).toBe(true);
        input(mounted).focus();
        await keyboard.press('ArrowDown');
        expect(highlighted(mounted)).toBe(null);
        expect(active(mounted)).toBe(input(mounted));
      },
      PHASE,
    );
  });

  group('forms', () => {
    scenario(
      'the input submits its text under its own name, and required blocks nothing',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, isRequired: true, defaultValue: ['banana'] },
        });
        const submitted: unknown[] = [];
        form(mounted).addEventListener('submit', (event) => {
          event.preventDefault();
          submitted.push(Array.from(new FormData(form(mounted)).entries()));
        });
        form(mounted).requestSubmit();
        input(mounted).focus();
        await typeText(keyboard, 'ch');
        form(mounted).requestSubmit();
        expect(submitted).toEqual([[['q', '']], [['q', 'ch']]]);
      },
      PHASE,
    );

    scenario(
      'a form reset restores the default text, which filters, and keeps the selection',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, defaultInputValue: 'a' },
          events: EVENTS,
        });
        await retype(mounted, keyboard, 'ch');
        expect(shownKeys(mounted)).toEqual(['cherry']);
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        expect(mounted.state().value).toEqual(['cherry']);

        form(mounted).reset();
        await expect.poll(() => input(mounted).value).toBe('a');
        expect(mounted.state()).toMatchObject({
          inputValue: 'a',
          value: ['cherry'],
        });
        expect(shownKeys(mounted)).toEqual(['apple', 'banana', 'date']);
        expect(option(mounted, 'cherry').getAttribute('aria-selected')).toBe(
          'true',
        );
        expect(texts(mounted).at(-1)).toBe('a');
        expect(changes(mounted)).toEqual([['cherry']]);
      },
      PHASE,
    );

    scenario(
      'a form reset follows a default text set after mount, with or without a change',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT },
          events: EVENTS,
        });
        await mounted.setProps({ defaultInputValue: 'ch' });
        await expect.poll(() => input(mounted).value).toBe('ch');

        // Unchanged: the default stays, and nothing is reported.
        form(mounted).reset();
        await pause(50);
        expect(input(mounted).value).toBe('ch');
        expect(texts(mounted)).toEqual([]);

        // Changed, then a new default: the reset goes back to it.
        await retype(mounted, keyboard, 'ba');
        await mounted.setProps({ defaultInputValue: 'da' });
        expect(input(mounted).value).toBe('ba');
        form(mounted).reset();
        await expect.poll(() => input(mounted).value).toBe('da');
        expect(mounted.state().inputValue).toBe('da');
        expect(texts(mounted)).toEqual(['b', 'ba', 'da']);
      },
      PHASE,
    );

    scenario(
      'a controlled text asks for its default on a form reset, or for the text it mounted with',
      async ({ mount }) => {
        const seeded = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, inputValue: 'ch', defaultInputValue: 'a' },
          events: EVENTS,
        });
        form(seeded).reset();
        await expect.poll(() => texts(seeded)).toEqual(['a']);
        await pause(50);
        expect(input(seeded).value).toBe('ch');

        const mounted = await mount({
          template: fruit({ inForm: true }),
          props: { items: FRUIT, inputValue: 'ch' },
          events: EVENTS,
        });
        await mounted.setProps({ inputValue: 'ba' });
        form(mounted).reset();
        await expect.poll(() => texts(mounted)).toEqual(['ch']);
        await pause(50);
        expect(input(mounted).value).toBe('ba');
      },
      PHASE,
    );
  });

  group('state', () => {
    scenario(
      'public state follows the text, the highlight and the value',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        expect(mounted.state()).toEqual({
          value: [],
          inputValue: '',
          isOpen: true,
          focusedKey: null,
          isEmpty: false,
          isDisabled: false,
          isReadOnly: false,
          isRequired: false,
          isInvalid: false,
          isErrorShown: false,
          isFocusWithin: false,
          isFocusVisible: false,
          isVirtualized: false,
          renderedKeys: ['apple', 'banana', 'cherry', 'date'],
          renderedSections: [],
        });
        input(mounted).focus();
        await keyboard.press('b');
        expect(mounted.state()).toMatchObject({
          inputValue: 'b',
          isOpen: true,
          focusedKey: null,
          isFocusWithin: true,
        });
        await keyboard.press('ArrowDown');
        expect(mounted.state().focusedKey).toBe('banana');
        await keyboard.press('Enter');
        expect(mounted.state()).toMatchObject({
          value: ['banana'],
          inputValue: 'b',
          isOpen: true,
          focusedKey: 'banana',
        });
      },
      PHASE,
    );

    scenario(
      'open() and close() do nothing inline',
      async ({ mount }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: [...EVENTS, 'openChange'],
        });
        await mounted.call('close');
        await mounted.call('open');
        await pause(50);
        expect(mounted.eventNames()).toEqual([]);
        expect(input(mounted).getAttribute('aria-expanded')).toBe('true');
        expect(mounted.state().isOpen).toBe(true);
        expect(active(mounted)).not.toBe(input(mounted));
      },
      PHASE,
    );

    scenario(
      'typing, highlighting, hovering, clearing and uncontrolled selection never re-render the owner',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
          events: EVENTS,
        });
        const renders = mounted.renderCount();
        input(mounted).focus();
        await keyboard.press('b');
        await keyboard.press('ArrowDown');
        await keyboard.press('Enter');
        await keyboard.press('Escape');
        await pointer.move(option(mounted, 'date'));
        await pointer.click(option(mounted, 'date'));
        await expect
          .poll(() => changes(mounted))
          .toEqual([['banana'], ['date']]);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the input as an expanded combobox named by the label, with its text',
      async ({ mount, keyboard, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        expect(await spoken()).toContain(
          'combobox, Fruit, has popup listbox, expanded, autocomplete in list, 1 control',
        );
        input(mounted).focus();
        await keyboard.press('a');
        expect(await spoken()).toContain(
          'combobox, Fruit, a, has popup listbox, expanded, autocomplete in list, 1 control',
        );
      },
      PHASE,
    );

    scenario(
      'reads the list and its options, and not the filtered-out ones',
      async ({ mount, keyboard, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await keyboard.press('a');
        const phrases = await spoken();
        expect(phrases).toContain('listbox, Fruit, orientated vertically');
        expect(phrases).toContain(
          'option, Apple, not selected, position 1, set size 3',
        );
        expect(
          phrases.filter((phrase) => phrase.startsWith('option, ')),
        ).toHaveLength(3);
        expect(
          phrases.some((phrase) => phrase.startsWith('option, Cherry')),
        ).toBe(false);
        expect(phrases).not.toContain('No fruit');
      },
      PHASE,
    );

    scenario(
      'reads the highlighted option as the active descendant',
      async ({ mount, keyboard, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        input(mounted).focus();
        await keyboard.press('a');
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(await spoken()).toContain(
          'combobox, Fruit, a, has popup listbox, expanded, active descendant Banana, autocomplete in list, 1 control',
        );
      },
      PHASE,
    );

    scenario(
      'reads a multi-selectable list and its selected options',
      async ({ mount, spoken }) => {
        await mount({
          template: fruit(),
          props: {
            items: FRUIT,
            selectionMode: 'multiple',
            defaultValue: ['banana'],
          },
        });
        const phrases = await spoken();
        expect(phrases).toContain(
          'listbox, Fruit, orientated vertically, multi-selectable',
        );
        expect(phrases).toContain(
          'option, Banana, selected, position 2, set size 4',
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
          'combobox, Fruit, Pick some Pick one, has popup listbox, expanded, autocomplete in list, 1 control, invalid, required',
        );
      },
      PHASE,
    );

    scenario(
      'reads a read-only and a disabled autocomplete',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT, isReadOnly: true },
        });
        let phrases = await spoken();
        expect(phrases).toContain(
          'combobox, Fruit, has popup listbox, expanded, autocomplete in list, 1 control, read only',
        );
        expect(phrases).toContain(
          'listbox, Fruit, orientated vertically, read only',
        );
        await mounted.setProps({ isReadOnly: false, isDisabled: true });
        phrases = await spoken();
        expect(phrases).toContain(
          'combobox, Fruit, has popup listbox, expanded, autocomplete in list, 1 control, disabled',
        );
        expect(phrases).toContain(
          'listbox, Fruit, orientated vertically, disabled',
        );
      },
      PHASE,
    );
  });

  group('virtualization', () => {
    scenario(
      'ArrowUp highlights the last option, rendered, named as the active descendant and scrolled into view',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: virtualFruit(),
          props: VIRTUAL,
        });
        expect(mounted.part('scroller').getAttribute('tabindex')).toBe('-1');
        input(mounted).focus();
        await keyboard.press('ArrowUp');
        await expect.poll(() => highlighted(mounted)).toBe('item-999');
        const last = option(mounted, 'item-999');
        expect(isInView(mounted, last)).toBe(true);
        expect(last.getAttribute('aria-posinset')).toBe('1000');
        expect(last.getAttribute('aria-setsize')).toBe('1000');
      },
      PHASE,
    );

    scenario(
      'typing renders the matching options, numbered among the matches',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: virtualFruit(),
          props: VIRTUAL,
        });
        input(mounted).focus();
        await typeText(keyboard, 'Item 99');
        const matches = [
          'item-99',
          ...Array.from({ length: 10 }, (_, index) => `item-99${index}`),
        ];
        await expect.poll(() => renderedKeys(mounted)).toEqual(matches);
        expect(mounted.state().renderedKeys).toEqual(matches);
        expect(option(mounted, 'item-99').getAttribute('aria-posinset')).toBe(
          '1',
        );
        expect(option(mounted, 'item-999').getAttribute('aria-setsize')).toBe(
          '11',
        );
      },
      PHASE,
    );

    scenario(
      'a mouse press on the scroller keeps focus in the input',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: virtualFruit(),
          props: VIRTUAL,
          events: EVENTS,
        });
        input(mounted).focus();
        await typeText(keyboard, 'Item 999');
        await expect.poll(() => renderedKeys(mounted)).toEqual(['item-999']);
        // The one row sits at the scroller's top, so its middle is empty.
        const presses = watchPresses(mounted);
        await pointer.click(mounted.part('scroller'));
        presses.stop();
        expect(presses.prevented).toEqual([['mousedown', true]]);
        expect(active(mounted)).toBe(input(mounted));
        expect(focusChanges(mounted)).toEqual([true]);
      },
      PHASE,
    );
  });

  group('real screen readers', () => {
    scenario(
      'the arrows move the screen reader to each highlighted option',
      async ({ mount, screenReader }) => {
        const heard = {
          voiceover: { field: /Fruit/, first: /Apple/, next: /Banana/ },
          nvda: {
            field: /Fruit, combo box, expanded/,
            first: /Apple/,
            next: /Banana/,
          },
        }[screenReader.name];
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await screenReader.startFrom(byId(mounted, 'before'));
        await screenReader.press('Tab');
        expect.soft(await screenReader.spoken()).toMatch(heard.field);
        await screenReader.press('ArrowDown');
        expect.soft(await screenReader.readFocus()).toMatch(heard.first);
        await screenReader.press('ArrowDown');
        expect.soft(await screenReader.readFocus()).toMatch(heard.next);
      },
      { ...PHASE, needs: ['screenReader'] },
    );

    scenario(
      'the option count is spoken as typing filters the list',
      async ({ mount, screenReader }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await screenReader.startFrom(byId(mounted, 'before'));
        await screenReader.press('Tab');
        await screenReader.spoken();
        await screenReader.type('b');
        expect.soft(await screenReader.spoken()).toMatch(/1 option available/);
      },
      { ...PHASE, needs: ['screenReader'] },
    );

    scenario(
      'Escape clears the text, focus stays in the input, and the count is spoken',
      async ({ mount, screenReader }) => {
        const mounted = await mount({
          template: fruit(),
          props: { items: FRUIT },
        });
        await screenReader.startFrom(byId(mounted, 'before'));
        await screenReader.press('Tab');
        await screenReader.type('ch');
        await screenReader.spoken();
        await screenReader.press('Escape');
        expect(input(mounted).value).toBe('');
        expect.soft(await screenReader.spoken()).toMatch(/4 options available/);
        expect.soft(await screenReader.readFocus()).toMatch(/Fruit/);
      },
      { ...PHASE, needs: ['screenReader'] },
    );
  });
});
