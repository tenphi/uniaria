import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { combobox } from './combobox';

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
];

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

/**
 * A started combo box in `markup`, its parts found by their markers and
 * its listeners delegated, as the custom element does, and an input after it.
 */
function start(markup: string, props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  const after = document.createElement('input');
  document.body.append(host, after);
  const instance = createInstance(combobox, {
    props: { items: FRUIT, ...props } as never,
    env: { document },
  });
  const binder = createBinder(instance, { host });
  for (const element of host.querySelectorAll<HTMLElement>('[data-element]')) {
    const part = element.dataset.element!;
    const name = part[0]!.toLowerCase() + part.slice(1);
    if (element.dataset.key)
      binder.attachItem(name, element.dataset.key, element);
    else binder.attach(name, element);
  }
  instance.start();
  binder.start();
  stops.push(() => {
    binder.stop();
    instance.stop();
  });
  const input = host.querySelector<HTMLInputElement>('[data-element="Input"]')!;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  };
  return { instance, input, after, type };
}

const PARTS = `
  <label data-element="Label">Fruit</label>
  <input data-element="Input" />
  <button data-element="Button">▾</button>
  <div data-element="Popover">
    <ul data-element="List">
      <li data-element="Option" data-key="apple">Apple</li>
      <li data-element="Option" data-key="banana">Banana</li>
      <li data-element="Option" data-key="cherry">Cherry</li>
    </ul>
  </div>`;

// Not a conformance scenario: its templates always render the root.
it('settles and closes as focus leaves, with no root rendered', () => {
  const focusChanges: boolean[] = [];
  const { instance, input, after, type } = start(PARTS, {
    onFocusChange: (isFocusWithin: boolean) => focusChanges.push(isFocusWithin),
  });
  input.focus();
  expect(instance.getState().isFocusWithin).toBe(true);
  expect(input.hasAttribute('data-focus-within')).toBe(true);

  type('che');
  expect(instance.getState().isOpen).toBe(true);
  after.focus();
  expect(instance.getState()).toMatchObject({
    value: ['cherry'],
    inputValue: 'Cherry',
    isOpen: false,
    isFocusWithin: false,
  });
  expect(focusChanges).toEqual([true, false]);
});

// Not a conformance scenario: no template has a focusable element around it.
it('a press in the popover outside an option keeps focus in the input, inside a focusable element too', async () => {
  const { instance, input, type } = start(
    `<div id="frame" tabindex="-1">${PARTS.replace(
      'data-element="Popover"',
      'data-element="Popover" style="padding: 10px"',
    )}</div>`,
  );
  input.focus();
  type('a');
  expect(instance.getState().isOpen).toBe(true);
  const popover = document.querySelector<HTMLElement>(
    '[data-element="Popover"]',
  )!;
  await userEvent.click(popover, { position: { x: 3, y: 3 } });
  expect(document.activeElement).toBe(input);
  expect(instance.getState().isOpen).toBe(true);
});
