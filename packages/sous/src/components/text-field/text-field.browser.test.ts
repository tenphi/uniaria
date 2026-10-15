import { afterEach, expect, it } from 'vitest';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { textField } from './text-field';

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

/** A started instance with its input attached and wired, as adapters do. */
function start(props: Record<string, unknown> = {}) {
  const instance = createInstance(textField, { props: props as never });
  const binder = createBinder(instance);
  const input = document.createElement('input');
  document.body.append(input);
  binder.attach('input', input);
  instance.start();
  binder.start();
  stops.push(() => {
    binder.stop();
    instance.stop();
  });
  for (const type of ['input', 'compositionstart', 'compositionend']) {
    input.addEventListener(type, (event) => {
      const on = instance.connect().input.on as Record<
        string,
        (event: Event) => void
      >;
      on[type]?.(event);
    });
  }
  const setProps = (next: Record<string, unknown>) => {
    instance.setProps({ ...instance.getProps(), ...next } as never);
    instance.sync();
  };
  return { instance, input, setProps };
}

/** What the browser does for one IME step: new text, then `input`. */
function compose(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(
    new InputEvent('input', {
      isComposing: true,
      inputType: 'insertCompositionText',
    }),
  );
}

// Not a conformance scenario: the harness can't send IME input.
it('reports composition text but never writes the value mid-composition', () => {
  const changes: string[] = [];
  const { input, setProps } = start({
    value: '',
    onValueChange: (value: string) => changes.push(value),
  });

  input.dispatchEvent(new CompositionEvent('compositionstart'));
  compose(input, 'に');
  compose(input, 'にほ');
  expect(changes).toEqual(['に', 'にほ']);

  // A value from outside arrives mid-composition: it waits.
  setProps({ value: 'x' });
  expect(input.value).toBe('にほ');

  input.dispatchEvent(new CompositionEvent('compositionend'));
  expect(input.value).toBe('x');
});
