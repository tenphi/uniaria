/**
 * Tabs conformance, from the spec approved by @tenphi on 2026-10-26
 * (`packages/core/src/components/tabs/spec.md`): a `role="tablist"` list
 * whose tabs and panels are item parts keyed by `data-key`; naming; one tab
 * always shown, derived when the value names no enabled tab; panels hidden
 * only for keys that are items, so panels whose tabs come later show
 * (Cookbook); the keyboard map in both orientations and right to left, with
 * automatic and manual activation; roving focus and the shown panel's tab
 * stop; presses, hover and touch; the states; public state, render counts
 * and spoken output.
 *
 * Phase 9. Adapters run phase 7 and the inline popover suite takes phase 8,
 * so every scenario here is skipped until the implementation raises the
 * adapters to phase 9.
 *
 * Every scenario passes `items`, which React needs and the element then
 * takes as set; reading tabs from markup is the element's own test.
 */

import { defineConformance, h, partName, partSelector } from '@uniaria/testing';
import type { KeyboardInput, Mounted, TemplateElement } from '@uniaria/testing';
import { expect } from 'vitest';

import type { TabsItem, TabsProps, TabsState } from './types';

type MountedTabs = Mounted<TabsProps, TabsState>;

const PHASE = { phase: 9 } as const;
const TOUCH = { phase: 9, needs: ['touch'] } as const;

/** The named parts, with the label part rendered. */
const PARTS = ['root', 'label', 'list'];

const EVENTS = ['valueChange'];

/** The spec's examples: a list "Installation" of npm, pnpm and yarn. */
const MANAGERS: readonly TabsItem[] = [
  { key: 'npm' },
  { key: 'pnpm' },
  { key: 'yarn' },
];

/** Four tabs, to skip a disabled one at either end. */
const FOUR: readonly TabsItem[] = [...MANAGERS, { key: 'bun' }];

function keysOf(items: readonly TabsItem[]): string[] {
  return items.map((item) => item.key);
}

interface InstallationOptions {
  /** The keys whose tabs are rendered, in order. */
  readonly tabs?: readonly string[];
  /** The keys whose panels are rendered, in order; the tabs' by default. */
  readonly panels?: readonly string[];
  /**
   * How the list is named: a label part "Installation", the consumer's
   * `aria-label` "Installation" on the list, or nothing.
   */
  readonly name?: 'label' | 'aria-label' | 'none';
  /** Attributes on the label part. */
  readonly label?: Readonly<Record<string, string>>;
  /** Attributes on the list part, such as a class that makes it scroll. */
  readonly list?: Readonly<Record<string, string>>;
  /** Attributes on every tab part. */
  readonly tab?: Readonly<Record<string, string>>;
}

/**
 * Tabs "Installation": a root around the list of `button` tabs and, after
 * the list, a panel per key, as the spec's adapter surface writes them.
 */
function installation({
  tabs = keysOf(MANAGERS),
  panels = tabs,
  name = 'aria-label',
  label = {},
  list = {},
  tab = {},
}: InstallationOptions = {}): TemplateElement[] {
  return [
    h(
      'div',
      { part: 'root' },
      ...(name === 'label'
        ? [h('h3', { part: 'label', ...label }, 'Installation')]
        : []),
      h(
        'div',
        {
          part: 'list',
          ...(name === 'aria-label' ? { 'aria-label': 'Installation' } : {}),
          ...list,
        },
        ...tabs.map((key) =>
          h('button', { part: 'tab', 'data-key': key, ...tab }, key),
        ),
      ),
      ...panels.map((key) =>
        h('div', { part: 'panel', 'data-key': key }, `Run ${key} install.`),
      ),
    ),
  ];
}

/** Text fields around the tabs, for Tab (WebKit's Tab skips buttons). */
function between(nodes: TemplateElement[]): TemplateElement[] {
  return [
    h('input', { id: 'before', 'aria-label': 'Before' }),
    ...nodes,
    h('input', { id: 'after', 'aria-label': 'After' }),
  ];
}

function byId(mounted: MountedTabs, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function activeElement(mounted: MountedTabs): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** An item part for a key. */
function itemPart(
  mounted: MountedTabs,
  part: string,
  key: string,
): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(
    `${partSelector('tabs', part)}[data-key="${key}"]`,
  );
  if (!element) throw new Error(`No ${part} "${key}".`);
  return element;
}

const tab = (mounted: MountedTabs, key: string) =>
  itemPart(mounted, 'tab', key);
const panel = (mounted: MountedTabs, key: string) =>
  itemPart(mounted, 'panel', key);

/** The keys whose tabs read `aria-selected="true"`, in document order. */
function selectedTabs(mounted: MountedTabs): string[] {
  return mounted
    .parts('tab')
    .filter((element) => element.getAttribute('aria-selected') === 'true')
    .map((element) => element.dataset.key!);
}

/** The keys whose panels have no `hidden`, in document order. */
function shownPanels(mounted: MountedTabs): string[] {
  return mounted
    .parts('panel')
    .filter((element) => !element.hidden)
    .map((element) => element.dataset.key!);
}

/** Each tab's `tabindex`, in document order. */
function tabStops(mounted: MountedTabs): (string | null)[] {
  return mounted
    .parts('tab')
    .map((element) => element.getAttribute('tabindex'));
}

/** The key of the tab with focus, or `null`. */
function focusedKey(mounted: MountedTabs): string | null {
  const active = activeElement(mounted) as HTMLElement | null;
  return active && partName(active, 'tabs') === 'tab'
    ? (active.dataset.key ?? null)
    : null;
}

function changes(mounted: MountedTabs): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'valueChange')
    .map((event) => event.detail);
}

/** `key` is shown: its tab is the selected one and its panel the one shown. */
function expectShown(mounted: MountedTabs, key: string): void {
  expect(selectedTabs(mounted)).toEqual([key]);
  expect(shownPanels(mounted)).toEqual([key]);
  expect(mounted.state().selectedKey).toBe(key);
}

/** A state attribute is on every named part, or on none. */
function expectOnEveryPart(
  mounted: MountedTabs,
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
  mounted: MountedTabs,
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

/**
 * Records whether each keydown was prevented once the page has seen it,
 * until `stop()`.
 */
function watchKeys(mounted: MountedTabs): {
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

/**
 * Eight tabs of 60px in a list 170px wide that scrolls: the third is cut
 * short, the rest out of view.
 */
const SCROLLING: readonly TabsItem[] = Array.from(
  { length: 8 },
  (_, index) => ({
    key: `tab-${index}`,
  }),
);

/** The styles the scrolling list names, as a node to put beside the tabs. */
const SCROLLING_STYLE = h(
  'style',
  null,
  '.sc-scroll { display: flex; width: 170px; overflow: auto }' +
    ' .sc-tab { flex: none; width: 60px; margin: 0; padding: 0 }',
);

/** The scrolling list, without panels, between text fields. */
const SCROLLING_TEMPLATE = [
  SCROLLING_STYLE,
  ...between(
    installation({
      tabs: keysOf(SCROLLING),
      panels: [],
      list: { class: 'sc-scroll' },
      tab: { class: 'sc-tab' },
    }),
  ),
];

export const tabsConformance = defineConformance<TabsProps, TabsState>(
  'tabs',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'a tablist named by the label, its tabs and panels referencing each other',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation({ name: 'label' }),
            props: { items: MANAGERS },
          });
          const list = mounted.part('list');
          const label = mounted.part('label');
          expect(list.getAttribute('role')).toBe('tablist');
          expect(list.id).not.toBe('');
          expect(label.id).not.toBe('');
          expect(list.getAttribute('aria-labelledby')).toBe(label.id);
          expect(list.getAttribute('aria-orientation')).toBe('horizontal');
          for (const key of keysOf(MANAGERS)) {
            const element = tab(mounted, key);
            const content = panel(mounted, key);
            expect(element.getAttribute('role'), key).toBe('tab');
            expect(element.id, key).toBe(`${list.id}-tab-${key}`);
            expect(element.getAttribute('aria-controls'), key).toBe(content.id);
            expect(element.getAttribute('type'), key).toBe('button');
            for (const name of [
              'aria-disabled',
              'aria-setsize',
              'aria-posinset',
              'disabled',
            ]) {
              expect(element.hasAttribute(name), `${name} on ${key}`).toBe(
                false,
              );
            }
            expect(content.getAttribute('role'), key).toBe('tabpanel');
            expect(content.id, key).toBe(`${list.id}-panel-${key}`);
            expect(content.getAttribute('aria-labelledby'), key).toBe(
              element.id,
            );
          }
          expect(
            mounted
              .parts('tab')
              .map((element) => element.getAttribute('aria-selected')),
          ).toEqual(['true', 'false', 'false']);
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);
          for (const attribute of [
            'data-disabled',
            'data-focus-within',
            'data-focus-visible',
          ]) {
            expectOnEveryPart(mounted, attribute, false);
          }
          for (const element of [
            ...PARTS.map((name) => mounted.part(name)),
            ...mounted.parts('tab'),
            ...mounted.parts('panel'),
          ]) {
            expect(element.getAttribute('data-orientation')).toBe('horizontal');
          }
        },
        PHASE,
      );

      scenario(
        'keeps the ids the consumer gives the label and the list; item ids follow the list',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation({
              name: 'label',
              label: { id: 'install-label' },
              list: { id: 'install-list' },
            }),
            props: { items: MANAGERS },
          });
          const list = mounted.part('list');
          expect(mounted.part('label').id).toBe('install-label');
          expect(list.id).toBe('install-list');
          expect(list.getAttribute('aria-labelledby')).toBe('install-label');
          expect(tab(mounted, 'pnpm').id).toBe('install-list-tab-pnpm');
          expect(panel(mounted, 'pnpm').id).toBe('install-list-panel-pnpm');
          expect(tab(mounted, 'pnpm').getAttribute('aria-controls')).toBe(
            'install-list-panel-pnpm',
          );
          expect(panel(mounted, 'pnpm').getAttribute('aria-labelledby')).toBe(
            'install-list-tab-pnpm',
          );
        },
        PHASE,
      );

      scenario(
        'item ids follow listId and encode the key',
        async ({ mount }) => {
          const items = [{ key: 'npm' }, { key: 'yarn berry' }];
          const mounted = await mount({
            template: installation({ tabs: keysOf(items) }),
            props: { items, listId: 'install' },
          });
          expect(mounted.part('list').id).toBe('install');
          expect(tab(mounted, 'npm').id).toBe('install-tab-npm');
          expect(tab(mounted, 'yarn berry').id).toBe(
            'install-tab-yarn%20berry',
          );
          expect(panel(mounted, 'yarn berry').id).toBe(
            'install-panel-yarn%20berry',
          );
        },
        PHASE,
      );

      scenario(
        'a tab whose panel is not rendered controls nothing; a panel whose tab is not rendered is labelled by nothing',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation({
              tabs: ['npm', 'pnpm'],
              panels: ['npm', 'yarn'],
            }),
            props: { items: MANAGERS },
          });
          expect(tab(mounted, 'npm').getAttribute('aria-controls')).toBe(
            panel(mounted, 'npm').id,
          );
          expect(tab(mounted, 'pnpm').hasAttribute('aria-controls')).toBe(
            false,
          );
          const yarn = panel(mounted, 'yarn');
          expect(yarn.getAttribute('role')).toBe('tabpanel');
          expect(yarn.hidden).toBe(true);
          expect(yarn.hasAttribute('aria-labelledby')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'vertical orientation is written on the list and every part',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation({ name: 'label' }),
            props: { items: MANAGERS, orientation: 'vertical' },
          });
          expect(mounted.part('list').getAttribute('aria-orientation')).toBe(
            'vertical',
          );
          for (const element of [
            ...PARTS.map((name) => mounted.part(name)),
            ...mounted.parts('tab'),
            ...mounted.parts('panel'),
          ]) {
            expect(element.getAttribute('data-orientation')).toBe('vertical');
          }
        },
        PHASE,
      );
    });

    group('naming', () => {
      scenario(
        'without a label part the consumer’s aria-label names the list',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
          });
          const list = mounted.part('list');
          expect(list.getAttribute('aria-label')).toBe('Installation');
          expect(list.hasAttribute('aria-labelledby')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'labelledBy names the list without a label part',
        async ({ mount }) => {
          const mounted = await mount({
            template: [
              h('h2', { id: 'docs-heading' }, 'Install'),
              ...installation({ name: 'none' }),
            ],
            props: { items: MANAGERS, labelledBy: 'docs-heading' },
          });
          expect(mounted.part('list').getAttribute('aria-labelledby')).toBe(
            'docs-heading',
          );
        },
        PHASE,
      );

      scenario(
        'labelledBy joins the label part’s id',
        async ({ mount }) => {
          const mounted = await mount({
            template: [
              h('h2', { id: 'docs-heading' }, 'Install'),
              ...installation({ name: 'label' }),
            ],
            props: { items: MANAGERS, labelledBy: 'docs-heading' },
          });
          const ids = mounted
            .part('list')
            .getAttribute('aria-labelledby')!
            .split(' ');
          expect([...ids].sort()).toEqual(
            [mounted.part('label').id, 'docs-heading'].sort(),
          );
        },
        PHASE,
      );
    });

    group('selection', () => {
      scenario(
        'without a value the first tab is shown, and nothing is reported',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          expectShown(mounted, 'npm');
          expect(mounted.state().value).toBe(null);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'defaultValue shows its tab without reporting; the tab stop is that tab',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, defaultValue: 'pnpm' },
            events: EVENTS,
          });
          expectShown(mounted, 'pnpm');
          expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);
          expect(mounted.state().value).toBe('pnpm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a press shows another tab and reports it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await pointer.click(tab(mounted, 'yarn'));
          expectShown(mounted, 'yarn');
          expect(mounted.state().value).toBe('yarn');
          await pointer.click(tab(mounted, 'pnpm'));
          expectShown(mounted, 'pnpm');
          expect(changes(mounted)).toEqual(['yarn', 'pnpm']);
        },
        PHASE,
      );

      scenario(
        'a press on the shown tab changes nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, defaultValue: 'pnpm' },
            events: EVENTS,
          });
          await pointer.click(tab(mounted, 'pnpm'));
          tab(mounted, 'pnpm').click();
          expectShown(mounted, 'pnpm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a controlled value follows props, and a press only requests a change',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, value: 'npm' },
            events: EVENTS,
          });
          await pointer.click(tab(mounted, 'yarn'));
          expect(changes(mounted)).toEqual(['yarn']);
          expectShown(mounted, 'npm');

          await mounted.setProps({ value: 'yarn' });
          expectShown(mounted, 'yarn');
          await mounted.setProps({ value: 'pnpm' });
          expectShown(mounted, 'pnpm');
          expect(changes(mounted)).toEqual(['yarn']);
        },
        PHASE,
      );

      scenario(
        'a controlled null stays controlled and shows the first tab',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, value: null },
            events: EVENTS,
          });
          expectShown(mounted, 'npm');
          await pointer.click(tab(mounted, 'pnpm'));
          expect(changes(mounted)).toEqual(['pnpm']);
          expectShown(mounted, 'npm');
          expect(mounted.state().value).toBe(null);
        },
        PHASE,
      );

      scenario(
        'a value naming a disabled tab or no tab shows the first enabled tab and keeps its key',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: {
              items: MANAGERS,
              value: 'pnpm',
              disabledKeys: ['npm', 'pnpm'],
            },
            events: EVENTS,
          });
          expectShown(mounted, 'yarn');
          expect(mounted.state().value).toBe('pnpm');

          await mounted.setProps({ disabledKeys: [] });
          expectShown(mounted, 'pnpm');

          await mounted.setProps({ value: 'bun' });
          expectShown(mounted, 'npm');
          expect(mounted.state().value).toBe('bun');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'with every tab disabled the first tab is shown',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, disabledKeys: keysOf(MANAGERS) },
          });
          expectShown(mounted, 'npm');
        },
        PHASE,
      );

      scenario(
        'removing the shown tab shows the first enabled tab; adding it back shows it again',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, defaultValue: 'yarn' },
            events: EVENTS,
          });
          expectShown(mounted, 'yarn');

          await mounted.setProps({ items: MANAGERS.slice(0, 2) });
          expect(mounted.state().selectedKey).toBe('npm');
          expect(mounted.state().value).toBe('yarn');
          expect(tab(mounted, 'npm').getAttribute('aria-selected')).toBe(
            'true',
          );
          expect(tab(mounted, 'pnpm').getAttribute('aria-selected')).toBe(
            'false',
          );
          expect(panel(mounted, 'npm').hidden).toBe(false);
          expect(panel(mounted, 'pnpm').hidden).toBe(true);

          await mounted.setProps({ items: MANAGERS });
          expectShown(mounted, 'yarn');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );
    });

    group('panels', () => {
      scenario(
        'the shown panel has no hidden and a tab stop; the others are hidden',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
          });
          const expectPanels = (shown: string) => {
            for (const key of keysOf(MANAGERS)) {
              const content = panel(mounted, key);
              const isShown = key === shown;
              expect(content.hidden, key).toBe(!isShown);
              expect(content.getAttribute('tabindex'), key).toBe(
                isShown ? '0' : null,
              );
              expect(content.hasAttribute('data-selected'), key).toBe(isShown);
              expect(tab(mounted, key).hasAttribute('data-selected'), key).toBe(
                isShown,
              );
            }
          };
          expectPanels('npm');
          await pointer.click(tab(mounted, 'yarn'));
          expectPanels('yarn');
        },
        PHASE,
      );

      scenario(
        'panels whose keys are not items are left alone until tabs for them arrive',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation({ tabs: [], panels: keysOf(MANAGERS) }),
            props: { items: [] },
          });
          for (const key of keysOf(MANAGERS)) {
            const content = panel(mounted, key);
            for (const name of [
              'role',
              'id',
              'hidden',
              'tabindex',
              'aria-labelledby',
            ]) {
              expect(content.hasAttribute(name), `${name} on ${key}`).toBe(
                false,
              );
            }
          }
          expect(mounted.state().selectedKey).toBe(null);

          await mounted.setProps({ items: MANAGERS });
          expect(mounted.part('list').getAttribute('role')).toBe('tablist');
          expect(shownPanels(mounted)).toEqual(['npm']);
          expect(panel(mounted, 'npm').getAttribute('tabindex')).toBe('0');
          for (const key of keysOf(MANAGERS)) {
            const content = panel(mounted, key);
            expect(content.getAttribute('role'), key).toBe('tabpanel');
            // No tab element is rendered for it yet.
            expect(content.hasAttribute('aria-labelledby'), key).toBe(false);
          }
          expect(mounted.state().selectedKey).toBe('npm');
        },
        PHASE,
      );
    });

    group('keyboard', () => {
      scenario(
        'Tab enters at the shown tab, reaches the shown panel next, then leaves',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, defaultValue: 'pnpm' },
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('pnpm');
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(panel(mounted, 'pnpm'));
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(byId(mounted, 'after'));
          await keyboard.tab({ isBackward: true });
          expect(activeElement(mounted)).toBe(panel(mounted, 'pnpm'));
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('pnpm');
        },
        PHASE,
      );

      scenario(
        'ArrowRight and ArrowLeft focus and select the next and previous tab, wrapping at the ends',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          const visited: (string | null)[] = [];
          for (const key of [
            'ArrowRight',
            'ArrowRight',
            'ArrowRight',
            'ArrowLeft',
          ]) {
            await keyboard.press(key);
            visited.push(focusedKey(mounted));
          }
          keys.stop();
          expect(visited).toEqual(['pnpm', 'yarn', 'npm', 'yarn']);
          expectShown(mounted, 'yarn');
          expect(changes(mounted)).toEqual(['pnpm', 'yarn', 'npm', 'yarn']);
          expect(keys.prevented).toEqual({
            ArrowRight: true,
            ArrowLeft: true,
          });
        },
        PHASE,
      );

      scenario(
        'the arrows skip disabled tabs',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, disabledKeys: ['pnpm'] },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('yarn');
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('npm');
          await keyboard.press('ArrowLeft');
          expect(focusedKey(mounted)).toBe('yarn');
          expect(changes(mounted)).toEqual(['yarn', 'npm', 'yarn']);
        },
        PHASE,
      );

      scenario(
        'Home and End focus and select the first and last enabled tabs',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation({ tabs: keysOf(FOUR) })),
            props: { items: FOUR, disabledKeys: ['npm', 'bun'] },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          expect(focusedKey(mounted)).toBe('pnpm');
          const keys = watchKeys(mounted);
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('yarn');
          expectShown(mounted, 'yarn');
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('pnpm');
          expectShown(mounted, 'pnpm');
          keys.stop();
          expect(keys.prevented).toEqual({ End: true, Home: true });
          expect(changes(mounted)).toEqual(['yarn', 'pnpm']);
        },
        PHASE,
      );

      scenario(
        'horizontal: ArrowDown and ArrowUp are left to the page',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          await keyboard.press('ArrowDown');
          await keyboard.press('ArrowUp');
          keys.stop();
          expect(keys.prevented).toEqual({ ArrowDown: false, ArrowUp: false });
          expect(focusedKey(mounted)).toBe('npm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'vertical: ArrowDown and ArrowUp move and select, wrapping; ArrowLeft and ArrowRight are left alone',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, orientation: 'vertical' },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          const visited: (string | null)[] = [];
          for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowDown']) {
            await keyboard.press(key);
            visited.push(focusedKey(mounted));
          }
          expect(visited).toEqual(['pnpm', 'npm', 'yarn', 'npm']);
          await keyboard.press('ArrowRight');
          await keyboard.press('ArrowLeft');
          keys.stop();
          expect(focusedKey(mounted)).toBe('npm');
          expectShown(mounted, 'npm');
          expect(keys.prevented).toEqual({
            ArrowDown: true,
            ArrowUp: true,
            ArrowRight: false,
            ArrowLeft: false,
          });
          expect(changes(mounted)).toEqual(['pnpm', 'npm', 'yarn', 'npm']);
        },
        PHASE,
      );

      scenario(
        'right to left: ArrowLeft moves forward and ArrowRight back',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between([h('div', { dir: 'rtl' }, ...installation())]),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowLeft');
          expect(focusedKey(mounted)).toBe('pnpm');
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('npm');
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('yarn');
          expectShown(mounted, 'yarn');
          expect(changes(mounted)).toEqual(['pnpm', 'npm', 'yarn']);
        },
        PHASE,
      );

      scenario(
        'manual: the arrows, Home and End move focus only; Enter and Space select',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, keyboardActivation: 'manual' },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          // The shown tab is already selected: nothing to report.
          await keyboard.press('Enter');
          expect(changes(mounted)).toEqual([]);

          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('pnpm');
          await keyboard.press('End');
          expect(focusedKey(mounted)).toBe('yarn');
          await keyboard.press('Home');
          expect(focusedKey(mounted)).toBe('npm');
          await keyboard.press('ArrowLeft');
          expect(focusedKey(mounted)).toBe('yarn');
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);

          const keys = watchKeys(mounted);
          await keyboard.press('Enter');
          expectShown(mounted, 'yarn');
          await keyboard.press('ArrowLeft');
          await keyboard.press('Space');
          keys.stop();
          expectShown(mounted, 'pnpm');
          expect(focusedKey(mounted)).toBe('pnpm');
          expect(keys.prevented).toMatchObject({ Enter: true, ' ': true });
          expect(changes(mounted)).toEqual(['yarn', 'pnpm']);
        },
        PHASE,
      );

      scenario(
        'automatic: Enter and Space change nothing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          await keyboard.press('Enter');
          await keyboard.press('Space');
          expect(focusedKey(mounted)).toBe('pnpm');
          expectShown(mounted, 'pnpm');
          expect(changes(mounted)).toEqual(['pnpm']);
        },
        PHASE,
      );

      scenario(
        'arrows with Alt, Ctrl or Meta are left to the browser',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          for (const modifier of ['Alt', 'Control', 'Meta']) {
            const keys = watchKeys(mounted);
            await chord(keyboard, [modifier], 'ArrowRight');
            keys.stop();
            expect(keys.prevented.ArrowRight, modifier).toBe(false);
            expect(focusedKey(mounted), modifier).toBe('npm');
          }
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'printable characters and Delete are left alone: no typeahead, no closing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await tabIn(mounted, keyboard);
          const keys = watchKeys(mounted);
          await keyboard.press('p');
          await keyboard.press('y');
          await keyboard.press('Delete');
          keys.stop();
          expect(keys.prevented).toEqual({ p: false, y: false, Delete: false });
          expect(focusedKey(mounted)).toBe('npm');
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'keys scroll the focused tab into view in a list that scrolls',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: SCROLLING_TEMPLATE,
            props: { items: SCROLLING },
          });
          await tabIn(mounted, keyboard);
          const list = mounted.part('list');
          const isInView = (key: string) => {
            const box = list.getBoundingClientRect();
            const rect = tab(mounted, key).getBoundingClientRect();
            return rect.left >= box.left - 1 && rect.right <= box.right + 1;
          };
          expect(isInView('tab-7')).toBe(false);
          await keyboard.press('End');
          expect(list.scrollLeft).toBeGreaterThan(0);
          expect(isInView('tab-7')).toBe(true);
          await keyboard.press('Home');
          expect(list.scrollLeft).toBe(0);
          expect(isInView('tab-0')).toBe(true);
        },
        PHASE,
      );

      scenario(
        'keyboard focus shows focus-visible on the tab and the named parts',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation({ name: 'label' })),
            props: { items: MANAGERS },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          const pnpm = tab(mounted, 'pnpm');
          expect(pnpm.hasAttribute('data-focused')).toBe(true);
          expect(pnpm.hasAttribute('data-focus-visible')).toBe(true);
          expect(tab(mounted, 'npm').hasAttribute('data-focused')).toBe(false);
          expectOnEveryPart(mounted, 'data-focus-within', true);
          expectOnEveryPart(mounted, 'data-focus-visible', true);
          expect(mounted.state().isFocusVisible).toBe(true);
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'manual: focus rests where the arrows put it, and the tab stop goes back to the shown tab once focus leaves',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, keyboardActivation: 'manual' },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);
          expect(mounted.state().focusedKey).toBe('pnpm');

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(panel(mounted, 'npm'));
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);
          expect(mounted.state().focusedKey).toBe('npm');
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('npm');
        },
        PHASE,
      );

      scenario(
        'focus within is focus on a tab, not on a panel',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation({ name: 'label' })),
            props: { items: MANAGERS },
          });
          await tabIn(mounted, keyboard);
          expect(mounted.state().isFocusWithin).toBe(true);
          expectOnEveryPart(mounted, 'data-focus-within', true);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(panel(mounted, 'npm'));
          expect(mounted.state().isFocusWithin).toBe(false);
          expectOnEveryPart(mounted, 'data-focus-within', false);
        },
        PHASE,
      );

      scenario(
        'with every tab disabled the list has no tab stop, and Tab reaches the shown panel',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, disabledKeys: keysOf(MANAGERS) },
          });
          expect(tabStops(mounted)).toEqual(['-1', '-1', '-1']);
          await tabIn(mounted, keyboard);
          expect(activeElement(mounted)).toBe(panel(mounted, 'npm'));
        },
        PHASE,
      );

      scenario(
        'the focused tab disabled or removed: focus moves to the tab now shown',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('pnpm');
          await mounted.setProps({ disabledKeys: ['pnpm'] });
          await expect.poll(() => focusedKey(mounted)).toBe('npm');
          expect(mounted.state().selectedKey).toBe('npm');

          await keyboard.press('ArrowRight');
          expect(focusedKey(mounted)).toBe('yarn');
          await mounted.setProps({ items: MANAGERS.slice(0, 2) });
          await expect.poll(() => focusedKey(mounted)).toBe('npm');
          expect(mounted.state().selectedKey).toBe('npm');
          expect(mounted.state().focusedKey).toBe('npm');
        },
        PHASE,
      );

      scenario(
        'with focus outside the list, a value the consumer sets moves the tab stop and never focus',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, value: 'npm' },
          });
          byId(mounted, 'before').focus();
          await mounted.setProps({ value: 'yarn' });
          expect(tabStops(mounted)).toEqual(['-1', '-1', '0']);
          expect(activeElement(mounted)).toBe(byId(mounted, 'before'));
          await keyboard.tab();
          expect(focusedKey(mounted)).toBe('yarn');
        },
        PHASE,
      );

      scenario(
        'with focus in the list, a value the consumer sets leaves the tab stop on the focused tab until focus leaves',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS, value: 'npm' },
          });
          await tabIn(mounted, keyboard);
          await mounted.setProps({ value: 'yarn' });
          expect(mounted.state().selectedKey).toBe('yarn');
          expect(focusedKey(mounted)).toBe('npm');
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(panel(mounted, 'yarn'));
          expect(tabStops(mounted)).toEqual(['-1', '-1', '0']);
          await keyboard.tab({ isBackward: true });
          expect(focusedKey(mounted)).toBe('yarn');
        },
        PHASE,
      );
    });

    group('pointer and touch', () => {
      scenario(
        'a press focuses the tab on pointer down and selects on release over it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          const pnpm = tab(mounted, 'pnpm');
          await pointer.down(pnpm);
          expect(focusedKey(mounted)).toBe('pnpm');
          expect(pnpm.hasAttribute('data-pressed')).toBe(true);
          expect(pnpm.hasAttribute('data-focus-visible')).toBe(false);
          expect(selectedTabs(mounted)).toEqual(['npm']);
          expect(changes(mounted)).toEqual([]);
          await pointer.up();
          await expect.poll(() => selectedTabs(mounted)).toEqual(['pnpm']);
          expectShown(mounted, 'pnpm');
          expect(pnpm.hasAttribute('data-pressed')).toBe(false);
          expect(changes(mounted)).toEqual(['pnpm']);
        },
        PHASE,
      );

      scenario(
        'a press released over another tab selects nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await pointer.down(tab(mounted, 'pnpm'));
          await pointer.move(tab(mounted, 'yarn'));
          await pointer.up();
          await new Promise((resolve) => setTimeout(resolve, 100));
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a screen reader click selects',
        async ({ mount }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          tab(mounted, 'yarn').click();
          expectShown(mounted, 'yarn');
          expect(changes(mounted)).toEqual(['yarn']);
        },
        PHASE,
      );

      scenario(
        'middle and right clicks do nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await pointer.click(tab(mounted, 'pnpm'), { button: 'middle' });
          await pointer.click(tab(mounted, 'pnpm'), { button: 'right' });
          await new Promise((resolve) => setTimeout(resolve, 100));
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a press on a disabled tab does nothing and leaves focus where it was',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, disabledKeys: ['yarn'] },
            events: EVENTS,
          });
          await pointer.click(tab(mounted, 'pnpm'));
          mounted.clearEvents();
          await pointer.click(tab(mounted, 'yarn'));
          tab(mounted, 'yarn').click();
          expect(focusedKey(mounted)).toBe('pnpm');
          expectShown(mounted, 'pnpm');
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a press on a tab cut short by a list that scrolls scrolls nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: SCROLLING_TEMPLATE,
            props: { items: SCROLLING },
            events: EVENTS,
          });
          const list = mounted.part('list');
          await pointer.click(tab(mounted, 'tab-2'));
          await expect.poll(() => selectedTabs(mounted)).toEqual(['tab-2']);
          expect(focusedKey(mounted)).toBe('tab-2');
          expect(list.scrollLeft).toBe(0);
        },
        PHASE,
      );

      scenario(
        'a hovering mouse marks the tab, never a disabled one, and moves no focus',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS, disabledKeys: ['yarn'] },
          });
          await pointer.move(tab(mounted, 'pnpm'));
          expect(tab(mounted, 'pnpm').hasAttribute('data-hovered')).toBe(true);
          await pointer.move(tab(mounted, 'yarn'));
          expect(tab(mounted, 'pnpm').hasAttribute('data-hovered')).toBe(false);
          expect(tab(mounted, 'yarn').hasAttribute('data-hovered')).toBe(false);
          await pointer.move(tab(mounted, 'npm'));
          expect(tab(mounted, 'npm').hasAttribute('data-hovered')).toBe(true);
          expect(focusedKey(mounted)).toBe(null);
        },
        PHASE,
      );

      scenario(
        'touch: a tap selects on release and never hovers',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await touch.down(tab(mounted, 'pnpm'));
          expect(selectedTabs(mounted)).toEqual(['npm']);
          await touch.up();
          await expect.poll(() => selectedTabs(mounted)).toEqual(['pnpm']);
          expect(tab(mounted, 'pnpm').hasAttribute('data-hovered')).toBe(false);
          expect(changes(mounted)).toEqual(['pnpm']);
        },
        TOUCH,
      );

      scenario(
        'touch: a finger that moves off the tab, as a scroll does, selects nothing',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: installation(),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          await touch.down(tab(mounted, 'pnpm'));
          await touch.moveOutside(tab(mounted, 'pnpm'));
          await touch.up();
          await new Promise((resolve) => setTimeout(resolve, 100));
          expectShown(mounted, 'npm');
          expect(changes(mounted)).toEqual([]);
        },
        TOUCH,
      );
    });

    group('states', () => {
      scenario(
        'disabled: no tab stop in the list, nothing selects, every part marked, the shown panel stays',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: between(installation({ name: 'label' })),
            props: { items: MANAGERS, isDisabled: true },
            events: EVENTS,
          });
          for (const element of mounted.parts('tab')) {
            const key = element.dataset.key;
            expect(element.getAttribute('aria-disabled'), key).toBe('true');
            expect(element.getAttribute('tabindex'), key).toBe('-1');
            expect(element.hasAttribute('data-disabled'), key).toBe(true);
            expect(element.hasAttribute('disabled'), key).toBe(false);
          }
          for (const element of mounted.parts('panel')) {
            expect(element.hasAttribute('data-disabled')).toBe(true);
          }
          expectOnEveryPart(mounted, 'data-disabled', true);
          expectShown(mounted, 'npm');
          expect(panel(mounted, 'npm').getAttribute('tabindex')).toBe('0');
          expect(mounted.state().isDisabled).toBe(true);

          await tabIn(mounted, keyboard);
          expect(activeElement(mounted)).toBe(panel(mounted, 'npm'));
          await pointer.click(tab(mounted, 'pnpm'));
          tab(mounted, 'pnpm').click();
          expectShown(mounted, 'npm');
          expect(mounted.eventNames()).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'disabled tabs from disabledKeys or the item: marked and out of the tab order, never disabled',
        async ({ mount }) => {
          const items = [
            { key: 'npm' },
            { key: 'pnpm', isDisabled: true },
            { key: 'yarn' },
          ];
          const mounted = await mount({
            template: installation({ name: 'label' }),
            props: { items, disabledKeys: ['yarn'] },
          });
          for (const key of ['pnpm', 'yarn']) {
            const element = tab(mounted, key);
            expect(element.getAttribute('aria-disabled'), key).toBe('true');
            expect(element.hasAttribute('data-disabled'), key).toBe(true);
            expect(element.getAttribute('tabindex'), key).toBe('-1');
            expect(element.hasAttribute('disabled'), key).toBe(false);
          }
          expect(tab(mounted, 'npm').hasAttribute('aria-disabled')).toBe(false);
          expect(tab(mounted, 'npm').hasAttribute('data-disabled')).toBe(false);
          expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);
          expectOnEveryPart(mounted, 'data-disabled', false);
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'public state follows props, selection and focus',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
          });
          expect(mounted.state()).toEqual({
            value: null,
            selectedKey: 'npm',
            focusedKey: 'npm',
            isDisabled: false,
            isFocusWithin: false,
            isFocusVisible: false,
          });
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          expect(mounted.state()).toEqual({
            value: 'pnpm',
            selectedKey: 'pnpm',
            focusedKey: 'pnpm',
            isDisabled: false,
            isFocusWithin: true,
            isFocusVisible: true,
          });
          await keyboard.tab();
          await mounted.setProps({ isDisabled: true });
          expect(mounted.state().isDisabled).toBe(true);
        },
        PHASE,
      );

      scenario(
        'focus, hover, presses, keys and uncontrolled selection never re-render the owner',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: between(installation()),
            props: { items: MANAGERS },
            events: EVENTS,
          });
          const renders = mounted.renderCount();
          await tabIn(mounted, keyboard);
          await keyboard.press('ArrowRight');
          await keyboard.press('End');
          await keyboard.press('Home');
          await pointer.move(tab(mounted, 'yarn'));
          await pointer.click(tab(mounted, 'yarn'));
          await keyboard.tab();
          expect(changes(mounted)).toEqual(['pnpm', 'yarn', 'npm', 'yarn']);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the list with its name and orientation',
        async ({ mount, spoken }) => {
          await mount({ template: installation(), props: { items: MANAGERS } });
          expect(await spoken()).toContain(
            'tablist, Installation, orientated horizontally',
          );
        },
        PHASE,
      );

      scenario(
        'reads a list named by its label part',
        async ({ mount, spoken }) => {
          await mount({
            template: installation({ name: 'label' }),
            props: { items: MANAGERS },
          });
          expect(await spoken()).toContain(
            'tablist, Installation, orientated horizontally',
          );
        },
        PHASE,
      );

      scenario(
        'reads a vertical list',
        async ({ mount, spoken }) => {
          await mount({
            template: installation(),
            props: { items: MANAGERS, orientation: 'vertical' },
          });
          expect(await spoken()).toContain(
            'tablist, Installation, orientated vertically',
          );
        },
        PHASE,
      );

      scenario(
        'reads a list without a name',
        async ({ mount, spoken }) => {
          await mount({
            template: installation({ name: 'none' }),
            props: { items: MANAGERS },
          });
          expect(await spoken()).toContain('tablist, orientated horizontally');
        },
        PHASE,
      );

      scenario(
        'reads tabs with their state, their panel and their position',
        async ({ mount, spoken }) => {
          await mount({
            template: installation(),
            props: { items: MANAGERS, disabledKeys: ['yarn'] },
          });
          const phrases = await spoken();
          expect(phrases).toContain(
            'tab, npm, selected, 1 control, position 1, set size 3',
          );
          expect(phrases).toContain(
            'tab, pnpm, not selected, 1 control, position 2, set size 3',
          );
          expect(phrases).toContain(
            'tab, yarn, not selected, 1 control, disabled, position 3, set size 3',
          );
        },
        PHASE,
      );

      scenario(
        'a tab whose panel is not rendered reads no control',
        async ({ mount, spoken }) => {
          await mount({
            template: installation({ panels: ['npm'] }),
            props: { items: MANAGERS },
          });
          expect(await spoken()).toContain(
            'tab, pnpm, not selected, position 2, set size 3',
          );
        },
        PHASE,
      );

      scenario(
        'reads the shown panel by its tab, and no hidden panel',
        async ({ mount, spoken }) => {
          await mount({ template: installation(), props: { items: MANAGERS } });
          const phrases = await spoken();
          const start = phrases.indexOf('tabpanel, npm');
          const content = phrases.indexOf('Run npm install.');
          const end = phrases.indexOf('end of tabpanel, npm');
          expect(start).toBeGreaterThan(-1);
          expect(content).toBeGreaterThan(start);
          expect(end).toBeGreaterThan(content);
          expect(phrases).not.toContain('tabpanel, pnpm');
          expect(phrases).not.toContain('Run pnpm install.');
          expect(phrases).not.toContain('tabpanel, yarn');
        },
        PHASE,
      );
    });
  },
);
