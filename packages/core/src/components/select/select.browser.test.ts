import { afterEach, expect, it } from 'vitest';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { select } from './select';

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
];

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

/**
 * A started select in `markup`, its parts found by their markers and its
 * listeners delegated, as the custom element does, and an input after it.
 */
function start(markup: string, props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  const after = document.createElement('input');
  document.body.append(host, after);
  const instance = createInstance(select, {
    props: { items: FRUIT, ...props } as never,
    env: { document },
  });
  const binder = createBinder(instance, { host });
  for (const element of host.querySelectorAll<HTMLElement>('[data-element]')) {
    const part = element.dataset.element!;
    const name = part[0]!.toLowerCase() + part.slice(1);
    if (element.dataset.key) {
      binder.attachItem(name, element.dataset.key, element);
    } else {
      binder.attach(name, element);
    }
  }
  instance.start();
  binder.start();
  stops.push(() => {
    binder.stop();
    instance.stop();
  });
  const part = (name: string) =>
    host.querySelector<HTMLElement>(`[data-element="${name}"]`)!;
  return { instance, part, after };
}

// Not a conformance scenario: its templates always render the root.
it('tracks focus on the trigger and in the popup, with no root rendered', async () => {
  const focusChanges: boolean[] = [];
  const { instance, part, after } = start(
    `<span data-element="Label">Fruit</span>
    <button data-element="Trigger"><span data-element="Value"></span></button>
    <div data-element="Popover">
      <div data-element="List">
        <div data-element="Option" data-key="apple">Apple</div>
        <div data-element="Option" data-key="banana">Banana</div>
      </div>
    </div>`,
    {
      onFocusChange: (isFocusWithin: boolean) =>
        focusChanges.push(isFocusWithin),
    },
  );
  part('Trigger').focus();
  expect(instance.getState().isFocusWithin).toBe(true);
  expect(part('Trigger').hasAttribute('data-focus-within')).toBe(true);

  // Focus moves into the list and back to the trigger, staying within.
  instance.actions.open();
  await expect.poll(() => document.activeElement).toBe(part('Option'));
  instance.actions.close();
  expect(document.activeElement).toBe(part('Trigger'));

  after.focus();
  expect(instance.getState().isFocusWithin).toBe(false);
  expect(focusChanges).toEqual([true, false]);
});

it('writes its state attributes on the anchor, as on every named part', () => {
  const { part } = start(
    `<div data-element="Anchor">
      <button data-element="Trigger"><span data-element="Value"></span></button>
    </div>
    <div data-element="Popover"><div data-element="List"></div></div>`,
    { isDisabled: true },
  );
  expect(part('Anchor').hasAttribute('data-disabled')).toBe(true);
  expect(part('Anchor').hasAttribute('data-placeholder')).toBe(true);
});
