import { afterEach, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';

import { createBinder, destroyAnnouncer } from '../../dom';
import { createInstance } from '../../runtime';
import type { AnyDefinition, Instance } from '../../runtime';
import { textField } from '../text-field/text-field';
import { form } from './form';
import { formLink } from './link';

/** Real mouse input, from the commands `@uniaria/testing` registers. */
const mouse = commands as unknown as {
  uniPointerDown(selector: string, button: 'left'): Promise<void>;
  uniPointerMove(selector: string, where: 'center'): Promise<void>;
  uniPointerUp(button: 'left'): Promise<void>;
};

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  destroyAnnouncer(document);
  document.body.replaceChildren();
});

/** Starts `definition` on the parts in `host`, as the custom element does. */
function bind(
  definition: AnyDefinition,
  host: HTMLElement,
  props: Record<string, unknown> = {},
  own: (element: HTMLElement) => boolean = () => true,
) {
  const instance = createInstance(definition, {
    props: props as never,
    env: { document },
  });
  const binder = createBinder(instance, { host });
  const root = host.querySelector<HTMLElement>(
    `[data-uni="${definition.name}"]`,
  );
  if (root) binder.attach('root', root);
  for (const element of host.querySelectorAll<HTMLElement>('[data-element]')) {
    if (!own(element)) continue;
    const part = element.dataset.element!;
    binder.attach(part[0]!.toLowerCase() + part.slice(1), element);
  }
  return { instance, binder };
}

function start(
  ...bound: { instance: Instance; binder: { start(): void; stop(): void } }[]
) {
  for (const { instance, binder } of bound) {
    instance.start();
    binder.start();
    stops.push(() => {
      binder.stop();
      instance.stop();
    });
  }
}

function signup(
  formProps: Record<string, unknown> = {},
  fieldProps: Record<string, unknown> = {},
) {
  document.body.innerHTML = `
    <div id="form-host">
      <form data-uni="form" novalidate>
        <div id="email-field">
          <div data-uni="text-field">
            <label data-element="Label">Email</label>
            <input data-element="Input" type="email" />
            <p data-element="Error"><span data-element="ErrorText"></span></p>
          </div>
        </div>
        <button type="submit">Sign up</button>
      </form>
    </div>
    <button id="after">After</button>`;
  const formElement = document.querySelector<HTMLElement>('#form-host')!;
  const fieldElement = document.querySelector<HTMLElement>('#email-field')!;
  const owner = bind(form, formElement, formProps, () => false);
  const email = bind(textField, fieldElement, {
    name: 'email',
    isRequired: true,
    validationMessages: { valueMissing: 'Enter your email' },
    ...fieldProps,
  });
  email.instance.link(owner.instance, formLink);
  start(owner, email);
  return {
    form: owner.instance,
    email: email.instance,
    input: fieldElement.querySelector('input')!,
    error: fieldElement.querySelector<HTMLElement>('[data-element="Error"]')!,
    errorText: fieldElement.querySelector<HTMLElement>(
      '[data-element="ErrorText"]',
    )!,
    submit: document.querySelector<HTMLButtonElement>('button[type="submit"]')!,
  };
}

it('holds the field value under its name', async () => {
  const { form: owner, input } = signup({ defaultValues: { email: 'a@b.c' } });
  expect(input.value).toBe('a@b.c');
  expect(input.name).toBe('email');
  input.select();
  await userEvent.keyboard('x@y.z');
  expect((owner.getState() as { values: unknown }).values).toEqual({
    email: 'x@y.z',
  });
});

it('checks on blur and shows the first error', async () => {
  const { input, error, errorText } = signup();
  input.focus();
  expect(error.hidden).toBe(true);
  await userEvent.tab();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(error.hidden).toBe(false);
  expect(errorText.textContent).toBe('Enter your email');
  input.focus();
  await userEvent.keyboard('a@b.c');
  expect(input.hasAttribute('aria-invalid')).toBe(false);
  expect(error.hidden).toBe(true);
});

it('focuses the first invalid field after a failed submit', async () => {
  let failed: unknown;
  const { input, submit } = signup({
    onSubmitFailed: (detail: unknown) => (failed = detail),
  });
  await userEvent.click(submit);
  await expect.poll(() => document.activeElement).toBe(input);
  expect(failed).toEqual({
    status: 'invalid',
    errors: { email: ['Enter your email'] },
  });
});

it('calls handleSubmit with the active values', async () => {
  const submitted: unknown[] = [];
  const { input, submit } = signup({
    handleSubmit: (values: unknown) => {
      submitted.push(values);
    },
  });
  input.focus();
  await userEvent.keyboard('a@b.c');
  await userEvent.click(submit);
  await expect.poll(() => submitted).toEqual([{ email: 'a@b.c' }]);
});

it('checks the native constraints of the control', async () => {
  const { input, errorText } = signup();
  input.focus();
  await userEvent.keyboard('nope');
  await userEvent.tab();
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(errorText.textContent).not.toBe('');
});

it('resets the value and errors on a native reset', async () => {
  const {
    form: owner,
    input,
    error,
  } = signup({
    defaultValues: { email: 'a@b.c' },
  });
  input.select();
  await userEvent.keyboard('{Backspace}');
  await userEvent.tab();
  expect(error.hidden).toBe(false);
  (document.querySelector('form') as HTMLFormElement).reset();
  await expect.poll(() => input.value).toBe('a@b.c');
  expect(error.hidden).toBe(true);
  expect((owner.getState() as { isDirty: boolean }).isDirty).toBe(false);
});

it('submits on a press on Submit while a field that checks on blur has focus', async () => {
  const { input, submit, error } = signup({ handleSubmit: () => undefined });
  input.focus();
  await userEvent.click(submit);
  // The blur's check waits for the press, so the button stays put and the
  // submit focuses the field.
  await expect.poll(() => document.activeElement).toBe(input);
  expect(error.hidden).toBe(false);
});

it('checks on blur once a press on Submit ends elsewhere', async () => {
  const { input, submit, error } = signup();
  input.focus();
  submit.id = 'submit';
  await mouse.uniPointerDown('#submit', 'left');
  expect(error.hidden).toBe(true);
  await mouse.uniPointerMove('#after', 'center');
  await mouse.uniPointerUp('left');
  await expect.poll(() => error.hidden).toBe(false);
});
