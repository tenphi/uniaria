import { expect, it } from 'vitest';

import { createInstance } from '../../runtime';
import { form } from './form';
import type { FieldOptions, FieldRegistration } from './link';
import { toPath } from './values';
import type { Name } from './values';

/** A field as the form sees it, with no control: the checks a form runs itself. */
function fieldOf(name: Name, options: Partial<FieldOptions> = {}) {
  const registration: FieldRegistration = {
    path: toPath(name),
    options: () => ({
      validate: undefined,
      trigger: undefined,
      defaultTrigger: 'blur',
      delay: undefined,
      messages: { valueMissing: 'Required' },
      dependsOn: [],
      isEqual: undefined,
      shouldPreserve: true,
      hasDefault: false,
      defaultValue: undefined,
      isRequired: false,
      isDisabled: false,
      isReadOnly: false,
      kind: 'text',
      ...options,
    }),
    control: () => null,
    element: () => null,
    focusTarget: () => null,
    hasFocus: () => false,
    announcement: () => undefined,
    submitControls: () => [],
  };
  return registration;
}

function start(props: Record<string, unknown> = {}) {
  const instance = createInstance(form, { props: props as never });
  instance.start();
  return instance;
}

it('holds values before their fields register, and keeps them after', () => {
  const signup = start({ defaultValues: { email: 'a@b.c' } });
  const release = signup.api.register(fieldOf('email'));
  expect(signup.getState().fields.email).toMatchObject({
    value: 'a@b.c',
    isActive: true,
    isDirty: false,
  });
  release();
  expect(signup.getState().values).toEqual({ email: 'a@b.c' });
  expect(signup.getState().activeValues).toEqual({});
});

it('takes a field’s own default where the form has none', () => {
  const signup = start({ defaultValues: { name: 'Jane' } });
  signup.api.register(
    fieldOf('name', { hasDefault: true, defaultValue: 'Sam' }),
  );
  signup.api.register(
    fieldOf('nickname', { hasDefault: true, defaultValue: 'sammy' }),
  );
  expect(signup.getState().values).toEqual({ name: 'Jane', nickname: 'sammy' });
});

it('checks a program write as a user change would, and reports it only when asked', async () => {
  const changes: unknown[] = [];
  const signup = start({
    onValuesChange: (detail: unknown) => changes.push(detail),
  });
  signup.api.register(
    fieldOf('terms', { isRequired: true, defaultTrigger: 'change' }),
  );
  signup.actions.setValue('terms', false);
  expect(signup.getState().fields.terms).toMatchObject({
    status: 'invalid',
    errors: ['Required'],
    isTouched: false,
  });
  signup.actions.setValue('terms', true, { shouldNotify: true });
  await Promise.resolve();
  expect(signup.getState().fields.terms?.status).toBe('valid');
  expect(changes).toEqual([
    {
      values: { terms: true },
      names: ['terms'],
      source: 'program',
      kind: 'set',
    },
  ]);
});

it('submits the active values to handleSubmit', async () => {
  const sent: unknown[] = [];
  const signup = start({
    defaultValues: { email: 'a@b.c', draft: 'kept' },
    handleSubmit: (values: unknown) => {
      sent.push(values);
    },
  });
  signup.api.register(fieldOf('email', { isRequired: true }));
  await expect(signup.actions.submit()).resolves.toEqual({
    status: 'submitted',
  });
  expect(sent).toEqual([{ email: 'a@b.c' }]);
  expect(signup.getState().isSubmitting).toBe(false);
});

it('resolves invalid with the errors and calls no handleSubmit', async () => {
  let isCalled = false;
  const signup = start({ handleSubmit: () => (isCalled = true) });
  signup.api.register(fieldOf(['user', 'email'], { isRequired: true }));
  await expect(signup.actions.submit({ shouldFocus: false })).resolves.toEqual({
    status: 'invalid',
    errors: { 'user.email': ['Required'] },
  });
  expect(isCalled).toBe(false);
});

it('drops the result of a check that a later change made stale', async () => {
  const resolvers: ((result: unknown) => void)[] = [];
  const signup = start();
  signup.api.register(
    fieldOf('name', {
      defaultTrigger: 'change',
      validate: () => new Promise((resolve) => resolvers.push(resolve)),
    }),
  );
  signup.api.write(['name'], 'a');
  signup.api.write(['name'], 'ab');
  expect(signup.getState().fields.name?.status).toBe('validating');
  resolvers[0]!('Too short');
  resolvers[1]!(null);
  await new Promise((resolve) => setTimeout(resolve));
  expect(signup.getState().fields.name).toMatchObject({
    status: 'valid',
    errors: [],
  });
});

it('keeps server errors until the field is checked again', () => {
  const signup = start();
  signup.actions.setFieldErrors('email', ['Taken']);
  signup.api.register(fieldOf('email'));
  expect(signup.getState().fields.email?.errors).toEqual(['Taken']);
  signup.api.write(['email'], 'other@b.c');
  expect(signup.getState().fields.email?.errors).toEqual([]);
});

it('resets values, errors and touched to the defaults', () => {
  const signup = start({ defaultValues: { email: '' } });
  signup.api.register(fieldOf('email', { isRequired: true }));
  signup.api.write(['email'], 'a@b.c');
  signup.api.blurred('email');
  expect(signup.getState().isDirty).toBe(true);
  signup.actions.reset();
  expect(signup.getState()).toMatchObject({
    values: { email: '' },
    isDirty: false,
    isTouched: false,
    canReset: false,
  });
});
