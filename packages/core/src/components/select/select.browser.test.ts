import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

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
function start(
  markup: string,
  props: Record<string, unknown> = {},
  container: ParentNode = document.body,
) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  const after = document.createElement('input');
  container.append(host);
  document.body.append(after);
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

const REQUIRED = (name: string) =>
  `<button type="button" data-element="Trigger"><span data-element="Value"></span></button>
  <select data-element="HiddenSelect" name="${name}"></select>
  <div data-element="Popover"><div data-element="List"></div></div>`;

/**
 * A form with `controls`, a submit button and two required selects with no
 * value, and the triggers focus lands on.
 */
function invalidForm(controls = '') {
  const form = document.createElement('form');
  form.innerHTML = `${controls}<button>Submit</button>`;
  form.addEventListener('submit', (event) => event.preventDefault());
  document.body.append(form);
  const first = start(REQUIRED('first'), { isRequired: true }, form);
  const second = start(REQUIRED('second'), { isRequired: true }, form);
  const focusedTriggers: Element[] = [];
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target as Element;
    if (target.matches('[data-element="Trigger"]')) {
      focusedTriggers.push(target);
    }
  };
  document.addEventListener('focusin', onFocusIn);
  stops.push(() => document.removeEventListener('focusin', onFocusIn));
  return { form, first, second, focusedTriggers };
}

// Every invalid control gets `invalid`, and focus went through each
// select's trigger on its way to the first.
it('focuses only the first invalid select when a submit reports it', async () => {
  const { form, first, focusedTriggers } = invalidForm();
  await userEvent.click(form.querySelector('button')!);
  await expect.poll(() => document.activeElement).toBe(first.part('Trigger'));
  expect(focusedTriggers).toEqual([first.part('Trigger')]);
  // As React Aria: focus shows, though a pointer submitted.
  expect(first.part('Trigger').hasAttribute('data-focus-visible')).toBe(true);
});

it('leaves focus on the first invalid control when it is not a select', () => {
  const { form, focusedTriggers } = invalidForm('<input required />');
  form.requestSubmit();
  expect(document.activeElement).toBe(form.querySelector('input'));
  expect(focusedTriggers).toEqual([]);
});

// The last invalid select took focus.
it('moves no focus on checkValidity()', () => {
  const { form, first, focusedTriggers } = invalidForm();
  first.after.focus();
  expect(form.checkValidity()).toBe(false);
  expect(document.activeElement).toBe(first.after);
  expect(focusedTriggers).toEqual([]);
});
