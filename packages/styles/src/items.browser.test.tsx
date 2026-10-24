/**
 * The item look (items spec, The item look): Button's label and
 * description, a frame with extras, Popover's trigger parts, options with
 * labels and extras, and Select's trigger frame, mounted through both
 * adapters with the same markup (spec: Testing → Components).
 */

import '@uniaria/elements/button';
import '@uniaria/elements/listbox';
import '@uniaria/elements/popover';
import '@uniaria/elements/select';

import { button } from '@uniaria/core/button';
import { listbox } from '@uniaria/core/listbox';
import { popover } from '@uniaria/core/popover';
import { select } from '@uniaria/core/select';
import { useBehavior } from '@uniaria/react';
import { pointer, releaseInput } from '@uniaria/testing/browser';
import { afterEach, describe, expect, test } from 'vitest';

import { rgba } from './testing/browser';
import {
  mountHtml,
  mountReact,
  page,
  part,
  rootOf,
  settle,
  setUpPage,
  style,
  unmount,
} from './testing/harness';

interface ItemButtonProps {
  readonly variant?: 'primary' | 'quiet';
  /** An icon before the label and a hint after it. */
  readonly isDecorated?: boolean;
  readonly hasDescription?: boolean;
}

interface Adapter {
  /** A button with a label part; resolves to its root. */
  button(props?: ItemButtonProps): Promise<HTMLElement>;
  /** The same in a frame with a count and a quiet "Clear" extra. */
  framed(props?: ItemButtonProps): Promise<HTMLElement>;
  /** Popover's trigger with its label in a frame with a count. */
  popover(): Promise<HTMLElement>;
  listbox(): Promise<HTMLElement>;
  /** A selected value too long for its trigger, and a "Clear" extra. */
  select(): Promise<HTMLElement>;
  unmount(): void;
}

const LONG = 'A label long enough to end in an ellipsis';
const WIDTH = 'inline-size: 240px';

const ITEMS = [
  { key: 'apple', textValue: LONG },
  { key: 'banana', textValue: 'Banana with a name too long for the list' },
] as const;

const variantAttribute = (variant?: string) =>
  variant ? ` data-variant="${variant}"` : '';

/** The label, and the icon, hint and description it asks for. */
const contentHtml = (props: ItemButtonProps) => `
  ${props.isDecorated ? '<span class="icon" style="inline-size: 16px; block-size: 16px"></span>' : ''}
  <span data-element="Label">${LONG}</span>
  ${props.hasDescription ? '<span data-element="Description">Saves the file</span>' : ''}
  ${props.isDecorated ? '<kbd class="hint">⌘S</kbd>' : ''}`;

const CLEAR_HTML = `
  <span class="count">3</span>
  <uni-button><button data-uni="button" data-variant="quiet" aria-label="Clear">×</button></uni-button>`;

const elements: Adapter = {
  async button(props = {}) {
    await mountHtml(
      `<uni-button><button data-uni="button" style="${WIDTH}"${variantAttribute(props.variant)}>${contentHtml(props)}</button></uni-button>`,
    );
    return rootOf('button');
  },
  async framed(props = {}) {
    await mountHtml(`
      <uni-button>
        <div data-uni-part="button-frame" style="${WIDTH}">
          <button data-uni="button"${variantAttribute(props.variant)}>${contentHtml(props)}</button>
          <span data-uni-part="button-extras">${CLEAR_HTML}</span>
        </div>
      </uni-button>`);
    return rootOf('button');
  },
  async popover() {
    await mountHtml(`
      <uni-popover>
        <div data-uni-part="popover-trigger-frame" style="${WIDTH}">
          <button data-uni-part="popover-trigger">
            <span data-uni-part="popover-trigger-label">${LONG}</span>
          </button>
          <span data-uni-part="popover-trigger-extras"><span class="count">3</span></span>
        </div>
        <div data-uni="popover"><p data-element="Title">Fruit</p></div>
      </uni-popover>`);
    return page.container.querySelector<HTMLElement>(
      '[data-uni-part="popover-trigger"]',
    )!;
  },
  async listbox() {
    await mountHtml(`
      <uni-listbox>
        <div data-uni="listbox" style="${WIDTH}">
          <div data-element="List">
            <div data-element="Option" data-key="apple">
              <span data-element="OptionLabel" data-key="apple">${ITEMS[0].textValue}</span>
              <span data-element="OptionExtras" data-key="apple">New</span>
            </div>
            <div data-element="Option" data-key="banana">${ITEMS[1].textValue}</div>
          </div>
        </div>
      </uni-listbox>`);
    const root = rootOf('listbox');
    const host = root.parentElement as HTMLElement & { value: unknown };
    host.value = ['apple'];
    await settle();
    return root;
  },
  async select() {
    page.container.innerHTML = `
      <uni-select>
        <div data-uni="select" style="${WIDTH}">
          <span data-element="Label">Fruit</span>
          <div data-element="TriggerFrame">
            <button data-element="Trigger"><span data-element="Value"></span></button>
            <span data-element="TriggerExtras">${CLEAR_HTML}</span>
          </div>
          <div data-element="Popover">
            <div data-element="List">
              ${ITEMS.map((item) => `<div data-element="Option" data-key="${item.key}">${item.textValue}</div>`).join('')}
            </div>
          </div>
        </div>
      </uni-select>`;
    (
      page.container.firstElementChild as HTMLElement & { value: unknown }
    ).value = ['apple'];
    await settle();
    return rootOf('select');
  },
  unmount,
};

function ReactContent(props: {
  readonly parts: { label: object; description: object };
  readonly item: ItemButtonProps;
}) {
  return (
    <>
      {props.item.isDecorated && (
        <span className="icon" style={{ inlineSize: 16, blockSize: 16 }} />
      )}
      <span {...props.parts.label}>{LONG}</span>
      {props.item.hasDescription && (
        <span {...props.parts.description}>Saves the file</span>
      )}
      {props.item.isDecorated && <kbd className="hint">⌘S</kbd>}
    </>
  );
}

function ReactClear() {
  const clear = useBehavior(button, {});
  return (
    <>
      <span className="count">3</span>
      <button {...clear.parts.root} data-variant="quiet" aria-label="Clear">
        ×
      </button>
    </>
  );
}

function ReactButton(props: ItemButtonProps) {
  const { parts } = useBehavior(button, {});
  return (
    <button
      {...parts.root}
      style={{ inlineSize: 240 }}
      data-variant={props.variant}
    >
      <ReactContent parts={parts} item={props} />
    </button>
  );
}

function ReactFramed(props: ItemButtonProps) {
  const { parts } = useBehavior(button, {});
  return (
    <div {...parts.frame} style={{ inlineSize: 240 }}>
      <button {...parts.root} data-variant={props.variant}>
        <ReactContent parts={parts} item={props} />
      </button>
      <span {...parts.extras}>
        <ReactClear />
      </span>
    </div>
  );
}

function ReactPopover() {
  const { parts } = useBehavior(popover, {});
  return (
    <>
      <div {...parts.triggerFrame} style={{ inlineSize: 240 }}>
        <button {...parts.trigger}>
          <span {...parts.triggerLabel}>{LONG}</span>
        </button>
        <span {...parts.triggerExtras}>
          <span className="count">3</span>
        </span>
      </div>
      <div {...parts.root}>
        <p {...parts.title}>Fruit</p>
      </div>
    </>
  );
}

function ReactListbox() {
  const fruit = useBehavior(listbox, { items: ITEMS, value: ['apple'] });
  const item = fruit.getItemProps as (part: string, key: string) => object;
  return (
    <div {...fruit.parts.root} style={{ inlineSize: 240 }}>
      <div {...fruit.parts.list}>
        <div {...item('option', 'apple')}>
          <span {...item('optionLabel', 'apple')}>{ITEMS[0].textValue}</span>
          <span {...item('optionExtras', 'apple')}>New</span>
        </div>
        <div {...item('option', 'banana')}>{ITEMS[1].textValue}</div>
      </div>
    </div>
  );
}

function ReactSelect() {
  const fruit = useBehavior(select, { items: ITEMS, value: ['apple'] });
  const item = fruit.getItemProps as (part: string, key: string) => object;
  return (
    <div {...fruit.parts.root} style={{ inlineSize: 240 }}>
      <span {...fruit.parts.label}>Fruit</span>
      <div {...fruit.parts.triggerFrame}>
        <button {...fruit.parts.trigger}>
          <span {...fruit.parts.value} />
        </button>
        <span {...fruit.parts.triggerExtras}>
          <ReactClear />
        </span>
      </div>
      <div {...fruit.parts.popover}>
        <div {...fruit.parts.list}>
          {ITEMS.map((option) => (
            <div key={option.key} {...item('option', option.key)}>
              {option.textValue}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const react: Adapter = {
  async button(props = {}) {
    await mountReact(<ReactButton {...props} />);
    return rootOf('button');
  },
  async framed(props = {}) {
    await mountReact(<ReactFramed {...props} />);
    return rootOf('button');
  },
  async popover() {
    await mountReact(<ReactPopover />);
    return page.container.querySelector<HTMLElement>(
      '[data-uni-part="popover-trigger"]',
    )!;
  },
  async listbox() {
    await mountReact(<ReactListbox />);
    return rootOf('listbox');
  },
  async select() {
    await mountReact(<ReactSelect />);
    return rootOf('select');
  },
  unmount,
};

const box = (element: Element) => element.getBoundingClientRect();

const outside = (name: string) =>
  page.container.querySelector<HTMLElement>(`[data-uni-part="${name}"]`)!;

const isCut = (element: HTMLElement) =>
  style(element).textOverflow === 'ellipsis' &&
  element.scrollWidth > element.clientWidth;

/** The element a press at an element's center lands on. */
function hitAt(element: Element): Element | null {
  const { left, top, width, height } = box(element);
  return document.elementFromPoint(left + width / 2, top + height / 2);
}

setUpPage();

describe.each([
  ['elements', elements],
  ['react', react],
] as const)('%s', (_name, adapter) => {
  afterEach(async () => {
    await releaseInput();
    await pointer.move(page.sentinel);
    adapter.unmount();
    page.container.removeAttribute('dir');
  });

  describe('a button with a label part', () => {
    test('is the item grid: one line cut with an ellipsis, the icon before it and the hint after', async () => {
      const root = await adapter.button({ isDecorated: true });
      const label = part(root, 'Label');
      expect(style(root).display).toBe('inline-grid');
      expect(isCut(label)).toBe(true);
      expect(box(label).height).toBeCloseTo(20, 0);
      const icon = root.querySelector('.icon')!;
      const hint = root.querySelector('.hint')!;
      // Half a gap from the label on either side.
      expect(box(label).left - box(icon).right).toBeCloseTo(4, 0);
      expect(box(hint).left - box(label).right).toBeCloseTo(4, 0);
      expect(box(hint).right).toBeLessThanOrEqual(box(root).right);
      // One line: what sits beside the label adds no row.
      expect(box(root).height).toBeCloseTo(32, 0);
      expect(box(hint).top).toBeCloseTo(box(label).top, 0);
    });

    test('without an icon, the label starts at the padding', async () => {
      const root = await adapter.button();
      const padding =
        parseFloat(style(root).paddingInlineStart) +
        parseFloat(style(root).borderInlineStartWidth);
      expect(box(part(root, 'Label')).left - box(root).left).toBeCloseTo(
        padding,
        0,
      );
    });

    test('puts the description under the label, in small text', async () => {
      const root = await adapter.button({ hasDescription: true });
      const label = box(part(root, 'Label'));
      const description = part(root, 'Description');
      expect(box(description).top).toBeCloseTo(label.bottom, 0);
      expect(box(description).left).toBeCloseTo(label.left, 0);
      expect(style(description).fontSize).toBe('12px');
      expect(style(description).color).toBe(style(root).color);
    });
  });

  describe('a frame with extras', () => {
    test.each(['ltr', 'rtl'] as const)(
      'ends the label before the extras, which sit inside the button (%s)',
      async (direction) => {
        page.container.dir = direction;
        const root = await adapter.framed();
        const label = box(part(root, 'Label'));
        const extras = box(outside('button-extras'));
        const clear = box(outside('button-extras').querySelector('button')!);
        const button = box(root);
        // A 24-pixel extra is as far from the button's edge as from its
        // top and bottom.
        const inset = (button.height - clear.height) / 2;
        if (direction === 'ltr') {
          expect(label.right).toBeLessThanOrEqual(extras.left + 0.5);
          expect(button.right - clear.right).toBeCloseTo(inset, 0);
        } else {
          expect(label.left).toBeGreaterThanOrEqual(extras.right - 0.5);
          expect(clear.left - button.left).toBeCloseTo(inset, 0);
        }
        expect(button.width).toBeCloseTo(box(outside('button-frame')).width, 0);
        expect(extras.top).toBeGreaterThanOrEqual(button.top);
        expect(extras.bottom).toBeLessThanOrEqual(button.bottom);
      },
    );

    test('a count and the gaps press the button; an extra takes its own press', async () => {
      const root = await adapter.framed();
      const extras = outside('button-extras');
      expect(root.contains(hitAt(extras.querySelector('.count')!))).toBe(true);
      const clear = extras.querySelector('button')!;
      expect(hitAt(clear)).toBe(clear);
      const { left, top, height } = box(extras);
      // The extras' padding, before the count.
      expect(
        root.contains(document.elementFromPoint(left + 1, top + height / 2)),
      ).toBe(true);
    });

    test('the frame takes its button’s text color, so a quiet extra matches it', async () => {
      const root = await adapter.framed({ variant: 'primary' });
      const frame = outside('button-frame');
      const clear = outside('button-extras').querySelector('button')!;
      expect(rgba(style(frame).color)).toEqual(rgba(style(root).color));
      expect(rgba(style(clear).color)).toEqual(rgba(style(root).color));
    });

    test('a quiet extra mixes its hover fill from its text color', async () => {
      const root = await adapter.framed({ variant: 'primary' });
      const clear = outside('button-extras').querySelector('button')!;
      await pointer.move(clear);
      await settle();
      expect(clear.hasAttribute('data-hovered')).toBe(true);
      // Hover over an extra counts as the button's too.
      expect(root.hasAttribute('data-hovered')).toBe(true);
      const probe = document.createElement('span');
      probe.style.backgroundColor = `color-mix(in oklab, ${style(clear).color} 4%, transparent)`;
      document.body.append(probe);
      expect(rgba(style(clear).backgroundColor)).toEqual(
        rgba(style(probe).backgroundColor),
      );
      probe.remove();
    });
  });

  test('Popover’s trigger takes the item look from its outside parts', async () => {
    const trigger = await adapter.popover();
    const label = outside('popover-trigger-label');
    // A grid item, so blockified.
    expect(style(trigger).display).toBe('grid');
    expect(box(trigger).width).toBeCloseTo(
      box(outside('popover-trigger-frame')).width,
      0,
    );
    expect(isCut(label)).toBe(true);
    expect(box(label).right).toBeLessThanOrEqual(
      box(outside('popover-trigger-extras')).left + 0.5,
    );
  });

  describe('options', () => {
    test('cut their text, the label part’s or their own, with an ellipsis on one line', async () => {
      const root = await adapter.listbox();
      const [apple, banana] = root.querySelectorAll<HTMLElement>(
        '[data-element="Option"]',
      );
      expect(style(apple!).display).toBe('grid');
      expect(isCut(part(root, 'OptionLabel'))).toBe(true);
      expect(isCut(banana!)).toBe(true);
      expect(box(banana!).height).toBeCloseTo(32, 0);
    });

    test('put their extras after the label and before the check', async () => {
      const root = await adapter.listbox();
      const apple = part(root, 'Option');
      expect(apple.hasAttribute('data-selected')).toBe(true);
      const extras = box(part(root, 'OptionExtras'));
      expect(extras.left).toBeGreaterThanOrEqual(
        box(part(root, 'OptionLabel')).right,
      );
      // The check is in the end padding.
      expect(extras.right).toBeLessThanOrEqual(
        box(apple).right - parseFloat(style(apple).paddingInlineEnd) + 0.5,
      );
      expect(style(apple, '::after').content).not.toBe('none');
    });
  });

  test('Select’s trigger cuts its value before the extras, with the chevron after them', async () => {
    const root = await adapter.select();
    const trigger = part(root, 'Trigger');
    const value = part(root, 'Value');
    const extras = box(part(root, 'TriggerExtras'));
    expect(isCut(value)).toBe(true);
    expect(box(value).right).toBeLessThanOrEqual(extras.left + 0.5);
    expect(box(trigger).width).toBeCloseTo(
      box(part(root, 'TriggerFrame')).width,
      0,
    );
    const chevron = style(trigger, '::after');
    expect(chevron.content).not.toBe('none');
    // The chevron's margins and size, and the trigger's padding, after them.
    expect(box(trigger).right - extras.right).toBeGreaterThanOrEqual(
      parseFloat(chevron.marginInlineStart) +
        parseFloat(chevron.inlineSize) +
        parseFloat(chevron.marginInlineEnd),
    );
  });
});

test('Tooltip’s text keeps its line breaks', async () => {
  await mountHtml(
    '<div data-uni="tooltip"><span data-element="Text">Save\nSaves the file</span></div>',
  );
  expect(style(part(rootOf('tooltip'), 'Text')).whiteSpace).toBe('pre-line');
  unmount();
});
