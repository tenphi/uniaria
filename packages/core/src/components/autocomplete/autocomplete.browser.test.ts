import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { autocomplete } from './autocomplete';

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
  { key: 'date', textValue: 'Date' },
];

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  document.body.style.height = '';
  window.scrollTo(0, 0);
});

/**
 * A started inline autocomplete in `markup`, its parts found by their
 * markers and its listeners delegated, as the custom element does.
 */
function start(markup: string, props: Record<string, unknown> = {}) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  const instance = createInstance(autocomplete, {
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
  const option = (key: string) =>
    host.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  const highlighted = () => {
    const id = input.getAttribute('aria-activedescendant');
    return id ? (document.getElementById(id)?.dataset.key ?? null) : null;
  };
  return { instance, input, option, highlighted };
}

const PARTS = `
  <label data-element="Label">Fruit</label>
  <input data-element="Input" />
  <ul data-element="List">
    <li data-element="Option" data-key="apple">Apple</li>
    <li data-element="Option" data-key="banana">Banana</li>
    <li data-element="Option" data-key="cherry">Cherry</li>
    <li data-element="Option" data-key="date">Date</li>
  </ul>`;

it('a pointer resting on an option doesn’t highlight it when the page scrolls', async () => {
  // Room to scroll.
  document.body.style.height = '3000px';
  const { input, option, highlighted } = start(PARTS);
  // The pointer comes to rest where Date is while every option shows.
  await userEvent.hover(option('date'));
  input.focus();
  await userEvent.keyboard('ba');
  expect(option('date').hidden).toBe(true);
  await userEvent.keyboard('{ArrowDown}');
  expect(highlighted()).toBe('banana');
  await userEvent.keyboard('{Escape}');
  expect(option('date').hidden).toBe(false);
  expect(highlighted()).toBe(null);

  // WebKit sends a resting pointer a pointermove after a scroll (probed in
  // WebKit 26), as after a key scrolls an option into view.
  window.scrollBy(0, 1);
  window.scrollBy(0, -1);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(highlighted()).toBe(null);

  // The pointer's next real move highlights where it is.
  await userEvent.hover(option('cherry'));
  expect(highlighted()).toBe('cherry');
});
