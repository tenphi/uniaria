/**
 * Listbox, Select and Combobox with the default styles, mounted through
 * both adapters with the same markup (spec: Testing → Components).
 */

import '@uniaria/elements/combobox';
import '@uniaria/elements/listbox';
import '@uniaria/elements/select';

import { combobox } from '@uniaria/core/combobox';
import { listbox } from '@uniaria/core/listbox';
import { select } from '@uniaria/core/select';
import { virtualizer } from '@uniaria/core/virtual';
import type { ComponentHandle } from '@uniaria/react';
import { useComponent, useComponentState } from '@uniaria/react';
import {
  emulateMedia,
  keyboard,
  pointer,
  releaseInput,
} from '@uniaria/testing/browser';
import { afterEach, describe, expect, test } from 'vitest';

import { addStyle, contrast, rgba } from './testing/browser';
import {
  flags,
  isChromium,
  mountHtml,
  mountReact,
  page,
  part,
  rootOf,
  settle,
  setUpPage,
  startOpening,
  style,
  tabInto,
  token,
  unmount,
} from './testing/harness';

interface ListboxProps {
  readonly value?: readonly string[];
  readonly isReadOnly?: boolean;
  readonly isEmpty?: boolean;
}

interface SelectProps {
  readonly value?: readonly string[];
}

interface Adapter {
  /** Each resolves to the component's root. */
  listbox(props?: ListboxProps): Promise<HTMLElement>;
  select(props?: SelectProps): Promise<HTMLElement>;
  combobox(): Promise<HTMLElement>;
  unmount(): void;
}

interface Item {
  readonly key: string;
  readonly textValue: string;
  readonly items?: readonly Item[];
}

const FRUITS: readonly Item[] = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  {
    key: 'citrus',
    textValue: 'Citrus',
    items: [{ key: 'lemon', textValue: 'Lemon' }],
  },
  { key: 'mango', textValue: 'Mango' },
];

const optionsHtml = (items: readonly Item[]): string =>
  items
    .map((item) =>
      item.items
        ? `<div data-element="Group" data-key="${item.key}">
            <span data-element="GroupLabel" data-key="${item.key}">${item.textValue}</span>
            ${optionsHtml(item.items)}
          </div>`
        : `<div data-element="Option" data-key="${item.key}">${item.textValue}</div>`,
    )
    .join('');

const LISTBOX = (props: ListboxProps) => `
  <uni-listbox disabled-keys='["cherry"]'${flags({ readonly: props.isReadOnly })}>
    <div data-uni="listbox">
      <span data-element="Label">Fruit</span>
      <div data-element="List">${props.isEmpty ? '' : optionsHtml(FRUITS)}</div>
      <p data-element="Empty">No fruit</p>
    </div>
  </uni-listbox>`;

const SELECT = `
  <uni-select placeholder="Pick a fruit">
    <div data-uni="select">
      <span data-element="Label">Fruit</span>
      <button data-element="Trigger"><span data-element="Value"></span></button>
      <div data-element="Popover">
        <div data-element="List">${optionsHtml(FRUITS)}</div>
      </div>
    </div>
  </uni-select>`;

const COMBOBOX = `
  <uni-combobox>
    <div data-uni="combobox">
      <label data-element="Label">Fruit</label>
      <div data-element="Anchor">
        <input data-element="Input" />
        <button data-element="Button"></button>
      </div>
      <div data-element="Popover">
        <div data-element="List">${optionsHtml(FRUITS)}</div>
        <p data-element="Empty">No fruit matches.</p>
      </div>
    </div>
  </uni-combobox>`;

/** Mounts markup and sets a value on its element before it settles. */
async function mountElement(
  html: string,
  value: readonly string[] | undefined,
): Promise<void> {
  page.container.innerHTML = html;
  if (value) {
    (
      page.container.firstElementChild as HTMLElement & { value: unknown }
    ).value = value;
  }
  await settle();
}

const elements: Adapter = {
  async listbox(props = {}) {
    await mountElement(LISTBOX(props), props.value);
    return rootOf('listbox');
  },
  async select(props = {}) {
    await mountElement(SELECT, props.value);
    return rootOf('select');
  },
  async combobox() {
    await mountHtml(COMBOBOX);
    return rootOf('combobox');
  },
  unmount,
};

type ItemProps = (
  part: 'option' | 'group' | 'groupLabel',
  key: string,
) => Record<string, unknown>;

function ReactOptions(props: {
  items: readonly Item[];
  getItemProps: ItemProps;
}) {
  return props.items.map((item) =>
    item.items ? (
      <div key={item.key} {...props.getItemProps('group', item.key)}>
        <span {...props.getItemProps('groupLabel', item.key)}>
          {item.textValue}
        </span>
        <ReactOptions items={item.items} getItemProps={props.getItemProps} />
      </div>
    ) : (
      <div key={item.key} {...props.getItemProps('option', item.key)}>
        {item.textValue}
      </div>
    ),
  );
}

function ReactListbox(props: ListboxProps) {
  const fruit = useComponent(listbox, {
    items: props.isEmpty ? [] : FRUITS,
    disabledKeys: ['cherry'],
    value: props.value,
    isReadOnly: props.isReadOnly,
  });
  return (
    <div {...fruit.parts.root}>
      <span {...fruit.parts.label}>Fruit</span>
      <div {...fruit.parts.list}>
        <ReactOptions
          items={props.isEmpty ? [] : FRUITS}
          getItemProps={fruit.getItemProps as ItemProps}
        />
      </div>
      <p {...fruit.parts.empty}>No fruit</p>
    </div>
  );
}

function ReactSelect(props: SelectProps) {
  const fruit = useComponent(select, {
    items: FRUITS,
    placeholder: 'Pick a fruit',
    value: props.value,
  });
  return (
    <div {...fruit.parts.root}>
      <span {...fruit.parts.label}>Fruit</span>
      <button {...fruit.parts.trigger}>
        <span {...fruit.parts.value} />
      </button>
      <div {...fruit.parts.popover}>
        <div {...fruit.parts.list}>
          <ReactOptions
            items={FRUITS}
            getItemProps={fruit.getItemProps as ItemProps}
          />
        </div>
      </div>
    </div>
  );
}

function ReactCombobox() {
  const fruit = useComponent(combobox, { items: FRUITS });
  return (
    <div {...fruit.parts.root}>
      <label {...fruit.parts.label}>Fruit</label>
      <div {...fruit.parts.anchor}>
        <input {...fruit.parts.input} />
        <button {...fruit.parts.button} />
      </div>
      <div {...fruit.parts.popover}>
        <div {...fruit.parts.list}>
          <ReactOptions
            items={FRUITS}
            getItemProps={fruit.getItemProps as ItemProps}
          />
        </div>
        <p {...fruit.parts.empty}>No fruit matches.</p>
      </div>
    </div>
  );
}

const react: Adapter = {
  async listbox(props = {}) {
    await mountReact(<ReactListbox {...props} />);
    return rootOf('listbox');
  },
  async select(props = {}) {
    await mountReact(<ReactSelect {...props} />);
    return rootOf('select');
  },
  async combobox() {
    await mountReact(<ReactCombobox />);
    return rootOf('combobox');
  },
  unmount,
};

const box = (element: Element) => element.getBoundingClientRect();

/** An option by its key, which its id ends with in either adapter. */
function option(root: Element, key: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(
    `[data-element="Option"][id$="-option-${key}"]`,
  );
  if (!element) throw new Error(`No ${key} option.`);
  return element;
}

/** The ring an element draws: its width, offset and contrast with the page. */
function ring(element: Element): {
  width: number;
  offset: number;
  contrast: number;
} {
  const { outlineWidth, outlineOffset, outlineColor } = style(element);
  return {
    width: parseFloat(outlineWidth),
    offset: parseFloat(outlineOffset),
    contrast: contrast(outlineColor, style(document.body).backgroundColor),
  };
}

/** Opens a select from its trigger and lets the popup settle. */
async function open(root: Element): Promise<HTMLElement> {
  await pointer.click(part(root, 'Trigger'));
  await settle();
  return part(root, 'Popover');
}

/** Types into the focused element, a key at a time. */
async function type(text: string): Promise<void> {
  for (const key of text) await keyboard.press(key);
  await settle();
}

setUpPage();

describe.each([
  ['elements', elements],
  ['react', react],
] as const)('%s', (_name, adapter) => {
  afterEach(async () => {
    await releaseInput();
    // Off the components, so the next one mounts unhovered.
    await pointer.move(page.sentinel);
    adapter.unmount();
  });

  describe('Listbox', () => {
    test("the list is a field's box, and options are 32-pixel rows of soft text", async () => {
      const root = await adapter.listbox();
      const list = part(root, 'List');
      expect(style(list).borderTopWidth).toBe('1px');
      expect(rgba(style(list).borderTopColor)).toEqual(rgba(token('border')));
      expect(rgba(style(list).backgroundColor)).toEqual(rgba(token('surface')));
      expect(style(list).paddingTop).toBe('4px');
      expect(style(list).borderTopLeftRadius).toBe('10px');
      const apple = option(root, 'apple');
      expect(box(apple).height).toBeCloseTo(32, 0);
      expect(box(apple).left - box(list).left).toBeCloseTo(5, 0);
      expect(rgba(style(apple).color)).toEqual(rgba(token('text-soft')));
      expect(style(apple, '::after').content).toBe('none');
      expect(style(part(root, 'GroupLabel')).fontSize).toBe('12px');
    });

    test('a selected option takes the accent theme and a check', async () => {
      const root = await adapter.listbox({ value: ['banana'] });
      const banana = option(root, 'banana');
      expect(rgba(style(banana).backgroundColor)).toEqual(
        rgba(token('accent-surface')),
      );
      expect(rgba(style(banana).color)).toEqual(rgba(token('accent-text')));
      const check = style(banana, '::after');
      expect(check.content).not.toBe('none');
      expect(check.borderRightWidth).toBe('2px');
      expect(rgba(check.borderRightColor)).toEqual(rgba(token('accent-text')));
      // The check sits at the end, clear of the text.
      expect(style(banana).paddingInlineEnd).toBe('20px');
    });

    test('an option lightens under the pointer, unless the list is read-only', async () => {
      let root = await adapter.listbox();
      await pointer.move(option(root, 'apple'));
      await settle();
      expect(rgba(style(option(root, 'apple')).backgroundColor)).toEqual(
        rgba(token('surface-hover')),
      );
      await pointer.move(page.sentinel);
      root = await adapter.listbox({ isReadOnly: true });
      await pointer.move(option(root, 'apple'));
      await settle();
      expect(rgba(style(option(root, 'apple')).backgroundColor)[3]).toBe(0);
    });

    test('keyboard focus rings the option, inside it, and not the list', async () => {
      const root = await adapter.listbox();
      await tabInto();
      const apple = option(root, 'apple');
      expect(document.activeElement).toBe(apple);
      expect(ring(apple).width).toBe(2);
      expect(ring(apple).offset).toBe(-2);
      expect(ring(apple).contrast).toBeGreaterThanOrEqual(3);
      expect(ring(part(root, 'List')).width).toBe(0);
    });

    test('an empty list shows its text and rings itself on keyboard focus', async () => {
      const root = await adapter.listbox({ isEmpty: true });
      const empty = part(root, 'Empty');
      expect(style(empty).display).not.toBe('none');
      expect(rgba(style(empty).color)).toEqual(rgba(token('text-soft')));
      await tabInto();
      expect(document.activeElement).toBe(part(root, 'List'));
      expect(ring(part(root, 'List')).width).toBe(2);
      expect(ring(part(root, 'List')).offset).toBe(1);
    });

    test('a disabled option takes the disabled text and no fill', async () => {
      const root = await adapter.listbox();
      const cherry = option(root, 'cherry');
      await pointer.move(cherry);
      await settle();
      expect(rgba(style(cherry).color)).toEqual(rgba(token('disabled-text')));
      expect(rgba(style(cherry).backgroundColor)[3]).toBe(0);
    });
  });

  describe('Select', () => {
    test('the trigger is a field box with a chevron and a soft placeholder', async () => {
      const root = await adapter.select();
      const trigger = part(root, 'Trigger');
      expect(box(trigger).height).toBeCloseTo(32, 0);
      expect(rgba(style(trigger).borderTopColor)).toEqual(
        rgba(token('border')),
      );
      expect(style(trigger, '::after').content).not.toBe('none');
      expect(rgba(style(part(root, 'Value')).color)).toEqual(
        rgba(token('text-soft')),
      );
      expect(style(part(root, 'Popover')).display).toBe('none');
    });

    test('the value keeps to one line and ends in an ellipsis', async () => {
      page.container.style.cssText = 'inline-size: 120px;';
      const root = await adapter.select({ value: ['banana'] });
      const value = part(root, 'Value');
      expect(rgba(style(value).color)).toEqual(rgba(token('text')));
      expect(style(value).whiteSpace).toBe('nowrap');
      expect(style(value).textOverflow).toBe('ellipsis');
      expect(box(value).right).toBeLessThan(box(part(root, 'Trigger')).right);
      page.container.removeAttribute('style');
    });

    test('the popup opens a gap below the trigger, at least as wide as it', async () => {
      const root = await adapter.select();
      const popover = await open(root);
      const trigger = box(part(root, 'Trigger'));
      expect(style(popover).display).toBe('flex');
      expect(popover.getAttribute('data-placement')).toBe('bottom');
      expect(box(popover).top - trigger.bottom).toBeCloseTo(8, 0);
      expect(box(popover).left).toBeCloseTo(trigger.left, 0);
      expect(box(popover).width).toBeGreaterThanOrEqual(trigger.width - 0.5);
      expect(rgba(style(popover).backgroundColor)).toEqual(
        rgba(token('surface')),
      );
      expect(style(popover).borderTopLeftRadius).toBe('10px');
      expect(style(popover).boxShadow).not.toBe('none');
      expect(style(popover).opacity).toBe('1');
      expect(box(option(root, 'apple')).height).toBeCloseTo(32, 0);
    });

    test('opening, the popup fades in from its hidden look', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.select();
      const popover = part(root, 'Popover');
      expect(await startOpening(part(root, 'Trigger'), root, popover)).toBe(0);
      expect(
        popover
          .getAnimations()
          .map((animation) => (animation as CSSTransition).transitionProperty),
      ).toEqual(expect.arrayContaining(['opacity', 'translate', 'scale']));
      expect(Number(style(popover).opacity)).toBeLessThan(0.5);
      await emulateMedia({ reducedMotion: null });
    });

    test('closing, the popup fades out before it hides', async () => {
      await emulateMedia({ reducedMotion: 'no-preference' });
      const root = await adapter.select();
      const popover = await open(root);
      await keyboard.press('Escape');
      await new Promise(requestAnimationFrame);
      expect(popover.hasAttribute('data-exiting')).toBe(true);
      expect(style(popover).display).toBe('flex');
      expect(
        popover
          .getAnimations()
          .map((animation) => (animation as CSSTransition).transitionProperty),
      ).toContain('opacity');
      await settle();
      await settle();
      expect(style(popover).display).toBe('none');
      await emulateMedia({ reducedMotion: null });
    });

    test('with reduced motion, the popup has no transition', async () => {
      await emulateMedia({ reducedMotion: 'reduce' });
      const popover = await open(await adapter.select());
      expect(
        style(popover)
          .transitionDuration.split(', ')
          .every((duration) => duration === '0s'),
      ).toBe(true);
      await emulateMedia({ reducedMotion: null });
    });

    test('the trigger rings on keyboard focus', async () => {
      const root = await adapter.select();
      await tabInto();
      expect(ring(part(root, 'Trigger')).width).toBe(2);
      expect(ring(part(root, 'Trigger')).contrast).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Combobox', () => {
    test('the anchor is the box, with the button inside it', async () => {
      const root = await adapter.combobox();
      const anchor = box(part(root, 'Anchor'));
      const button = box(part(root, 'Button'));
      expect(anchor.height).toBeCloseTo(32, 0);
      expect([button.width, button.height]).toEqual([24, 24]);
      expect(anchor.right - button.right).toBeCloseTo(
        button.top - anchor.top,
        1,
      );
      expect(style(part(root, 'Button'), '::before').content).not.toBe('none');
      expect(style(part(root, 'Input')).borderTopWidth).toBe('0px');
    });

    test('typing hides the options that no longer match', async () => {
      const root = await adapter.combobox();
      await pointer.click(part(root, 'Input'));
      await type('b');
      expect(style(part(root, 'Popover')).display).toBe('flex');
      expect(style(option(root, 'apple')).display).toBe('none');
      expect(box(option(root, 'banana')).height).toBeCloseTo(32, 0);
      expect(style(part(root, 'Empty')).display).toBe('none');
    });

    test('nothing matching shows the empty text', async () => {
      const root = await adapter.combobox();
      await pointer.click(part(root, 'Input'));
      await type('zz');
      const empty = part(root, 'Empty');
      expect(style(empty).display).not.toBe('none');
      expect(rgba(style(empty).color)).toEqual(rgba(token('text-soft')));
    });

    test('the keys ring the highlighted option, and the box keeps its ring', async () => {
      const root = await adapter.combobox();
      await tabInto();
      await keyboard.press('ArrowDown');
      await settle();
      const highlighted = root.querySelector(
        '[data-element="Option"][data-focused]',
      );
      expect(highlighted).not.toBeNull();
      expect(ring(highlighted!).width).toBe(2);
      expect(ring(part(root, 'Anchor')).width).toBe(2);
    });
  });

  describe('media', () => {
    afterEach(() => emulateMedia({ forcedColors: null }));

    test.runIf(isChromium)(
      'in forced colors, the check, the box and the ring stay visible',
      async () => {
        await emulateMedia({ forcedColors: 'active' });
        const page = style(document.body).backgroundColor;
        const root = await adapter.listbox({ value: ['banana'] });
        const check = style(option(root, 'banana'), '::after');
        expect(check.content).not.toBe('none');
        expect(check.borderRightColor).not.toBe(page);
        expect(style(part(root, 'List')).borderTopColor).not.toBe(page);
        await tabInto();
        expect(ring(document.activeElement!).width).toBe(2);
        expect(style(document.activeElement!).outlineColor).not.toBe(page);
      },
    );
  });
});

describe('a virtualized listbox', () => {
  let removeStyle: (() => void) | undefined;
  afterEach(() => {
    removeStyle?.();
    unmount();
  });

  const MANY = Array.from({ length: 200 }, (_, index) => ({
    key: `item-${index}`,
    textValue: `Item ${index}`,
  }));

  function Rows(props: { list: ComponentHandle<typeof listbox> }) {
    const keys = useComponentState(props.list, (state) => state.renderedKeys);
    return keys.map((key) => (
      <div key={key} {...props.list.getItemProps('option', key)}>
        {key}
      </div>
    ));
  }

  function VirtualListbox() {
    const list = useComponent(listbox, {
      items: MANY,
      virtualizer,
      itemSize: 32,
    });
    return (
      <div {...list.parts.root}>
        <div {...list.parts.scroller}>
          <div {...list.parts.list}>
            <Rows list={list} />
          </div>
        </div>
      </div>
    );
  }

  test('the scroller is the box, and options take the width inside it', async () => {
    removeStyle = addStyle(
      '[data-uni="listbox"] [data-element="Scroller"] { max-block-size: 10rem; }',
    );
    await mountReact(<VirtualListbox />);
    const root = rootOf('listbox');
    const scroller = part(root, 'Scroller');
    const list = part(root, 'List');
    expect(style(scroller).borderTopWidth).toBe('1px');
    expect(style(scroller).overflowY).toBe('auto');
    expect(style(list).borderTopWidth).toBe('0px');
    expect(style(list).paddingTop).toBe('0px');
    const first = box(option(root, 'item-0'));
    expect(first.left - box(scroller).left).toBeCloseTo(5, 0);
    expect(first.width).toBeCloseTo(box(list).width, 0);
    expect(first.height).toBeCloseTo(32, 0);
  });
});
