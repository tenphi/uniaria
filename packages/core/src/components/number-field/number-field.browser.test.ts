import { afterEach, expect, it } from 'vitest';

import { createBinder } from '../../dom';
import { createInstance } from '../../runtime';
import { numberField } from './number-field';

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});

const WIRED = [
  'keydown',
  'input',
  'focusin',
  'focusout',
  'compositionstart',
  'compositionend',
];

/** A started instance with its input attached and wired, as adapters do. */
function start(props: Record<string, unknown> = {}) {
  const instance = createInstance(numberField, { props: props as never });
  const binder = createBinder(instance);
  const input = document.createElement('input');
  document.body.append(input);
  binder.attach('input', input);
  instance.start();
  binder.start();
  cleanups.push(() => {
    binder.stop();
    instance.stop();
  });
  for (const type of WIRED) {
    input.addEventListener(type, (event) => {
      const on = instance.connect().input.on as Record<
        string,
        (event: Event) => void
      >;
      on[type]?.(event);
    });
  }
  return { instance, input };
}

/** Replaces a `navigator` property for one test. */
function fakeNavigator(property: string, value: unknown) {
  Object.defineProperty(navigator, property, { value, configurable: true });
  cleanups.push(() => {
    delete (navigator as unknown as Record<string, unknown>)[property];
  });
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

// Not conformance scenarios: the harness can't send IME input, a pinch zoom,
// or a phone's platform.
it('undoes a composition that leaves no number, at its end', () => {
  const { input } = start({ defaultValue: 12, locale: 'en-US' });
  input.focus();
  input.setSelectionRange(2, 2);
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  compose(input, '12に');
  // Mid-composition the text is left alone.
  expect(input.value).toBe('12に');
  input.dispatchEvent(new CompositionEvent('compositionend'));
  expect(input.value).toBe('12');
  expect(input.selectionStart).toBe(2);
});

it('keeps a composition that types digits', () => {
  const changes: unknown[] = [];
  const { input } = start({
    locale: 'en-US',
    onValueChange: (value: unknown) => changes.push(value),
  });
  input.focus();
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  compose(input, '１２');
  input.dispatchEvent(new CompositionEvent('compositionend'));
  expect(input.value).toBe('１２');
  input.blur();
  // Full-width digits are parsed, and kept in their numbering system.
  expect(changes).toEqual([12]);
  expect(input.value).toBe('１２');
});

it('leaves a pinch zoom (Ctrl+wheel) alone', () => {
  const { input, instance } = start({ defaultValue: 5, locale: 'en-US' });
  input.focus();
  const zoom = new WheelEvent('wheel', {
    deltaY: -100,
    ctrlKey: true,
    cancelable: true,
  });
  input.dispatchEvent(zoom);
  expect(zoom.defaultPrevented).toBe(false);
  expect(instance.getState().value).toBe(5);

  const scroll = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
  input.dispatchEvent(scroll);
  expect(scroll.defaultPrevented).toBe(true);
  expect(instance.getState().value).toBe(6);
});

it('on an iPhone, picks a keyboard with what can be typed and drops the role description', () => {
  fakeNavigator('platform', 'iPhone');
  const negative = start({ locale: 'en-US' });
  expect(negative.input.inputMode).toBe('text');
  expect(negative.input.hasAttribute('aria-roledescription')).toBe(false);

  const decimal = start({ locale: 'en-US', minValue: 0 });
  expect(decimal.input.inputMode).toBe('decimal');

  const whole = start({
    locale: 'en-US',
    minValue: 0,
    formatOptions: { maximumFractionDigits: 0 },
  });
  expect(whole.input.inputMode).toBe('numeric');
});

it('on Android, a numeric keyboard unless only decimals are needed', () => {
  fakeNavigator('platform', 'Linux armv81');
  fakeNavigator('userAgent', 'Mozilla/5.0 (Linux; Android 15) Mobile');
  expect(start({ locale: 'en-US' }).input.inputMode).toBe('numeric');
  expect(start({ locale: 'en-US', minValue: 0 }).input.inputMode).toBe(
    'decimal',
  );
  const { input } = start({ locale: 'en-US' });
  expect(input.getAttribute('aria-roledescription')).toBe('Number field');
});

it('formats for en-US and writes Android’s keyboard before the input is attached', () => {
  const instance = createInstance(numberField, {
    props: { defaultValue: 1234.5, minValue: 0 } as never,
  });
  const input = instance.connect().input;
  expect(input.properties?.value).toBe('1,234.5');
  expect(input.attrs.inputmode).toBe('decimal');
  expect(input.attrs['aria-roledescription']).toBe('Number field');
});

/** A started field with its hidden input in a form, read in each change. */
function inForm(props: Record<string, unknown>) {
  const form = document.createElement('form');
  const hidden = document.createElement('input');
  hidden.name = 'quantity';
  form.append(hidden);
  document.body.append(form);
  const submitted: unknown[] = [];
  const { input, instance } = start({
    locale: 'en-US',
    onValueChange: () => submitted.push(new FormData(form).get('quantity')),
    ...props,
  });
  const binder = createBinder(instance);
  binder.attach('hiddenInput', hidden);
  binder.start();
  cleanups.push(() => binder.stop());
  return { input, hidden, submitted };
}

// A conformance scenario can't read the form inside the component's own
// event: the harness records events after the fact.
it('has the value it reports in its form’s data inside valueChange', () => {
  const { input, submitted } = inForm({ defaultValue: 1 });
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  input.focus();
  input.value = '7';
  input.dispatchEvent(new InputEvent('input'));
  input.blur();
  expect(submitted).toEqual(['2', '7']);
});

it('puts back a controlled value the consumer didn’t take, after valueChange', () => {
  const { input, hidden, submitted } = inForm({ value: 1 });
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  expect(submitted).toEqual(['2']);
  expect(hidden.value).toBe('1');
});
