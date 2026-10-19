/**
 * Select conformance, from the spec approved by @tenphi on 2026-10-18
 * (`packages/core/src/components/select/spec.md`): a `role="combobox"`
 * trigger named by the label, whose text is the value; Listbox's list in
 * Popover's popover, without a dialog role; opening by keys and by a press
 * start, with focus on the selected option; the closed trigger's typing and
 * ArrowLeft and ArrowRight; selecting and closing, Escape and Tab; press,
 * drag and release; presses on the trigger and outside; the label; the
 * states; the empty list; the hidden `<select>` for forms; focus within and
 * focus returned as the closing phase starts; public state, render counts and
 * spoken output. Phase 4.
 *
 * Every scenario passes `items`; reading them from markup is the element's
 * own test. The trigger is a button, which WebKit's Tab skips, so keyboard
 * scenarios focus it by script.
 */

import {
  VIRTUALIZER,
  defineConformance,
  h,
  partName,
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

import type { SelectItem, SelectProps, SelectState } from './types';

type MountedSelect = Mounted<SelectProps, SelectState>;

const PHASE = { phase: 4 } as const;
const TOUCH = { phase: 4, needs: ['touch'] } as const;

/** The named parts every template renders and the state attributes reach. */
const PARTS = [
  'root',
  'label',
  'trigger',
  'value',
  'popover',
  'list',
  'empty',
  'error',
];

const EVENTS = ['valueChange', 'openChange', 'focusChange'];

const FRUIT: readonly SelectItem[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  { key: 'date', textValue: 'Date' },
];

/** An exit animation long enough to see the closing phase. */
const EXIT = 400;

/**
 * Fixed places: the select at (150, 30) with its label above the trigger
 * (120×30 at y 50); the popover 160px wide, 4px below the trigger, its
 * options 24px tall; `#before` above-left and `#after` and `#other` below,
 * so nothing a scenario presses is covered.
 */
const LAYOUT = h(
  'style',
  null,
  `.sc-before { position: fixed; left: 0; top: 0; width: 100px }
   .sc-root { position: fixed; left: 150px; top: 30px; margin: 0 }
   .sc-label { display: block; height: 20px }
   .sc-trigger { display: block; width: 120px; height: 30px; margin: 0; padding: 0 }
   .sc-root p { margin: 0 }
   .sc-pop { width: 160px; margin: 4px 0 0; padding: 0; border: 0 }
   .sc-over { margin-top: -40px }
   .sc-list { margin: 0; padding: 0; list-style: none }
   .sc-scroll { max-height: 96px; overflow: auto }
   .sc-option { display: block; height: 24px; margin: 0; padding: 0 }
   .sc-after { position: fixed; left: 0; top: 400px; width: 100px }
   .sc-other { position: fixed; left: 0; top: 440px }`,
);

interface FruitOptions {
  readonly items?: readonly SelectItem[];
  readonly hasDescription?: boolean;
  /** Extra classes on the popover. */
  readonly popoverClass?: string;
  /** Extra classes on the list. */
  readonly listClass?: string;
  /** Wrap the select in `<form id="form">`. */
  readonly inForm?: boolean;
  /** Markup before the page, such as a stylesheet. */
  readonly head?: readonly TemplateNode[];
  /** Render the root around the parts; it is optional. */
  readonly hasRoot?: boolean;
}

/**
 * A select "Fruit": the label, the trigger with the value part and a
 * chevron hidden from assistive technology, the description, the error, the
 * popover with the list and the empty part, and the hidden `<select>` named
 * `fruit`; `#before` before it, `#after` and `#other` after it.
 */
function fruit({
  items = FRUIT,
  hasDescription = false,
  popoverClass = '',
  listClass = '',
  inForm = false,
  head = [],
  hasRoot = true,
}: FruitOptions = {}): TemplateNode[] {
  const isGrouped = items.some((item) => item.items);
  const tag = isGrouped ? 'div' : 'li';
  const render = (item: SelectItem): TemplateElement =>
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
  const parts = [
    h('span', { part: 'label', class: 'sc-label' }, 'Fruit'),
    h(
      'button',
      { part: 'trigger', class: 'sc-trigger' },
      h('span', { part: 'value' }),
      h('span', { 'aria-hidden': 'true' }, '▾'),
    ),
    ...(hasDescription ? [h('p', { part: 'description' }, 'Pick some')] : []),
    h('p', { part: 'error' }, 'Pick one'),
    h(
      'div',
      { part: 'popover', class: `sc-pop ${popoverClass}`.trim() },
      h(
        isGrouped ? 'div' : 'ul',
        { part: 'list', class: `sc-list ${listClass}`.trim() },
        ...items.map(render),
      ),
      h('p', { part: 'empty' }, 'No fruit'),
    ),
    h('select', { part: 'hiddenSelect', name: 'fruit' }),
  ];
  const select = hasRoot
    ? [h('div', { part: 'root', class: 'sc-root' }, ...parts)]
    : parts;
  return [
    LAYOUT,
    ...head,
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    ...(inForm ? [h('form', { id: 'form' }, ...select)] : select),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
    h('button', { id: 'other', class: 'sc-other' }, 'Other'),
  ];
}

/** Twenty options, of which four fit the list at once. */
const MANY: readonly SelectItem[] = Array.from({ length: 20 }, (_, index) => ({
  key: `item-${index}`,
  textValue: `Item ${index}`,
}));

/** A thousand options, `item-0` to `item-999`, for virtualized lists. */
const THOUSAND: readonly SelectItem[] = Array.from(
  { length: 1000 },
  (_, index) => ({ key: `item-${index}`, textValue: `Item ${index}` }),
);

/** The props of a virtualized select (Listbox virtualization spec). */
const VIRTUAL = {
  items: THOUSAND,
  virtualizer: VIRTUALIZER,
  itemSize: 20,
} as const;

/**
 * The select "Fruit" with a virtualized list: a scroller 100px tall in the
 * popover around the list, and 20px rows rendered from `renderedKeys`, as
 * the virtualization spec's consumer writes them.
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
    h('input', { id: 'before', class: 'sc-before', 'aria-label': 'Before' }),
    h(
      'div',
      { part: 'root', class: 'sc-root' },
      h('span', { part: 'label', class: 'sc-label' }, 'Fruit'),
      h(
        'button',
        { part: 'trigger', class: 'sc-trigger' },
        h('span', { part: 'value' }),
        h('span', { 'aria-hidden': 'true' }, '▾'),
      ),
      h('p', { part: 'error' }, 'Pick one'),
      h(
        'div',
        { part: 'popover', class: 'sc-pop' },
        h(
          'div',
          { part: 'scroller', class: 'vs-scroller' },
          h(
            'div',
            { part: 'list', class: 'sc-list' },
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
      h('select', { part: 'hiddenSelect', name: 'fruit' }),
    ),
    h('input', { id: 'after', class: 'sc-after', 'aria-label': 'After' }),
  ];
}

/** Two animation frames: scroll events and the rows they render have landed. */
function settle(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** Whether an element lies wholly inside the scroller's view. */
function isInView(mounted: MountedSelect, element: Element): boolean {
  const view = mounted.part('scroller').getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5;
}

/** Every rendered option's key, in document order. */
function renderedKeys(mounted: MountedSelect): string[] {
  return mounted.parts('option').map((element) => element.dataset.key!);
}

/** Keys `item-<from>` to `item-<to>`, both included. */
function keyRange(from: number, to: number): string[] {
  return Array.from(
    { length: to - from + 1 },
    (_, index) => `item-${from + index}`,
  );
}

async function typeText(keyboard: KeyboardInput, text: string): Promise<void> {
  for (const character of text) {
    await keyboard.press(character === ' ' ? 'Space' : character);
  }
}

/** A stylesheet that animates `selector` while the popover exits. */
function exitAnimation(selector: string): TemplateNode {
  return h(
    'style',
    null,
    `@keyframes uni-conformance-fade { to { opacity: 0 } }
     ${selector} { animation: uni-conformance-fade ${EXIT}ms linear forwards }`,
  );
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function byId(mounted: MountedSelect, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function trigger(mounted: MountedSelect): HTMLButtonElement {
  return mounted.part('trigger') as HTMLButtonElement;
}

function hiddenSelect(mounted: MountedSelect): HTMLSelectElement {
  return mounted.part('hiddenSelect') as HTMLSelectElement;
}

/** The option part for a key. */
function option(mounted: MountedSelect, key: string): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('select', 'option')}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No option "${key}".`);
  return element;
}

/** The keys whose options read `aria-selected="true"`, in document order. */
function selectedKeys(mounted: MountedSelect): string[] {
  return mounted
    .parts('option')
    .filter((element) => element.getAttribute('aria-selected') === 'true')
    .map((element) => element.dataset.key!);
}

/** The key of the option with focus, or `null`. */
function focusedKey(mounted: MountedSelect): string | null {
  const active = mounted.container.ownerDocument.activeElement as HTMLElement;
  return active && partName(active, 'select') === 'option'
    ? (active.dataset.key ?? null)
    : null;
}

function active(mounted: MountedSelect): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** The popover is in the top layer. */
function isShown(mounted: MountedSelect): boolean {
  return mounted.part('popover').matches(':popover-open');
}

/** Open: the trigger says so and the popover is shown. */
function isOpen(mounted: MountedSelect): boolean {
  return (
    trigger(mounted).getAttribute('aria-expanded') === 'true' &&
    isShown(mounted)
  );
}

/** Waits until the popover has finished closing. */
async function closed(mounted: MountedSelect): Promise<void> {
  await expect.poll(() => isShown(mounted)).toBe(false);
  expect(trigger(mounted).getAttribute('aria-expanded')).toBe('false');
}

/** The value part's text. */
function valueText(mounted: MountedSelect): string {
  return mounted.part('value').textContent ?? '';
}

function details(mounted: MountedSelect, name: string): unknown[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail);
}

const changes = (mounted: MountedSelect) => details(mounted, 'valueChange');
const opens = (mounted: MountedSelect) => details(mounted, 'openChange');

/** A state attribute is on every named part, or on none. */
function expectOnEveryPart(
  mounted: MountedSelect,
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
 * Records whether each keydown was prevented once the page has seen it,
 * until `stop()`.
 */
function watchKeys(mounted: MountedSelect): {
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

/** Focuses the trigger and opens the list with `key`. */
async function openWith(
  mounted: MountedSelect,
  keyboard: KeyboardInput,
  key = 'Enter',
): Promise<void> {
  trigger(mounted).focus();
  await keyboard.press(key);
  await expect.poll(() => isOpen(mounted)).toBe(true);
}

export const selectConformance = defineConformance<SelectProps, SelectState>(
  'select',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'the trigger is a combobox button named by the label, controlling the list',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
          });
          const button = trigger(mounted);
          const label = mounted.part('label');
          const list = mounted.part('list');
          expect(button.type).toBe('button');
          expect(button.getAttribute('role')).toBe('combobox');
          expect(button.getAttribute('aria-haspopup')).toBe('listbox');
          expect(button.getAttribute('aria-expanded')).toBe('false');
          expect(button.getAttribute('aria-controls')).toBe(list.id);
          expect(button.getAttribute('aria-labelledby')).toBe(label.id);
          expect(label.hasAttribute('for')).toBe(false);
          for (const name of [
            'aria-describedby',
            'aria-required',
            'aria-invalid',
            'aria-readonly',
            'disabled',
          ]) {
            expect(button.hasAttribute(name), name).toBe(false);
          }
          expect(list.getAttribute('role')).toBe('listbox');
          expect(list.getAttribute('aria-labelledby')).toBe(label.id);
          for (const name of [
            'aria-describedby',
            'aria-required',
            'aria-invalid',
            'aria-multiselectable',
          ]) {
            expect(list.hasAttribute(name), name).toBe(false);
          }
          expect(mounted.part('error').hidden).toBe(true);
          for (const name of [
            'data-open',
            'data-disabled',
            'data-readonly',
            'data-required',
            'data-invalid',
            'data-multiple',
            'data-focus-within',
            'data-focus-visible',
          ]) {
            expectOnEveryPart(mounted, name, false);
          }
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
        'the description and the error describe the trigger, not the list',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ hasDescription: true }),
            props: { items: FRUIT, isInvalid: true },
          });
          expect(trigger(mounted).getAttribute('aria-describedby')).toBe(
            `${mounted.part('description').id} ${mounted.part('error').id}`,
          );
          expect(mounted.part('list').hasAttribute('aria-describedby')).toBe(
            false,
          );
        },
        PHASE,
      );

      scenario(
        'triggerId names the trigger and option ids follow listId',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, triggerId: 'pick', listId: 'fruit' },
          });
          expect(trigger(mounted).id).toBe('pick');
          expect(mounted.part('list').id).toBe('fruit');
          expect(trigger(mounted).getAttribute('aria-controls')).toBe('fruit');
          expect(option(mounted, 'banana').id).toBe('fruit-option-banana');
        },
        PHASE,
      );

      scenario(
        "the value part shows the selected option's text, else the placeholder",
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, placeholder: 'Pick a fruit' },
          });
          expect(valueText(mounted)).toBe('Pick a fruit');
          expectOnEveryPart(mounted, 'data-placeholder', true);
          expect(mounted.state()).toMatchObject({
            valueText: '',
            isPlaceholder: true,
          });

          await mounted.setProps({ value: ['cherry'] });
          expect(valueText(mounted)).toBe('Cherry');
          expectOnEveryPart(mounted, 'data-placeholder', false);
          expect(mounted.state()).toMatchObject({
            valueText: 'Cherry',
            isPlaceholder: false,
          });

          // A key with no item shows nothing of its own.
          await mounted.setProps({ value: ['mango'] });
          expect(valueText(mounted)).toBe('Pick a fruit');
          expectOnEveryPart(mounted, 'data-placeholder', true);
          expect(mounted.state().value).toEqual(['mango']);
        },
        PHASE,
      );

      scenario(
        "multiple mode: the value joins the options' text and the list is multi-selectable",
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: {
              items: FRUIT,
              selectionMode: 'multiple',
              defaultValue: ['date', 'apple'],
            },
          });
          expect(valueText(mounted)).toBe('Date, Apple');
          expect(
            mounted.part('list').getAttribute('aria-multiselectable'),
          ).toBe('true');
          expectOnEveryPart(mounted, 'data-multiple', true);
        },
        PHASE,
      );

      scenario(
        'the hidden select holds an empty option and one per option, hidden from everyone',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
          });
          const select = hiddenSelect(mounted);
          expect(
            Array.from(select.options, (each) => [each.value, each.text]),
          ).toEqual([
            ['', ''],
            ['apple', 'Apple'],
            ['banana', 'Banana'],
            ['cherry', 'Cherry'],
            ['date', 'Date'],
          ]);
          expect(select.value).toBe('banana');
          expect(select.name).toBe('fruit');
          expect(select.multiple).toBe(false);
          expect(select.getAttribute('aria-hidden')).toBe('true');
          expect(select.getAttribute('tabindex')).toBe('-1');
          const view = select.ownerDocument.defaultView!;
          expect(view.getComputedStyle(select).display).not.toBe('none');
          const box = select.getBoundingClientRect();
          expect(box.width).toBeLessThanOrEqual(1);
          expect(box.height).toBeLessThanOrEqual(1);
        },
        PHASE,
      );
    });

    group('opening by keys', () => {
      for (const key of ['Enter', 'Space', 'ArrowDown']) {
        scenario(
          `${key} on the trigger opens the list on the first option`,
          async ({ mount, keyboard }) => {
            const mounted = await mount({
              template: fruit(),
              props: { items: FRUIT },
              events: EVENTS,
            });
            trigger(mounted).focus();
            const keys = watchKeys(mounted);
            await keyboard.press(key);
            keys.stop();
            await expect.poll(() => isOpen(mounted)).toBe(true);
            expect(keys.prevented[key === 'Space' ? ' ' : key]).toBe(true);
            await expect.poll(() => focusedKey(mounted)).toBe('apple');
            expectOnEveryPart(mounted, 'data-open', true);
            expect(opens(mounted)).toEqual([true]);
            expect(changes(mounted)).toEqual([]);
            expect(mounted.state()).toMatchObject({
              isOpen: true,
              focusedKey: 'apple',
            });
          },
          PHASE,
        );
      }

      scenario(
        'ArrowUp opens on the last option; Alt+ArrowDown and Alt+ArrowUp open too',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, disabledKeys: ['date'] },
          });
          await openWith(mounted, keyboard, 'ArrowUp');
          await expect.poll(() => focusedKey(mounted)).toBe('cherry');
          await keyboard.press('Escape');
          await closed(mounted);

          await chord(keyboard, ['Alt'], 'ArrowDown');
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
          await keyboard.press('Escape');
          await closed(mounted);

          await chord(keyboard, ['Alt'], 'ArrowUp');
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('cherry');
        },
        PHASE,
      );

      scenario(
        'opening focuses the selected option, for ArrowUp too, not the one focused last',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
          });
          await openWith(mounted, keyboard, 'ArrowUp');
          await expect.poll(() => focusedKey(mounted)).toBe('banana');
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('date');
          await keyboard.press('Escape');
          await closed(mounted);
          await keyboard.press('Enter');
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('banana');
        },
        PHASE,
      );

      scenario(
        'opening scrolls the selected option into view',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit({ items: MANY, listClass: 'sc-scroll' }),
            props: { items: MANY, defaultValue: ['item-15'] },
          });
          await openWith(mounted, keyboard);
          await expect.poll(() => focusedKey(mounted)).toBe('item-15');
          const list = mounted.part('list').getBoundingClientRect();
          const box = option(mounted, 'item-15').getBoundingClientRect();
          expect(box.top).toBeGreaterThanOrEqual(list.top - 1);
          expect(box.bottom).toBeLessThanOrEqual(list.bottom + 1);
        },
        PHASE,
      );

      scenario(
        "the opening key's repeats and its release select nothing",
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          trigger(mounted).focus();
          await keyboard.down('Enter');
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
          await keyboard.down('Enter');
          await keyboard.down('Enter');
          await keyboard.up('Enter');
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);

          await keyboard.press('Escape');
          await closed(mounted);
          await keyboard.down('Space');
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
          await keyboard.up('Space');
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'Escape, Home, End and the page keys on the closed trigger are left alone',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          trigger(mounted).focus();
          mounted.clearEvents();
          const keys = watchKeys(mounted);
          for (const key of ['Escape', 'Home', 'End', 'PageDown', 'PageUp']) {
            await keyboard.press(key);
          }
          keys.stop();
          expect(keys.prevented).toEqual({
            Escape: false,
            Home: false,
            End: false,
            PageDown: false,
            PageUp: false,
          });
          expect(isOpen(mounted)).toBe(false);
          expect(mounted.eventNames()).toEqual([]);
        },
        PHASE,
      );
    });

    group('the closed trigger', () => {
      scenario(
        'typing selects the next matching option without opening',
        async ({ mount, keyboard }) => {
          const items = [
            { key: 'apple', textValue: 'Apple' },
            { key: 'banana', textValue: 'Banana' },
            { key: 'blueberry', textValue: 'Blueberry' },
            { key: 'cherry', textValue: 'Cherry', isDisabled: true },
          ];
          const mounted = await mount({
            template: fruit({ items }),
            props: { items },
            events: EVENTS,
          });
          trigger(mounted).focus();
          await keyboard.press('b');
          expect(mounted.state().value).toEqual(['banana']);
          await keyboard.press('l');
          expect(mounted.state().value).toEqual(['blueberry']);
          expect(valueText(mounted)).toBe('Blueberry');
          await pause(1100);
          await keyboard.press('c');
          expect(mounted.state().value).toEqual(['blueberry']);
          expect(changes(mounted)).toEqual([['banana'], ['blueberry']]);
          expect(isOpen(mounted)).toBe(false);
          expect(opens(mounted)).toEqual([]);
          expect(active(mounted)).toBe(trigger(mounted));
        },
        PHASE,
      );

      scenario(
        'Space joins a query typed within a second instead of opening',
        async ({ mount, keyboard }) => {
          const items = [
            { key: 'newark', textValue: 'Newark' },
            { key: 'new-york', textValue: 'New York' },
          ];
          const mounted = await mount({
            template: fruit({ items }),
            props: { items },
          });
          trigger(mounted).focus();
          for (const key of ['n', 'e', 'w', 'Space', 'y']) {
            await keyboard.press(key);
          }
          await pause(100);
          expect(mounted.state().value).toEqual(['new-york']);
          expect(isOpen(mounted)).toBe(false);
        },
        PHASE,
      );

      scenario(
        'ArrowRight and ArrowLeft select the next and previous option without opening, and stop at the ends',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, disabledKeys: ['banana'] },
            events: EVENTS,
          });
          trigger(mounted).focus();
          await keyboard.press('ArrowLeft');
          expect(mounted.state().value).toEqual(['apple']);
          await keyboard.press('ArrowRight');
          expect(mounted.state().value).toEqual(['cherry']);
          await keyboard.press('ArrowRight');
          await keyboard.press('ArrowRight');
          expect(mounted.state().value).toEqual(['date']);
          await keyboard.press('ArrowLeft');
          expect(mounted.state().value).toEqual(['cherry']);
          expect(changes(mounted)).toEqual([
            ['apple'],
            ['cherry'],
            ['date'],
            ['cherry'],
          ]);
          expect(isOpen(mounted)).toBe(false);

          await mounted.setProps({ value: [] });
          await keyboard.press('ArrowRight');
          expect(changes(mounted).at(-1)).toEqual(['apple']);
        },
        PHASE,
      );

      scenario(
        'multiple mode: typing and ArrowLeft and ArrowRight change nothing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, selectionMode: 'multiple' },
            events: EVENTS,
          });
          trigger(mounted).focus();
          mounted.clearEvents();
          const keys = watchKeys(mounted);
          for (const key of ['b', 'ArrowRight', 'ArrowLeft']) {
            await keyboard.press(key);
          }
          keys.stop();
          expect(keys.prevented).toEqual({
            b: false,
            ArrowRight: false,
            ArrowLeft: false,
          });
          expect(mounted.eventNames()).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'read-only: typing and ArrowLeft and ArrowRight change nothing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isReadOnly: true, defaultValue: ['apple'] },
            events: EVENTS,
          });
          trigger(mounted).focus();
          for (const key of ['b', 'ArrowRight', 'ArrowLeft']) {
            await keyboard.press(key);
          }
          expect(mounted.state().value).toEqual(['apple']);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );
    });

    group('the open list', () => {
      scenario(
        'Enter selects the focused option, closes the list and returns focus to the trigger',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          expect(changes(mounted)).toEqual([['banana']]);
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          expect(valueText(mounted)).toBe('Banana');
          expect(selectedKeys(mounted)).toEqual(['banana']);
          expect(opens(mounted)).toEqual([true, false]);
        },
        PHASE,
      );

      scenario(
        'Space selects too, and choosing the selected option again closes with no change',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['cherry'] },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('Space');
          await closed(mounted);
          expect(changes(mounted)).toEqual([]);
          expect(opens(mounted)).toEqual([true, false]);

          await keyboard.press('Enter');
          await expect.poll(() => focusedKey(mounted)).toBe('cherry');
          await keyboard.press('ArrowUp');
          await keyboard.press('Space');
          await closed(mounted);
          expect(changes(mounted)).toEqual([['banana']]);
        },
        PHASE,
      );

      scenario(
        'Escape closes without changing the value and returns focus to the trigger',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['apple'] },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Escape');
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          expect(mounted.state().value).toEqual(['apple']);
          expect(changes(mounted)).toEqual([]);
          expect(opens(mounted)).toEqual([true, false]);
        },
        PHASE,
      );

      scenario(
        'Tab closes without selecting and moves on from the trigger; Shift+Tab to before it',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.tab();
          await closed(mounted);
          expect(active(mounted)).toBe(byId(mounted, 'after'));
          expect(changes(mounted)).toEqual([]);

          await openWith(mounted, keyboard);
          await keyboard.tab({ isBackward: true });
          await closed(mounted);
          expect(active(mounted)).toBe(byId(mounted, 'before'));
          expect(changes(mounted)).toEqual([]);
          expect(opens(mounted)).toEqual([true, false, true, false]);
        },
        PHASE,
      );

      scenario(
        'the arrows, Home, End and typeahead move focus in the list without selecting',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('date');
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('apple');
          await keyboard.press('c');
          expect(focusedKey(mounted)).toBe('cherry');
          await keyboard.press('ArrowUp');
          expect(focusedKey(mounted)).toBe('banana');
          expect(changes(mounted)).toEqual([]);
          expect(isOpen(mounted)).toBe(true);
        },
        PHASE,
      );

      scenario(
        'multiple mode: Enter and Space toggle and the list stays open until Escape',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, selectionMode: 'multiple' },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await keyboard.press('Space');
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          expect(mounted.state().value).toEqual(['apple', 'cherry']);
          expect(valueText(mounted)).toBe('Apple, Cherry');
          await keyboard.press('Space');
          expect(mounted.state().value).toEqual(['apple']);
          expect(isOpen(mounted)).toBe(true);
          await keyboard.press('Escape');
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          expect(changes(mounted)).toEqual([
            ['apple'],
            ['apple', 'cherry'],
            ['apple'],
          ]);
        },
        PHASE,
      );

      scenario(
        'a controlled select that refuses to close stays open',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isOpen: true },
            events: EVENTS,
          });
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
          await keyboard.press('Escape');
          await keyboard.press('Enter');
          expect(opens(mounted)).toEqual([false, false]);
          expect(changes(mounted)).toEqual([['apple']]);
          expect(isOpen(mounted)).toBe(true);
          await mounted.setProps({ isOpen: false });
          await closed(mounted);
        },
        PHASE,
      );
    });

    group('pointer and touch', () => {
      scenario(
        'a mouse press on the trigger opens the list on press start, and its release leaves it open',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
            events: EVENTS,
          });
          await pointer.down(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('banana');
          await pointer.up();
          await pause(100);
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);
          expect(opens(mounted)).toEqual([true]);
          expect(
            option(mounted, 'banana').hasAttribute('data-focus-visible'),
          ).toBe(false);
        },
        PHASE,
      );

      scenario(
        'press, drag and release over an option selects it and closes the list',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.down(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.move(option(mounted, 'cherry'));
          expect(focusedKey(mounted)).toBe('cherry');
          await pointer.up();
          await expect.poll(() => changes(mounted)).toEqual([['cherry']]);
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
        },
        PHASE,
      );

      scenario(
        'an option that opens under the pointer is not chosen by the same press',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit({ popoverClass: 'sc-over' }),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.down(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.up();
          await pause(100);
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a release away from the options leaves the list open',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.down(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.move(byId(mounted, 'after'));
          await pointer.up();
          await pause(100);
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a click on an option selects it and closes the list',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.click(option(mounted, 'date'));
          await expect.poll(() => changes(mounted)).toEqual([['date']]);
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          expect(opens(mounted)).toEqual([true, false]);
        },
        PHASE,
      );

      scenario(
        'a press on the trigger while open closes the list without opening it again',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.click(trigger(mounted));
          await closed(mounted);
          await pause(100);
          expect(isOpen(mounted)).toBe(false);
          expect(opens(mounted)).toEqual([true, false]);
          expect(active(mounted)).toBe(trigger(mounted));
        },
        PHASE,
      );

      scenario(
        'a press outside closes the list without selecting, and acts on what it hit',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.click(byId(mounted, 'after'));
          await closed(mounted);
          expect(active(mounted)).toBe(byId(mounted, 'after'));
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a hovering mouse marks and focuses options, never a disabled one',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, disabledKeys: ['date'] },
          });
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.move(option(mounted, 'cherry'));
          expect(option(mounted, 'cherry').hasAttribute('data-hovered')).toBe(
            true,
          );
          expect(focusedKey(mounted)).toBe('cherry');
          await pointer.move(option(mounted, 'date'));
          expect(option(mounted, 'date').hasAttribute('data-hovered')).toBe(
            false,
          );
          expect(focusedKey(mounted)).toBe('cherry');
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
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.click(option(mounted, 'date'));
          await pause(100);
          expect(isOpen(mounted)).toBe(true);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        "a screen reader's click on the trigger opens the list on the first option",
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          trigger(mounted).click();
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
          option(mounted, 'cherry').click();
          await expect.poll(() => changes(mounted)).toEqual([['cherry']]);
          await closed(mounted);
        },
        PHASE,
      );

      scenario(
        'touch: a finger down opens nothing; the tap opens the list',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await touch.down(trigger(mounted));
          await pause(100);
          expect(isOpen(mounted)).toBe(false);
          await touch.up();
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('apple');
        },
        TOUCH,
      );

      scenario(
        'touch: a tap on an option selects it and closes the list',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await touch.tap(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await touch.tap(option(mounted, 'banana'));
          await expect.poll(() => changes(mounted)).toEqual([['banana']]);
          await closed(mounted);
        },
        TOUCH,
      );
    });

    group('actions', () => {
      scenario(
        'open() opens the list on the selected option, else the first; close() returns focus to the trigger',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
            events: EVENTS,
          });
          await mounted.call('open');
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await expect.poll(() => focusedKey(mounted)).toBe('banana');
          expectOnEveryPart(mounted, 'data-open', true);

          await mounted.call('close');
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          expect(opens(mounted)).toEqual([true, false]);
          expect(changes(mounted)).toEqual([]);

          const unselected = await mount({
            template: fruit(),
            props: { items: FRUIT },
          });
          await unselected.call('open');
          await expect.poll(() => focusedKey(unselected)).toBe('apple');
        },
        PHASE,
      );

      scenario(
        'open() does nothing while disabled',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isDisabled: true },
            events: EVENTS,
          });
          await mounted.call('open');
          await pause(100);
          expect(isShown(mounted)).toBe(false);
          expect(opens(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'controlled, open() and close() only report; the consumer opens and closes the list',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isOpen: false },
            events: EVENTS,
          });
          await mounted.call('open');
          await pause(100);
          expect(isShown(mounted)).toBe(false);
          expect(opens(mounted)).toEqual([true]);

          await mounted.setProps({ isOpen: true });
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await mounted.call('close');
          await pause(100);
          expect(isShown(mounted)).toBe(true);
          expect(opens(mounted)).toEqual([true, false]);

          await mounted.setProps({ isOpen: false });
          await closed(mounted);
        },
        PHASE,
      );
    });

    group('the label', () => {
      scenario(
        'a press on the label focuses the trigger with visible focus, without opening',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await pointer.click(mounted.part('label'));
          await expect.poll(() => active(mounted)).toBe(trigger(mounted));
          expect(trigger(mounted).hasAttribute('data-focus-visible')).toBe(
            true,
          );
          await pause(100);
          expect(isOpen(mounted)).toBe(false);
          expect(opens(mounted)).toEqual([]);
        },
        PHASE,
      );
    });

    group('states', () => {
      scenario(
        'disabled: the trigger is disabled, nothing opens, every part is marked',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isDisabled: true },
            events: EVENTS,
          });
          expect(trigger(mounted).disabled).toBe(true);
          expect(hiddenSelect(mounted).disabled).toBe(true);
          expectOnEveryPart(mounted, 'data-disabled', true);
          await pointer.click(trigger(mounted));
          trigger(mounted).click();
          byId(mounted, 'before').focus();
          await keyboard.tab();
          await pause(100);
          expect(isOpen(mounted)).toBe(false);
          expect(active(mounted)).not.toBe(trigger(mounted));
          expect(mounted.eventNames()).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'read-only: the list opens and focus moves, but nothing selects',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isReadOnly: true, defaultValue: ['apple'] },
            events: EVENTS,
          });
          expect(trigger(mounted).getAttribute('aria-readonly')).toBe('true');
          expectOnEveryPart(mounted, 'data-readonly', true);
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('banana');
          await keyboard.press('Enter');
          await keyboard.press('Space');
          await pointer.click(option(mounted, 'cherry'));
          await pause(100);
          expect(isOpen(mounted)).toBe(true);
          expect(mounted.state().value).toEqual(['apple']);
          expect(changes(mounted)).toEqual([]);
          await keyboard.press('Escape');
          await closed(mounted);
        },
        PHASE,
      );

      scenario(
        'required and invalid: on the trigger, the error shown and linked, the hidden select required',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isRequired: true },
          });
          const button = trigger(mounted);
          expect(button.getAttribute('aria-required')).toBe('true');
          expect(hiddenSelect(mounted).required).toBe(true);
          expectOnEveryPart(mounted, 'data-required', true);
          await mounted.setProps({ isInvalid: true });
          expect(button.getAttribute('aria-invalid')).toBe('true');
          expect(button.getAttribute('aria-describedby')).toBe(
            mounted.part('error').id,
          );
          expect(mounted.part('error').hidden).toBe(false);
          expectOnEveryPart(mounted, 'data-invalid', true);
          expect(mounted.state().isErrorShown).toBe(true);
        },
        PHASE,
      );

      scenario(
        'an empty select opens on its list, described by the empty part',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit({ items: [] }),
            props: { items: [] },
          });
          await openWith(mounted, keyboard);
          const list = mounted.part('list');
          await expect.poll(() => active(mounted)).toBe(list);
          expect(mounted.part('empty').hidden).toBe(false);
          expect(list.getAttribute('aria-describedby')).toBe(
            mounted.part('empty').id,
          );
          expect(mounted.state().isEmpty).toBe(true);
          await keyboard.press('Escape');
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
        },
        PHASE,
      );
    });

    group('forms', () => {
      scenario(
        'the hidden select submits the value, and every key in multiple mode',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ inForm: true }),
            props: { items: FRUIT },
          });
          const form = byId(mounted, 'form') as HTMLFormElement;
          expect(new FormData(form).getAll('fruit')).toEqual(['']);
          await mounted.setProps({ value: ['cherry'] });
          expect(new FormData(form).getAll('fruit')).toEqual(['cherry']);
          await mounted.setProps({
            selectionMode: 'multiple',
            value: ['date', 'apple'],
          });
          expect(hiddenSelect(mounted).multiple).toBe(true);
          expect(new FormData(form).getAll('fruit')).toEqual(['apple', 'date']);
        },
        PHASE,
      );

      scenario(
        'the hidden select follows the items',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
          });
          await mounted.setProps({ items: FRUIT.slice(1, 3) });
          const select = hiddenSelect(mounted);
          expect(Array.from(select.options, (each) => each.value)).toEqual([
            '',
            'banana',
            'cherry',
          ]);
          expect(select.value).toBe('banana');
        },
        PHASE,
      );

      scenario(
        'browser autofill: a change on the hidden select sets the value',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          const select = hiddenSelect(mounted);
          select.value = 'cherry';
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          expect(mounted.state().value).toEqual(['cherry']);
          expect(valueText(mounted)).toBe('Cherry');
          expect(changes(mounted)).toEqual([['cherry']]);
        },
        PHASE,
      );

      scenario(
        'a form reset restores the default value',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit({ inForm: true }),
            props: { items: FRUIT, defaultValue: ['banana'] },
          });
          trigger(mounted).focus();
          await keyboard.press('ArrowRight');
          expect(mounted.state().value).toEqual(['cherry']);
          (byId(mounted, 'form') as HTMLFormElement).reset();
          await expect.poll(() => mounted.state().value).toEqual(['banana']);
          await expect.poll(() => hiddenSelect(mounted).value).toBe('banana');
          expect(valueText(mounted)).toBe('Banana');
        },
        PHASE,
      );

      scenario(
        'a required select with no value blocks the submit and takes focus',
        async ({ mount }) => {
          const mounted = await mount({
            template: fruit({ inForm: true }),
            props: { items: FRUIT, isRequired: true },
          });
          const form = byId(mounted, 'form') as HTMLFormElement;
          let submits = 0;
          form.addEventListener('submit', (event) => {
            submits++;
            event.preventDefault();
          });
          byId(mounted, 'before').focus();
          form.requestSubmit();
          await expect.poll(() => active(mounted)).toBe(trigger(mounted));
          expect(submits).toBe(0);
          await mounted.setProps({ value: ['apple'] });
          form.requestSubmit();
          expect(submits).toBe(1);
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'focus within is reported once for the trigger and the popup together',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          expectOnEveryPart(mounted, 'data-focus-within', true);
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
          byId(mounted, 'after').focus();
          expect(details(mounted, 'focusChange')).toEqual([true, false]);
          expectOnEveryPart(mounted, 'data-focus-within', false);
        },
        PHASE,
      );

      scenario(
        'focus within needs no root: the trigger and the popup are the select',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit({ hasRoot: false }),
            props: { items: FRUIT },
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          expect(mounted.state().isFocusWithin).toBe(true);
          expect(trigger(mounted).hasAttribute('data-focus-within')).toBe(true);
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          await closed(mounted);
          byId(mounted, 'after').focus();
          expect(details(mounted, 'focusChange')).toEqual([true, false]);
          expect(trigger(mounted).hasAttribute('data-focus-within')).toBe(
            false,
          );
        },
        PHASE,
      );

      scenario(
        'keyboard focus shows focus-visible on the option and every part',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
          });
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          const banana = option(mounted, 'banana');
          expect(banana.hasAttribute('data-focused')).toBe(true);
          expect(banana.hasAttribute('data-focus-visible')).toBe(true);
          expectOnEveryPart(mounted, 'data-focus-visible', true);
          expect(mounted.state()).toMatchObject({
            isFocusWithin: true,
            isFocusVisible: true,
            focusedKey: 'banana',
          });
        },
        PHASE,
      );

      scenario(
        'focus returns to the trigger as the closing phase starts',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit({
              head: [exitAnimation('.sc-pop[data-exiting]')],
            }),
            props: { items: FRUIT },
          });
          await openWith(mounted, keyboard);
          await keyboard.press('Enter');
          expect(active(mounted)).toBe(trigger(mounted));
          expect(mounted.part('popover').hasAttribute('data-exiting')).toBe(
            true,
          );
          expect(isShown(mounted)).toBe(true);
          await closed(mounted);
          expect(active(mounted)).toBe(trigger(mounted));
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'public state follows the props, the selection and the popup',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, placeholder: 'Pick a fruit' },
          });
          expect(mounted.state()).toEqual({
            value: [],
            valueText: '',
            isPlaceholder: true,
            selectionMode: 'single',
            isOpen: false,
            focusedKey: 'apple',
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
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          expect(mounted.state()).toMatchObject({
            isOpen: true,
            focusedKey: 'banana',
            isFocusWithin: true,
          });
          await keyboard.press('Enter');
          await closed(mounted);
          expect(mounted.state()).toMatchObject({
            value: ['banana'],
            valueText: 'Banana',
            isPlaceholder: false,
            isOpen: false,
          });
        },
        PHASE,
      );

      scenario(
        'opening, moving, hovering and uncontrolled selection never re-render the owner',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
            events: EVENTS,
          });
          const renders = mounted.renderCount();
          await openWith(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          await closed(mounted);
          await keyboard.press('c');
          await keyboard.press('ArrowLeft');
          await pointer.click(trigger(mounted));
          await expect.poll(() => isOpen(mounted)).toBe(true);
          await pointer.move(option(mounted, 'date'));
          await pointer.click(option(mounted, 'date'));
          await closed(mounted);
          expect(changes(mounted)).toHaveLength(4);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the closed trigger as a combobox named by the label, then its value',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['apple'] },
          });
          const phrases = await spoken();
          const at = phrases.indexOf(
            'combobox, Fruit, has popup listbox, not expanded, 1 control',
          );
          expect(at).toBeGreaterThan(-1);
          expect(phrases[at + 1]).toBe('Apple');
          expect(phrases).not.toContain(
            'listbox, Fruit, orientated vertically',
          );
        },
        PHASE,
      );

      scenario(
        'reads the placeholder as the value while nothing is selected',
        async ({ mount, spoken }) => {
          await mount({
            template: fruit(),
            props: { items: FRUIT, placeholder: 'Pick a fruit' },
          });
          const phrases = await spoken();
          const at = phrases.indexOf(
            'combobox, Fruit, has popup listbox, not expanded, 1 control',
          );
          expect(phrases[at + 1]).toBe('Pick a fruit');
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
            'combobox, Fruit, Pick some Pick one, has popup listbox, not expanded, 1 control, invalid, required',
          );
        },
        PHASE,
      );

      scenario(
        'reads a read-only and a disabled select',
        async ({ mount, spoken }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, isReadOnly: true },
          });
          expect(await spoken()).toContain(
            'combobox, Fruit, has popup listbox, not expanded, 1 control, read only',
          );
          await mounted.setProps({ isReadOnly: false, isDisabled: true });
          expect(await spoken()).toContain(
            'combobox, Fruit, has popup listbox, not expanded, 1 control, disabled',
          );
        },
        PHASE,
      );

      scenario(
        'reads only the list while open: the page is hidden',
        async ({ mount, keyboard, spoken }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, defaultValue: ['banana'] },
          });
          await openWith(mounted, keyboard);
          const phrases = await spoken();
          expect(phrases).toContain('listbox, Fruit, orientated vertically');
          expect(phrases).toContain(
            'option, Banana, selected, position 2, set size 4',
          );
          expect(phrases).toContain(
            'option, Apple, not selected, position 1, set size 4',
          );
          expect(phrases.some((phrase) => phrase.startsWith('combobox'))).toBe(
            false,
          );
        },
        PHASE,
      );

      scenario(
        'reads a multi-selectable list and an empty one',
        async ({ mount, keyboard, spoken }) => {
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT, selectionMode: 'multiple' },
          });
          await openWith(mounted, keyboard);
          expect(await spoken()).toContain(
            'listbox, Fruit, orientated vertically, multi-selectable',
          );
          await keyboard.press('Escape');
          await closed(mounted);
          await mounted.setProps({ items: [], selectionMode: 'single' });
          await openWith(mounted, keyboard);
          expect(await spoken()).toContain(
            'listbox, Fruit, No fruit, orientated vertically',
          );
        },
        PHASE,
      );
    });
    group('virtualization', () => {
      scenario(
        'opening focuses the selected option outside the view, rendered, numbered and scrolled into view',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: virtualFruit(),
            props: { ...VIRTUAL, defaultValue: ['item-500'] },
          });
          await openWith(mounted, keyboard);
          await expect.poll(() => focusedKey(mounted)).toBe('item-500');
          const selected = option(mounted, 'item-500');
          expect(isInView(mounted, selected)).toBe(true);
          expect(selected.getAttribute('aria-posinset')).toBe('501');
          expect(selected.getAttribute('aria-setsize')).toBe('1000');
          expect(mounted.part('scroller').getAttribute('tabindex')).toBe('-1');
          expect(mounted.part('list').hasAttribute('data-virtualized')).toBe(
            true,
          );
        },
        PHASE,
      );

      scenario(
        'End, typeahead and Enter reach and choose options outside the view',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: virtualFruit(),
            props: VIRTUAL,
            events: EVENTS,
          });
          await openWith(mounted, keyboard);
          await expect.poll(() => focusedKey(mounted)).toBe('item-0');
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('item-999');
          expect(isInView(mounted, option(mounted, 'item-999'))).toBe(true);
          await typeText(keyboard, 'Item 42');
          expect(focusedKey(mounted)).toBe('item-42');
          expect(isInView(mounted, option(mounted, 'item-42'))).toBe(true);
          await keyboard.press('Enter');
          await closed(mounted);
          expect(changes(mounted)).toEqual([['item-42']]);
          expect(valueText(mounted)).toBe('Item 42');
        },
        PHASE,
      );

      scenario(
        "public state and renderedKeysChange report its list's rendered set",
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: virtualFruit(),
            props: VIRTUAL,
            events: ['renderedKeysChange'],
          });
          await settle();
          // Closed, the scroller has no size: the first twenty render.
          expect(mounted.state()).toMatchObject({
            isVirtualized: true,
            renderedKeys: keyRange(0, 19),
            renderedSections: [],
          });
          expect(renderedKeys(mounted)).toEqual(keyRange(0, 19));
          await openWith(mounted, keyboard);
          await expect
            .poll(() => mounted.state().renderedKeys)
            .toEqual(keyRange(0, 14));
          expect(renderedKeys(mounted)).toEqual(keyRange(0, 14));
          expect(details(mounted, 'renderedKeysChange').at(-1)).toEqual({
            keys: keyRange(0, 14),
            sections: [],
          });
        },
        PHASE,
      );
    });

    group('real screen readers', () => {
      scenario(
        'ArrowDown opens the list on the first option, and Enter reads the trigger with the chosen value',
        async ({ mount, screenReader }) => {
          const heard = {
            voiceover: {
              trigger: /Fruit list box pop up collapsed combo box/,
              opened: /Apple \(1 of 4\)/,
              focus: /Apple/,
              next: /Banana \(2 of 4\)/,
              chosen: /Banana Fruit list box pop up collapsed combo box/,
            },
            nvda: {
              trigger: /Fruit, combo box, collapsed, opens list/,
              opened: /Fruit, list/,
              focus: /Apple, list item, focused, 1 of 4/,
              next: /Banana, not selected, 2 of 4/,
              chosen: /Fruit, combo box, Banana, collapsed, opens list/,
            },
          }[screenReader.name];
          const mounted = await mount({
            template: fruit(),
            props: { items: FRUIT },
          });
          await screenReader.startFrom(
            mounted.container.querySelector<HTMLElement>('#before')!,
          );
          await screenReader.press('Tab');
          expect.soft(await screenReader.spoken()).toMatch(heard.trigger);
          await screenReader.press('ArrowDown');
          expect.soft(await screenReader.spoken()).toMatch(heard.opened);
          // NVDA's speech stops at the list; its focus report names the option.
          expect.soft(await screenReader.readFocus()).toMatch(heard.focus);
          await screenReader.press('ArrowDown');
          expect.soft(await screenReader.spoken()).toMatch(heard.next);
          await screenReader.press('Enter');
          expect.soft(await screenReader.spoken()).toMatch(heard.chosen);
        },
        { ...PHASE, needs: ['screenReader'] },
      );
    });
  },
);
