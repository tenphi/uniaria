import { afterEach, expect, it } from 'vitest';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { textInput } from './text-input';

// TextInput has no element and no conformance suite of its own: TextField's
// covers it through composition (composition spec, Resolved questions 2).
// These cover what TextField never reaches: TextInput on its own.

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

/**
 * A started TextInput on an input in a form, its listeners delegated, as the
 * custom element does, and a field after it.
 */
function start(props: Record<string, unknown> = {}) {
  const form = document.createElement('form');
  const input = document.createElement('input');
  const after = document.createElement('input');
  form.append(input);
  document.body.append(form, after);
  const instance = createInstance(textInput, {
    props: props as never,
    env: { document },
  });
  const binder = createBinder(instance, { host: form });
  binder.attach('root', input);
  instance.start();
  binder.start();
  stops.push(() => {
    binder.stop();
    instance.stop();
  });
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText' }),
    );
  };
  const setProps = (next: Record<string, unknown>) => {
    instance.setProps({ ...instance.getProps(), ...next } as never);
    instance.sync();
  };
  return { instance, form, input, after, type, setProps };
}

/** Waits for the native reset and the write after it. */
const afterReset = () => new Promise((resolve) => setTimeout(resolve, 20));

it('marks its input as its root, with its state', () => {
  const { input, setProps } = start({ isReadOnly: true });
  expect(input.getAttribute('data-uni')).toBe('text-input');
  expect(input.readOnly).toBe(true);
  expect(input.hasAttribute('data-readonly')).toBe(true);

  input.focus();
  expect(input.hasAttribute('data-focused')).toBe(true);
  setProps({ isReadOnly: false, isDisabled: true });
  expect(input.disabled).toBe(true);
  expect(input.hasAttribute('data-disabled')).toBe(true);
});

it('uncontrolled, typing sets the value and reports it', () => {
  const changes: string[] = [];
  const { instance, input, type } = start({
    defaultValue: 'a',
    onValueChange: (value: string) => changes.push(value),
  });
  expect(input.value).toBe('a');
  type('ab');
  type('abc');
  expect(changes).toEqual(['ab', 'abc']);
  expect(instance.getState().value).toBe('abc');
  expect(input.value).toBe('abc');
});

it('controlled, the typed text stays until the consumer answers, and goes back on blur', () => {
  const changes: string[] = [];
  const { input, after, type, setProps } = start({
    value: 'x',
    onValueChange: (value: string) => changes.push(value),
  });
  input.focus();
  type('xy');
  expect(changes).toEqual(['xy']);
  expect(input.value).toBe('xy');
  setProps({ value: 'xy' });
  expect(input.value).toBe('xy');

  type('xyz');
  expect(input.value).toBe('xyz');
  after.focus();
  expect(input.value).toBe('xy');
});

it('controlled, a value the consumer transforms wins over the typed text', () => {
  const { input, type, setProps } = start({
    value: '',
    onValueChange: (value: string) => setProps({ value: value.toUpperCase() }),
  });
  type('ab');
  expect(input.value).toBe('AB');
});

it('revert() drops the typed text and writes the value back', () => {
  const { instance, input, type } = start({ value: 'x' });
  input.focus();
  type('xq');
  expect(input.value).toBe('xq');
  instance.api.revert();
  expect(input.value).toBe('x');
  expect(instance.api.text()).toBe('x');
});

it('a form reset goes back to defaultValue, one set after mount included', async () => {
  const changes: string[] = [];
  const { form, input, type, setProps } = start({
    onValueChange: (value: string) => changes.push(value),
  });
  setProps({ defaultValue: 'late' });
  expect(input.value).toBe('late');
  type('typed');
  form.reset();
  await afterReset();
  expect(input.value).toBe('late');
  expect(changes).toEqual(['typed', 'late']);
});

it('controlled without a default, a form reset asks for the value it mounted with', async () => {
  const changes: string[] = [];
  const { form, input, setProps } = start({
    value: 'first',
    onValueChange: (value: string) => changes.push(value),
  });
  setProps({ value: 'second' });
  form.reset();
  await afterReset();
  expect(changes).toEqual(['first']);
  // Unanswered, the value stays, written again after the native reset.
  expect(input.value).toBe('second');
});
