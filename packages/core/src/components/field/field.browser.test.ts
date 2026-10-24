import { afterEach, expect, it, vi } from 'vitest';

import { createBinder } from '../../dom';
import { createInstance, defineBehavior, prop } from '../../runtime';
import type { AnyDefinition } from '../../runtime';
import { field } from './field';

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** Starts an instance with a DOM binder, as the adapters do. */
function start<D extends AnyDefinition>(
  definition: D,
  props: Record<string, unknown> = {},
) {
  const instance = createInstance(definition, { props: props as never });
  const binder = createBinder(instance);
  instance.start();
  binder.start();
  stops.push(() => {
    binder.stop();
    instance.stop();
  });
  const render = (part: string, tag: string, text = '') => {
    const element = document.createElement(tag);
    element.textContent = text;
    document.body.append(element);
    binder.attach(part, element);
    return element;
  };
  return { instance, binder, render };
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

// Not conformance scenarios: their markup is fixed when they mount.
it('links a part rendered after start, and unlinks one removed', () => {
  const { binder, render } = start(field);
  const control = render('control', 'input');
  expect(control.hasAttribute('aria-labelledby')).toBe(false);

  const label = render('label', 'label', 'Email');
  const description = render('description', 'p', 'We never share it');
  expect(control.getAttribute('aria-labelledby')).toBe(label.id);
  expect(control.getAttribute('aria-describedby')).toBe(description.id);

  binder.attach('description', null);
  expect(control.hasAttribute('aria-describedby')).toBe(false);
});

it('composes into an input, whose own part is the control', () => {
  const textInput = defineBehavior({
    name: 'test-text-input',
    parts: ['root', 'label', 'input', 'description', 'error'],
    props: { isInvalid: prop(false) },
    setup(ctx) {
      const inner = ctx.use(
        field,
        () => ({ isInvalid: ctx.props.isInvalid() }),
        { parts: { control: 'input' } },
      );
      return { field: inner };
    },
    expose: ({ api }) => api.field.state(),
    connect({ api }) {
      const { control, ...parts } = api.field.connect();
      return { ...parts, input: control };
    },
  });
  const { instance, render } = start(textInput, { isInvalid: true });
  const label = render('label', 'label', 'Email');
  const input = render('input', 'input');
  const error = render('error', 'p', 'Enter a valid email');

  expect(input.id).toBe(instance.ids.input);
  expect(label.getAttribute('for')).toBe(input.id);
  expect(input.getAttribute('aria-labelledby')).toBe(label.id);
  expect(input.getAttribute('aria-describedby')).toBe(error.id);
  // Marked as the composing definition's part, by its own name.
  expect(input.getAttribute('data-element')).toBe('Input');
  expect(instance.getState().isErrorShown).toBe(true);
});

it('warns when a label is rendered without a control', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { render } = start(field);
  render('label', 'label', 'Email');
  await nextTask();
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('without a control part'),
  );
});

it('stays silent when the control is rendered', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { render } = start(field);
  render('label', 'label', 'Email');
  render('control', 'input');
  await nextTask();
  expect(warn).not.toHaveBeenCalled();
});
