/**
 * Listbox virtualization conformance, from the spec approved by @tenphi on
 * 2026-10-18 (`packages/core/src/components/listbox/virtualization.md`):
 * the rendered set (the view, the overscan and the pins, and the first
 * options before the scroller has a size), the layout UniAria writes,
 * position and set size, keys, typeahead and the page keys reaching options
 * outside the view, focus kept through scrolling, exact, per-key and
 * measured sizes, groups, the public state and event that report the
 * rendered set, render counts and spoken output. Phase 4, as Listbox.
 *
 * Every list renders its rows from `renderedKeys` (`rows()`), as the spec's
 * consumer does, in a scroller 100px tall with rows of 20px unless a
 * scenario says otherwise: five options are in view, and the default
 * overscan renders ten more beyond each edge.
 */

import { VIRTUALIZER, defineConformance, h, rows } from '@uniaria/testing';
import type {
  KeyboardInput,
  Mounted,
  PointerInput,
  ScenarioContext,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { ListboxItem, ListboxProps, ListboxState } from './types';

type MountedListbox = Mounted<ListboxProps, ListboxState>;

const PHASE = { phase: 4 } as const;

const EVENTS = ['valueChange', 'renderedKeysChange'];

/** A thousand options, `item-0` to `item-999`, read as "Item 0" and on. */
const ITEMS: readonly ListboxItem[] = Array.from(
  { length: 1000 },
  (_, index) => ({ key: `item-${index}`, textValue: `Item ${index}` }),
);

/**
 * Fifty sections of twenty options: `section-0` holds `item-0-0` to
 * `item-0-19`. With 20px rows each group is 420px: its label row, then its
 * options.
 */
const GROUPED: readonly ListboxItem[] = Array.from(
  { length: 50 },
  (_, section) => ({
    key: `section-${section}`,
    textValue: `Section ${section}`,
    items: Array.from({ length: 20 }, (_, index) => ({
      key: `item-${section}-${index}`,
      textValue: `Item ${section}-${index}`,
    })),
  }),
);

/** Keys `item-<from>` to `item-<to>`, both included. */
function keyRange(from: number, to: number): string[] {
  return Array.from(
    { length: to - from + 1 },
    (_, index) => `item-${from + index}`,
  );
}

/** The props every virtualized list takes. */
const VIRTUAL = { virtualizer: VIRTUALIZER, itemSize: 20 } as const;

const STYLE = h(
  'style',
  null,
  '.vs-scroller { height: 100px; overflow: auto; margin: 0; padding: 0 }' +
    ' .vs-list { margin: 0; padding: 0 }' +
    ' .vs-row, .vs-group { inset-inline-end: 0; margin: 0; padding: 0; box-sizing: border-box }' +
    ' .vs-row { height: 20px; font: 12px/20px sans-serif; overflow: hidden }' +
    ' .vs-label { display: block; height: 20px; font: 12px/20px sans-serif }' +
    ' .vs-tall { height: 40px }' +
    ' .vs-24 { height: 24px }' +
    ' .vs-hidden { display: none }' +
    ' .vs-across { width: 100px; height: 30px; overflow: auto; white-space: nowrap }' +
    ' .vs-column { width: 20px; height: 30px; inset-inline-end: auto; overflow: hidden }',
);

interface ListOptions {
  readonly items?: readonly ListboxItem[];
  /** Classes on the scroller. */
  readonly scrollerClass?: string;
  /** Classes on each option's row. */
  readonly rowClass?: (key: string) => string;
}

/**
 * A listbox "Items" between two text fields: the root around the label and
 * the scroller, the list inside it, and the rows `renderedKeys` names. A
 * grouped list renders each of `renderedSections` with its label and its
 * rendered options.
 */
function list({
  items = ITEMS,
  scrollerClass = 'vs-scroller',
  rowClass = () => 'vs-row',
}: ListOptions = {}): TemplateNode[] {
  const text = new Map<string, string>();
  const sectionOf = new Map<string, string>();
  for (const item of items) {
    text.set(item.key, item.textValue ?? item.key);
    for (const child of item.items ?? []) {
      text.set(child.key, child.textValue ?? child.key);
      sectionOf.set(child.key, item.key);
    }
  }
  const isGrouped = items.some((item) => item.items);
  const option = (key: string): TemplateElement =>
    h(
      'div',
      { part: 'option', 'data-key': key, class: rowClass(key) },
      text.get(key)!,
    );
  return [
    STYLE,
    h('input', { id: 'before', 'aria-label': 'Before' }),
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Items'),
      h(
        'div',
        { part: 'scroller', class: scrollerClass },
        h(
          'div',
          { part: 'list', class: 'vs-list' },
          rows(({ keys, sections }) =>
            isGrouped
              ? sections.map((section) =>
                  h(
                    'div',
                    { part: 'group', 'data-key': section, class: 'vs-group' },
                    h(
                      'span',
                      {
                        part: 'groupLabel',
                        'data-key': section,
                        class: 'vs-label',
                      },
                      text.get(section)!,
                    ),
                    ...keys
                      .filter((key) => sectionOf.get(key) === section)
                      .map(option),
                  ),
                )
              : keys.map(option),
          ),
        ),
      ),
    ),
    h('input', { id: 'after', 'aria-label': 'After' }),
  ];
}

/** Two animation frames: scroll events, resizes and the rows they render have landed. */
function settle(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function byId(mounted: MountedListbox, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

/** An item part for a key, or `null` while it isn't rendered. */
function itemPart(
  mounted: MountedListbox,
  part: string,
  key: string,
): HTMLElement | null {
  return mounted.container.querySelector<HTMLElement>(
    `[data-scope="listbox"][data-part="${part}"][data-key="${key}"]`,
  );
}

/** The option part for a key, which must be rendered. */
function option(mounted: MountedListbox, key: string): HTMLElement {
  const element = itemPart(mounted, 'option', key);
  if (!element) throw new Error(`Option "${key}" isn't rendered.`);
  return element;
}

/** Every rendered option's key, in document order. */
function keysOf(mounted: MountedListbox): string[] {
  return mounted.parts('option').map((element) => element.dataset.key!);
}

/** The key of the option with focus, or `null`. */
function focusedKey(mounted: MountedListbox): string | null {
  const active = mounted.container.ownerDocument.activeElement as HTMLElement;
  return active?.dataset.part === 'option'
    ? (active.dataset.key ?? null)
    : null;
}

/** Where an element starts along the block axis, from the list's start. */
function offsetOf(mounted: MountedListbox, element: Element): number {
  return Math.round(
    element.getBoundingClientRect().top -
      mounted.part('list').getBoundingClientRect().top,
  );
}

/** Whether an element lies wholly inside the scroller's view. */
function isInView(mounted: MountedListbox, element: Element): boolean {
  const view = mounted.part('scroller').getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5;
}

/**
 * Turns the wheel over the list until the first rows are past the overscan
 * (browsers scroll different distances per turn).
 */
async function wheelPast(
  mounted: MountedListbox,
  pointer: PointerInput,
): Promise<void> {
  const scroller = mounted.part('scroller');
  for (let turn = 0; turn < 20 && scroller.scrollTop < 600; turn++) {
    await pointer.wheel({ deltaY: 300 });
    await settle();
  }
  expect(scroller.scrollTop).toBeGreaterThanOrEqual(600);
  await settle();
}

async function scrollTo(mounted: MountedListbox, top: number): Promise<void> {
  mounted.part('scroller').scrollTop = top;
  await settle();
}

/** Focuses the first field, then Tabs into the list. */
async function tabIn(
  mounted: MountedListbox,
  keyboard: KeyboardInput,
): Promise<void> {
  byId(mounted, 'before').focus();
  await keyboard.tab();
}

async function type(keyboard: KeyboardInput, text: string): Promise<void> {
  for (const character of text) {
    await keyboard.press(character === ' ' ? 'Space' : character);
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

/** Cmd on Apple platforms, Ctrl elsewhere. */
function mod(): string {
  return /^Mac/i.test(navigator.platform) ? 'Meta' : 'Control';
}

function details(mounted: MountedListbox, name: string): unknown[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail);
}

/** Mounts a virtualized list and lets it lay out its first view. */
async function mountList(
  mount: ScenarioContext<ListboxProps, ListboxState>['mount'],
  props: Partial<ListboxProps> = {},
  options: ListOptions = {},
): Promise<MountedListbox> {
  const mounted = await mount({
    template: list(options),
    props: { items: options.items ?? ITEMS, ...VIRTUAL, ...props },
    events: EVENTS,
  });
  await settle();
  return mounted;
}

export const listboxVirtualizationConformance = defineConformance<
  ListboxProps,
  ListboxState
>('listbox', ({ scenario, group }) => {
  group('virtualization', () => {
    group('rendered set', () => {
      scenario(
        'renders the options in view and ten beyond its edge',
        async ({ mount }) => {
          const mounted = await mountList(mount);
          expect(keysOf(mounted)).toEqual(keyRange(0, 14));
          expect(mounted.state()).toMatchObject({
            isVirtualized: true,
            renderedKeys: keyRange(0, 14),
            renderedSections: [],
          });
        },
        PHASE,
      );

      scenario(
        'renders the options of a new view as it scrolls, keeping the tab stop',
        async ({ mount }) => {
          const mounted = await mountList(mount);
          await scrollTo(mounted, 1000);
          expect(keysOf(mounted)).toEqual(['item-0', ...keyRange(40, 64)]);
          expect(mounted.state().renderedKeys).toEqual(keysOf(mounted));
        },
        PHASE,
      );

      scenario(
        'renders the first initialItemCount options and the pins until the scroller has a size',
        async ({ mount }) => {
          const mounted = await mountList(
            mount,
            { initialItemCount: 5, defaultValue: ['item-500'] },
            { scrollerClass: 'vs-scroller vs-hidden' },
          );
          expect(keysOf(mounted)).toEqual([...keyRange(0, 4), 'item-500']);
          mounted.part('scroller').classList.remove('vs-hidden');
          await expect
            .poll(() => keysOf(mounted))
            .toEqual([...keyRange(0, 14), 'item-500']);
        },
        PHASE,
      );

      scenario(
        'renders every option, unpositioned and unnumbered, without a virtualizer',
        async ({ mount }) => {
          const items = ITEMS.slice(0, 30);
          const mounted = await mount({
            template: list({ items }),
            props: { items },
          });
          await settle();
          expect(keysOf(mounted)).toEqual(keyRange(0, 29));
          expect(mounted.state()).toMatchObject({
            isVirtualized: false,
            renderedKeys: keyRange(0, 29),
            renderedSections: [],
          });
          const first = option(mounted, 'item-0');
          expect(first.hasAttribute('aria-posinset')).toBe(false);
          expect(first.hasAttribute('aria-setsize')).toBe(false);
          expect(getComputedStyle(first).position).toBe('static');
          for (const name of ['root', 'scroller', 'list']) {
            expect(mounted.part(name).hasAttribute('data-virtualized')).toBe(
              false,
            );
          }
          expect(mounted.part('scroller').hasAttribute('tabindex')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'renderedKeys and renderedSections keep their identity until the rendered set changes',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          const { renderedKeys, renderedSections } = mounted.state();
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowDown');
          expect(mounted.state().renderedKeys).toBe(renderedKeys);
          expect(mounted.state().renderedSections).toBe(renderedSections);
          await scrollTo(mounted, 1000);
          expect(mounted.state().renderedKeys).not.toBe(renderedKeys);
        },
        PHASE,
      );

      scenario(
        'renderedKeysChange reports each change of the rendered set, and nothing else',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          mounted.clearEvents();
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          expect(details(mounted, 'renderedKeysChange')).toEqual([]);
          await scrollTo(mounted, 1000);
          const reported = details(mounted, 'renderedKeysChange');
          expect(reported.length).toBeGreaterThan(0);
          expect(reported.at(-1)).toEqual({
            keys: mounted.state().renderedKeys,
            sections: [],
          });
        },
        PHASE,
      );
    });

    group('layout', () => {
      scenario(
        'the list is as long as every option, and each option sits at its offset',
        async ({ mount }) => {
          const mounted = await mountList(mount);
          expect(mounted.part('list').getBoundingClientRect().height).toBe(
            20000,
          );
          expect(mounted.part('scroller').scrollHeight).toBe(20000);
          expect(offsetOf(mounted, option(mounted, 'item-3'))).toBe(60);
          await scrollTo(mounted, 1000);
          expect(offsetOf(mounted, option(mounted, 'item-50'))).toBe(1000);
          expect(isInView(mounted, option(mounted, 'item-50'))).toBe(true);
        },
        PHASE,
      );

      scenario(
        'the scroller is no tab stop, and the root, the scroller and the list say they are virtualized',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          expect(mounted.part('scroller').getAttribute('tabindex')).toBe('-1');
          for (const name of ['root', 'scroller', 'list']) {
            expect(mounted.part(name).hasAttribute('data-virtualized')).toBe(
              true,
            );
          }
          if (CSS.supports('overflow-anchor', 'none')) {
            expect(
              getComputedStyle(mounted.part('scroller')).overflowAnchor,
            ).toBe('none');
          }
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('item-0');
          await keyboard.tab();
          expect(document.activeElement).toBe(byId(mounted, 'after'));
        },
        PHASE,
      );

      scenario(
        'a horizontal list lays its options out along the inline axis',
        async ({ mount }) => {
          const mounted = await mountList(
            mount,
            { orientation: 'horizontal' },
            { scrollerClass: 'vs-across', rowClass: () => 'vs-row vs-column' },
          );
          const list = mounted.part('list').getBoundingClientRect();
          expect(list.width).toBe(20000);
          expect(keysOf(mounted)).toEqual(keyRange(0, 14));
          expect(
            Math.round(
              option(mounted, 'item-3').getBoundingClientRect().left -
                list.left,
            ),
          ).toBe(60);
        },
        PHASE,
      );
    });

    group('ARIA', () => {
      scenario(
        'each option says where it sits in the whole list',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          expect(option(mounted, 'item-3').getAttribute('aria-posinset')).toBe(
            '4',
          );
          expect(option(mounted, 'item-3').getAttribute('aria-setsize')).toBe(
            '1000',
          );
          await tabIn(mounted, keyboard);
          await keyboard.press('End');
          expect(
            option(mounted, 'item-999').getAttribute('aria-posinset'),
          ).toBe('1000');
        },
        PHASE,
      );
    });

    group('keyboard', () => {
      scenario(
        'End and Home focus the last and first options, rendered and scrolled into view',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('item-999');
          expect(mounted.part('scroller').scrollTop).toBe(19900);
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('item-0');
          expect(mounted.part('scroller').scrollTop).toBe(0);
        },
        PHASE,
      );

      scenario(
        'an arrow past the view scrolls one row',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          for (let step = 0; step < 5; step++)
            await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('item-5');
          expect(mounted.part('scroller').scrollTop).toBe(20);
        },
        PHASE,
      );

      scenario(
        "Page Down and Page Up move one view's length, measured from the rows' positions",
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await keyboard.press('PageDown');
          expect(focusedKey(mounted)).toBe('item-5');
          await keyboard.press('PageDown');
          expect(focusedKey(mounted)).toBe('item-10');
          expect(isInView(mounted, option(mounted, 'item-10'))).toBe(true);
          await keyboard.press('End');
          await keyboard.press('PageUp');
          expect(focusedKey(mounted)).toBe('item-994');
          await keyboard.press('PageUp');
          expect(focusedKey(mounted)).toBe('item-989');
          expect(isInView(mounted, option(mounted, 'item-989'))).toBe(true);
        },
        PHASE,
      );

      scenario(
        'typeahead focuses a match outside the view',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await type(keyboard, 'Item 777');
          expect(focusedKey(mounted)).toBe('item-777');
          expect(isInView(mounted, option(mounted, 'item-777'))).toBe(true);
        },
        PHASE,
      );

      scenario(
        'select-all selects options that were never rendered',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount, { selectionMode: 'multiple' });
          await tabIn(mounted, keyboard);
          await chord(keyboard, [mod()], 'a');
          expect(mounted.state().value).toHaveLength(1000);
          await scrollTo(mounted, 10000);
          expect(
            option(mounted, 'item-500').getAttribute('aria-selected'),
          ).toBe('true');
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'the focused option stays rendered and focused while the view scrolls away',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowDown');
          const focused = option(mounted, 'item-2');
          await scrollTo(mounted, 10000);
          expect(keysOf(mounted)).toContain('item-2');
          expect(document.activeElement).toBe(focused);
          await keyboard.press('ArrowDown');
          expect(focusedKey(mounted)).toBe('item-3');
          expect(isInView(mounted, option(mounted, 'item-3'))).toBe(true);
        },
        PHASE,
      );

      scenario(
        'a wheel scroll keeps focus on the option',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowDown');
          const focused = option(mounted, 'item-1');
          await pointer.move(mounted.part('scroller'));
          await wheelPast(mounted, pointer);
          expect(keysOf(mounted)).not.toContain('item-0');
          expect(document.activeElement).toBe(focused);
        },
        PHASE,
      );

      scenario(
        'Tab comes back to the option focused last after it scrolled out of view',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          for (let step = 0; step < 3; step++)
            await keyboard.press('ArrowDown');
          await keyboard.tab();
          expect(document.activeElement).toBe(byId(mounted, 'after'));
          await scrollTo(mounted, 10000);
          expect(keysOf(mounted)).toContain('item-3');
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('item-3');
        },
        PHASE,
      );
    });

    group('pointer', () => {
      scenario(
        'an option being pressed stays rendered while the wheel scrolls',
        async ({ mount, pointer }) => {
          const mounted = await mountList(mount);
          const pressed = option(mounted, 'item-2');
          await pointer.down(pressed);
          expect(pressed.hasAttribute('data-pressed')).toBe(true);
          await wheelPast(mounted, pointer);
          // The row left the pointer, which Listbox's press shows; its
          // element stays.
          expect(pressed.isConnected).toBe(true);
          expect(option(mounted, 'item-2')).toBe(pressed);
          await pointer.up();
          expect(pressed.hasAttribute('data-pressed')).toBe(false);
        },
        PHASE,
      );
    });

    group('sizes', () => {
      scenario(
        'itemSize as a function sizes each row by its key',
        async ({ mount }) => {
          const isTall = (key: string) => key.endsWith('0');
          const mounted = await mountList(
            mount,
            { itemSize: (key: string) => (isTall(key) ? 40 : 20) },
            { rowClass: (key) => (isTall(key) ? 'vs-row vs-tall' : 'vs-row') },
          );
          expect(offsetOf(mounted, option(mounted, 'item-10'))).toBe(220);
          expect(mounted.part('list').getBoundingClientRect().height).toBe(
            22000,
          );
        },
        PHASE,
      );

      scenario(
        'measured rows sit where the rows before them end',
        async ({ mount }) => {
          const mounted = await mountList(
            mount,
            { shouldMeasureItems: true },
            {
              rowClass: (key) =>
                key === 'item-1' ? 'vs-row vs-tall' : 'vs-row',
            },
          );
          await expect
            .poll(() => offsetOf(mounted, option(mounted, 'item-2')))
            .toBe(60);
          expect(mounted.part('list').getBoundingClientRect().height).toBe(
            20020,
          );
        },
        PHASE,
      );

      scenario(
        'without itemSize every rendered row is measured',
        async ({ mount }) => {
          const mounted = await mountList(
            mount,
            { itemSize: undefined },
            { rowClass: () => 'vs-row vs-24' },
          );
          await expect
            .poll(() => offsetOf(mounted, option(mounted, 'item-3')))
            .toBe(72);
        },
        PHASE,
      );

      scenario(
        'a measured row above the view that grows keeps the view where it was',
        async ({ mount }) => {
          const mounted = await mountList(mount, { shouldMeasureItems: true });
          await scrollTo(mounted, 1000);
          const scroller = mounted.part('scroller');
          const top = () =>
            Math.round(
              option(mounted, 'item-50').getBoundingClientRect().top -
                scroller.getBoundingClientRect().top,
            );
          expect(top()).toBe(0);
          option(mounted, 'item-45').classList.add('vs-tall');
          await expect.poll(() => scroller.scrollTop).toBe(1020);
          expect(top()).toBe(0);
        },
        PHASE,
      );

      scenario(
        'a hidden list keeps the sizes it measured',
        async ({ mount }) => {
          const mounted = await mountList(
            mount,
            { shouldMeasureItems: true },
            {
              rowClass: (key) =>
                key === 'item-1' ? 'vs-row vs-tall' : 'vs-row',
            },
          );
          await expect
            .poll(() => offsetOf(mounted, option(mounted, 'item-2')))
            .toBe(60);
          mounted.part('scroller').classList.add('vs-hidden');
          await settle();
          mounted.part('scroller').classList.remove('vs-hidden');
          await settle();
          expect(offsetOf(mounted, option(mounted, 'item-2'))).toBe(60);
        },
        PHASE,
      );
    });

    group('groups', () => {
      scenario(
        'a group renders with its label while any of its options does',
        async ({ mount }) => {
          const mounted = await mountList(mount, {}, { items: GROUPED });
          await scrollTo(mounted, 1000);
          expect(keysOf(mounted)).toContain('item-1-19');
          expect(keysOf(mounted)).not.toContain('item-1-17');
          const label = itemPart(mounted, 'groupLabel', 'section-1');
          expect(label).not.toBeNull();
          const group = itemPart(mounted, 'group', 'section-1')!;
          expect(
            document.getElementById(group.getAttribute('aria-labelledby')!),
          ).toBe(label);
        },
        PHASE,
      );

      scenario(
        "a group sits at its section's start, as long as its label and options, with its options inside it",
        async ({ mount }) => {
          const mounted = await mountList(mount, {}, { items: GROUPED });
          await scrollTo(mounted, 460);
          const group = itemPart(mounted, 'group', 'section-1')!;
          expect(offsetOf(mounted, group)).toBe(420);
          expect(group.getBoundingClientRect().height).toBe(420);
          expect(
            Math.round(
              option(mounted, 'item-1-0').getBoundingClientRect().top -
                group.getBoundingClientRect().top,
            ),
          ).toBe(20);
          expect(mounted.part('list').getBoundingClientRect().height).toBe(
            21000,
          );
        },
        PHASE,
      );

      scenario(
        'positions count across groups',
        async ({ mount }) => {
          const mounted = await mountList(mount, {}, { items: GROUPED });
          await scrollTo(mounted, 460);
          const first = option(mounted, 'item-1-0');
          expect(first.getAttribute('aria-posinset')).toBe('21');
          expect(first.getAttribute('aria-setsize')).toBe('1000');
          expect(
            itemPart(mounted, 'group', 'section-1')!.hasAttribute(
              'aria-posinset',
            ),
          ).toBe(false);
        },
        PHASE,
      );

      scenario(
        'renderedSections names the groups that hold rendered options',
        async ({ mount }) => {
          const mounted = await mountList(mount, {}, { items: GROUPED });
          expect(mounted.state().renderedSections).toEqual(['section-0']);
          await scrollTo(mounted, 1000);
          expect(mounted.state().renderedSections).toEqual([
            'section-0',
            'section-1',
            'section-2',
            'section-3',
          ]);
          expect(details(mounted, 'renderedKeysChange').at(-1)).toEqual({
            keys: mounted.state().renderedKeys,
            sections: ['section-0', 'section-1', 'section-2', 'section-3'],
          });
        },
        PHASE,
      );
    });

    group('items', () => {
      scenario(
        'new items lay the list out again',
        async ({ mount }) => {
          const mounted = await mountList(mount);
          await mounted.setProps({ items: ITEMS.slice(0, 10) });
          await expect.poll(() => keysOf(mounted)).toEqual(keyRange(0, 9));
          expect(option(mounted, 'item-9').getAttribute('aria-setsize')).toBe(
            '10',
          );
          expect(mounted.part('list').getBoundingClientRect().height).toBe(200);
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'public state reports the rendered set',
        async ({ mount }) => {
          const mounted = await mountList(mount);
          expect(mounted.state()).toMatchObject({
            focusedKey: 'item-0',
            isVirtualized: true,
            renderedKeys: keyRange(0, 14),
            renderedSections: [],
          });
        },
        PHASE,
      );

      scenario(
        'scrolling, moving focus and selecting never re-render the owner',
        async ({ mount, keyboard }) => {
          const mounted = await mountList(mount);
          const renders = mounted.renderCount();
          await tabIn(mounted, keyboard);
          await keyboard.press('End');
          await keyboard.press('Enter');
          await keyboard.press('Home');
          await scrollTo(mounted, 5000);
          expect(mounted.state().value).toEqual(['item-999']);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        "reads an option's position in the whole list",
        async ({ mount, keyboard, spoken }) => {
          const mounted = await mountList(mount);
          await tabIn(mounted, keyboard);
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('item-999');
          expect(await spoken()).toContain(
            'option, Item 999, not selected, position 1000, set size 1000',
          );
        },
        PHASE,
      );

      scenario(
        "reads a group's option with its position across groups",
        async ({ mount, spoken }) => {
          const mounted = await mountList(mount, {}, { items: GROUPED });
          await scrollTo(mounted, 460);
          const phrases = await spoken();
          expect(phrases).toContain('group, Section 1');
          expect(phrases).toContain(
            'option, Item 1-0, not selected, position 21, set size 1000',
          );
        },
        PHASE,
      );
    });
  });
});
