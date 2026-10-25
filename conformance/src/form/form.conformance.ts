/**
 * Form conformance, from the spec approved by @tenphi on 2026-10-24
 * (`packages/core/src/components/form/spec.md`): the form and its error
 * part; every field kind binding by name, from `defaultValues` or its own
 * default; typing that changes the form's values and renders nothing; the
 * checks (required, native constraints, `validate`, sync and async, on
 * each trigger, with `dependsOn`), shown through the fields' Field and
 * cleared as soon as they are fixed; submitting with and without
 * `handleSubmit`, with real presses and Enter, and the native post;
 * focus after a failed submit; resetting; program writes and server
 * errors; public state; announcements and spoken output. Everything here
 * is phase 7.
 *
 * The fields are nested components, each named by a `data-field`
 * attribute on its root. Message text is pinned with `validationMessages`,
 * since browsers word their own messages differently. A scenario that may
 * submit a valid form passes `handleSubmit`, or posts into an iframe, so
 * the test page never navigates.
 */

import { defineConformance, h, nested, partSelector } from '@uniaria/testing';
import type {
  KeyboardInput,
  Mounted,
  TemplateAttrs,
  TemplateComponent,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type {
  FormFieldState,
  FormProps,
  FormState,
  FormSubmitContext,
  FormSubmitFailedDetail,
  FormSubmittedDetail,
  FormValidateResult,
  FormValues,
  FormValuesChangeDetail,
} from './types';

type MountedForm = Mounted<FormProps, FormState>;

type Props = Readonly<Record<string, unknown>>;

const PHASE = { phase: 7 } as const;

const EVENTS = ['submitted', 'submitFailed', 'valuesChange'];

/** The root's state attributes, none of them set on an idle form. */
const ROOT_STATE = [
  'data-submitting',
  'data-invalid',
  'data-dirty',
  'data-validating',
  'data-disabled',
  'data-readonly',
];

/** The part each field kind is focused through and holds its value in. */
const CONTROL: Readonly<Record<string, string>> = {
  'text-field': 'input',
  'number-field': 'input',
  checkbox: 'input',
  switch: 'input',
  field: 'control',
  select: 'trigger',
};

const FRUIT = [
  { key: 'apple', textValue: 'Apple' },
  { key: 'banana', textValue: 'Banana' },
  { key: 'cherry', textValue: 'Cherry' },
];

/** The error part inside a field, with the error text part Field fills. */
const fieldError = () =>
  h('p', { part: 'error' }, h('span', { part: 'errorText' }));

/** A TextField: a label, the input and the error. */
function textField(
  key: string,
  label: string,
  props: Props = {},
  input: TemplateAttrs = {},
): TemplateComponent {
  return nested(
    'text-field',
    { name: key, ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h('label', { part: 'label' }, label),
      h('input', { part: 'input', ...input }),
      fieldError(),
    ),
  );
}

/** A NumberField in English, with both buttons and its hidden input. */
function numberField(
  key: string,
  label: string,
  props: Props = {},
): TemplateComponent {
  return nested(
    'number-field',
    { name: key, ...props },
    h(
      'div',
      { part: 'root', lang: 'en-US', 'data-field': key },
      h('label', { part: 'label' }, label),
      h(
        'div',
        { part: 'wrapper' },
        h('input', { part: 'input' }),
        h('button', { part: 'decrement' }, '−'),
        h('button', { part: 'increment' }, '+'),
      ),
      h('input', { part: 'hiddenInput' }),
      fieldError(),
    ),
  );
}

/** A Checkbox: a `label` wrapper around its input and label, and the error. */
function checkbox(
  key: string,
  label: string,
  props: Props = {},
): TemplateComponent {
  return nested(
    'checkbox',
    { name: key, labelElementType: 'span', ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h(
        'label',
        { part: 'wrapper' },
        h('input', { part: 'input', type: 'checkbox' }),
        h('span', { part: 'label' }, label),
      ),
      fieldError(),
    ),
  );
}

/** A Switch, laid out as the checkbox is, with an indicator. */
function toggleSwitch(
  key: string,
  label: string,
  props: Props = {},
): TemplateComponent {
  return nested(
    'switch',
    { name: key, labelElementType: 'span', ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h(
        'label',
        { part: 'wrapper' },
        h('input', { part: 'input', type: 'checkbox' }),
        h('span', { part: 'indicator' }, '•'),
        h('span', { part: 'label' }, label),
      ),
      fieldError(),
    ),
  );
}

/** An option of a group: `[value, label]`, and the option's own props. */
type Option = readonly [value: string, label: string, props?: Props];

/** A CheckboxGroup: its label, a checkbox per option, and the error. */
function checkboxGroup(
  key: string,
  label: string,
  options: readonly Option[],
  props: Props = {},
): TemplateComponent {
  return nested(
    'checkbox-group',
    { name: key, ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h('span', { part: 'label' }, label),
      ...options.map(([value, text, option = {}]) =>
        nested(
          'checkbox',
          { value, labelElementType: 'span', ...option },
          h(
            'label',
            { part: 'root', 'data-option': value },
            h('input', { part: 'input', type: 'checkbox' }),
            h('span', { part: 'label' }, text),
          ),
        ),
      ),
      fieldError(),
    ),
  );
}

/** A RadioGroup: its label, a radio per option, and the error. */
function radioGroup(
  key: string,
  label: string,
  options: readonly Option[],
  props: Props = {},
): TemplateComponent {
  return nested(
    'radio-group',
    { name: key, ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h('span', { part: 'label' }, label),
      ...options.map(([value, text, option = {}]) =>
        nested(
          'radio',
          { value, labelElementType: 'span', ...option },
          h(
            'label',
            { part: 'root', 'data-option': value },
            h('input', { part: 'input', type: 'radio' }),
            h('span', { part: 'indicator' }),
            h('span', { part: 'label' }, text),
          ),
        ),
      ),
      fieldError(),
    ),
  );
}

/**
 * A Select of fruit: the label, the trigger with the value part, the
 * error, the popover with the list, and the hidden `<select>`.
 */
function select(
  key: string,
  label: string,
  props: Props = {},
): TemplateComponent {
  return nested(
    'select',
    { name: key, items: FRUIT, ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h('span', { part: 'label' }, label),
      h('button', { part: 'trigger' }, h('span', { part: 'value' })),
      fieldError(),
      h(
        'div',
        { part: 'popover' },
        h(
          'ul',
          { part: 'list' },
          ...FRUIT.map((item) =>
            h('li', { part: 'option', 'data-key': item.key }, item.textValue),
          ),
        ),
        h('p', { part: 'empty' }, 'No fruit'),
      ),
      h('select', { part: 'hiddenSelect' }),
    ),
  );
}

/** Field alone around a native input, its control. */
function field(
  key: string,
  label: string,
  props: Props = {},
): TemplateComponent {
  return nested(
    'field',
    { name: key, ...props },
    h(
      'div',
      { part: 'root', 'data-field': key },
      h('label', { part: 'label' }, label),
      h('input', { part: 'control' }),
      fieldError(),
    ),
  );
}

const SUBMIT = h('button', { type: 'submit', id: 'submit' }, 'Submit');
const RESET = h('button', { type: 'reset', id: 'reset' }, 'Reset');

/** A form that posts into an iframe, so a native post leaves the page. */
const POSTS_TO_SINK = { action: 'about:blank', target: 'form-sink' };
const SINK = h('iframe', { name: 'form-sink', title: 'Form sink' });

interface SignUpOptions {
  /** Attributes on the `<form>`. */
  readonly attrs?: TemplateAttrs;
  /** Attributes on the form's error part. */
  readonly errorAttrs?: TemplateAttrs;
  /** The buttons at the end of the form. */
  readonly buttons?: readonly TemplateNode[];
  /** Markup after the form. */
  readonly after?: readonly TemplateNode[];
}

/**
 * The spec's form: a `<form>` named by its heading "Sign up", the fields,
 * the error part, Submit and Reset; `#before` and `#after` text fields
 * around it.
 */
function signUp(
  fields: readonly TemplateNode[],
  {
    attrs = {},
    errorAttrs = {},
    buttons = [SUBMIT, RESET],
    after = [],
  }: SignUpOptions = {},
): TemplateNode[] {
  return [
    h('input', { id: 'before', 'aria-label': 'Before' }),
    h(
      'form',
      { part: 'root', 'aria-labelledby': 'signup-title', ...attrs },
      h('h2', { id: 'signup-title' }, 'Sign up'),
      ...fields,
      h('p', { part: 'error', ...errorAttrs }, 'Could not sign up'),
      ...buttons,
    ),
    h('input', { id: 'after', 'aria-label': 'After' }),
    ...after,
  ];
}

function formOf(mounted: MountedForm): HTMLFormElement {
  return mounted.part('root') as HTMLFormElement;
}

function byId(mounted: MountedForm, id: string): HTMLElement {
  const element = mounted.container.querySelector<HTMLElement>(`#${id}`);
  if (!element) throw new Error(`No #${id} in the page`);
  return element;
}

/** A part of the field whose root has `data-field="<key>"`. */
function fieldPart(
  mounted: MountedForm,
  key: string,
  part = 'root',
): HTMLElement {
  const root = mounted.container.querySelector<HTMLElement>(
    `[data-field="${key}"]`,
  );
  if (!root) throw new Error(`No field "${key}" in the page`);
  if (part === 'root') return root;
  const component = root.getAttribute('data-uni') ?? '';
  const found = root.querySelectorAll<HTMLElement>(
    partSelector(component, part),
  );
  if (found.length !== 1) {
    throw new Error(
      `Expected one ${part} part in field "${key}", found ${found.length}`,
    );
  }
  return found[0]!;
}

/** The field's control: its input, its trigger or Field's control. */
function controlOf(mounted: MountedForm, key: string): HTMLInputElement {
  const component = fieldPart(mounted, key).getAttribute('data-uni') ?? '';
  const part = CONTROL[component];
  if (!part) throw new Error(`Field "${key}" (${component}) has no control`);
  return fieldPart(mounted, key, part) as HTMLInputElement;
}

/** The input of a group's option. */
function optionInput(
  mounted: MountedForm,
  key: string,
  value: string,
): HTMLInputElement {
  const option = fieldPart(mounted, key).querySelector<HTMLElement>(
    `[data-option="${value}"]`,
  );
  if (!option) throw new Error(`No option "${value}" in field "${key}"`);
  const input = option.querySelector<HTMLInputElement>(
    partSelector(option.getAttribute('data-uni') ?? '', 'input'),
  );
  if (!input) throw new Error(`No input in option "${value}"`);
  return input;
}

function fieldState(
  mounted: MountedForm,
  key: string,
): FormFieldState | undefined {
  return mounted.state().fields[key];
}

function statusOf(mounted: MountedForm, key: string): string | undefined {
  return fieldState(mounted, key)?.status;
}

/** The ids an attribute lists; empty when it is missing. */
function idList(element: Element, attribute: string): string[] {
  return element.getAttribute(attribute)?.split(' ').filter(Boolean) ?? [];
}

/**
 * The field shows `error` through its Field, or shows none: the error part
 * shown, `data-invalid` on the root and the control, `aria-invalid` on the
 * control and the error in its `aria-describedby`, and the error text
 * holding the first error.
 */
function expectError(
  mounted: MountedForm,
  key: string,
  error: string | null,
): void {
  const isShown = error !== null;
  const root = fieldPart(mounted, key);
  const part = fieldPart(mounted, key, 'error');
  expect(part.hidden, `${key}: error hidden`).toBe(!isShown);
  expect(root.hasAttribute('data-invalid'), `${key}: data-invalid`).toBe(
    isShown,
  );
  if ((root.getAttribute('data-uni') ?? '') in CONTROL) {
    const control = controlOf(mounted, key);
    expect(
      control.getAttribute('aria-invalid'),
      `${key}: aria-invalid on the control`,
    ).toBe(isShown ? 'true' : null);
    expect(
      control.hasAttribute('data-invalid'),
      `${key}: data-invalid on the control`,
    ).toBe(isShown);
    expect(
      idList(control, 'aria-describedby').includes(part.id),
      `${key}: error linked`,
    ).toBe(isShown);
  }
  if (isShown) {
    expect(fieldPart(mounted, key, 'errorText').textContent).toBe(error);
  }
}

function details<Detail>(mounted: MountedForm, name: string): Detail[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail as Detail);
}

interface SubmitCall {
  readonly values: FormValues;
  readonly context: FormSubmitContext;
}

/** A `handleSubmit` that records its calls and returns what `result` gives. */
function recorder(result: () => unknown = () => undefined): {
  calls: SubmitCall[];
  handleSubmit: NonNullable<FormProps['handleSubmit']>;
} {
  const calls: SubmitCall[] = [];
  return {
    calls,
    handleSubmit: (values, context) => {
      calls.push({ values, context });
      return result();
    },
  };
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T = unknown>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

interface Check {
  readonly value: unknown;
  readonly signal: AbortSignal;
  settle(result: unknown): void;
}

/** An async `validate` whose checks settle when the scenario says. */
function asyncValidate(): {
  checks: Check[];
  validate: (value: unknown, context: { signal: AbortSignal }) => unknown;
} {
  const checks: Check[] = [];
  return {
    checks,
    validate: (value, { signal }) =>
      new Promise((resolve) => {
        checks.push({ value, signal, settle: resolve });
      }),
  };
}

interface Post {
  readonly form: EventTarget | null;
  readonly submitter: HTMLElement | null;
}

/**
 * Watches for native posts: a `submit` event that no listener prevented,
 * seen on the window after every listener in the page. Each is recorded,
 * then prevented, so nothing leaves the page.
 */
function watchPosts(): { posts: Post[]; stop(): void } {
  const posts: Post[] = [];
  const onSubmit = (event: Event): void => {
    if (event.defaultPrevented) return;
    posts.push({
      form: event.target,
      submitter: (event as SubmitEvent).submitter,
    });
    event.preventDefault();
  };
  window.addEventListener('submit', onSubmit);
  return {
    posts,
    stop: () => window.removeEventListener('submit', onSubmit),
  };
}

/** Types `text` into the focused element, one key press per character. */
async function typeText(keyboard: KeyboardInput, text: string): Promise<void> {
  for (const character of text) await keyboard.press(character);
}

/**
 * Focuses a text control with the caret at its end. Not with End, which
 * moves no caret in WebKit on macOS.
 */
async function focusEnd(
  _keyboard: KeyboardInput,
  control: HTMLElement,
): Promise<void> {
  control.focus();
  const input = control as HTMLInputElement;
  input.setSelectionRange(input.value.length, input.value.length);
  await Promise.resolve();
}

/**
 * Opens a select with Enter on its trigger and waits for focus on the
 * option it opens on: the selected one.
 */
async function openSelect(
  mounted: MountedForm,
  keyboard: KeyboardInput,
  key: string,
  focusedKey: string,
): Promise<void> {
  controlOf(mounted, key).focus();
  await keyboard.press('Enter');
  await expect
    .poll(() => (document.activeElement as HTMLElement | null)?.dataset['key'])
    .toBe(focusedKey);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Long enough for an announcement to reach its live region and be heard. */
const settle = () => pause(500);

/** The live-region phrases heard so far that carry `text`. */
async function heardOf(
  heard: () => Promise<string[]>,
  text: string,
): Promise<string[]> {
  return (await heard()).filter((phrase) => phrase.includes(text));
}

export const formConformance = defineConformance<FormProps, FormState>(
  'form',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'marks the form, gives it an id, turns browser validation off and hides the error part',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
          });
          const form = formOf(mounted);
          expect(form.tagName).toBe('FORM');
          expect(form.id).not.toBe('');
          expect(form.hasAttribute('novalidate')).toBe(true);
          expect(form.noValidate).toBe(true);
          for (const attribute of ROOT_STATE) {
            expect(form.hasAttribute(attribute), attribute).toBe(false);
          }
          const error = mounted.part('error');
          expect(error.id).not.toBe('');
          expect(error.hidden).toBe(true);
          expect(mounted.state()).toMatchObject({
            isDirty: false,
            isTouched: false,
            isValid: false,
            isInvalid: false,
            isValidating: false,
            isSubmitting: false,
            submitError: undefined,
            canReset: false,
            isDisabled: false,
            isReadOnly: false,
          });
          expect(fieldState(mounted, 'email')).toMatchObject({
            errors: [],
            status: 'unvalidated',
            isTouched: false,
            isDirty: false,
            isActive: true,
          });
          expectError(mounted, 'email', null);
        },
        PHASE,
      );

      scenario(
        'keeps the ids the consumer gives the form and its error part',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')], {
              attrs: { id: 'signup' },
              errorAttrs: { id: 'signup-error' },
            }),
          });
          expect(formOf(mounted).id).toBe('signup');
          expect(mounted.part('error').id).toBe('signup-error');
        },
        PHASE,
      );

      scenario(
        'isDisabled and isReadOnly mark the root and reach every bound field',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              checkbox('terms', 'Accept the terms'),
            ]),
            props: { isDisabled: true },
          });
          const form = formOf(mounted);
          expect(form.hasAttribute('data-disabled')).toBe(true);
          expect(controlOf(mounted, 'email').disabled).toBe(true);
          expect(controlOf(mounted, 'terms').disabled).toBe(true);
          expect(mounted.state().isDisabled).toBe(true);

          await mounted.setProps({ isDisabled: false, isReadOnly: true });
          expect(form.hasAttribute('data-disabled')).toBe(false);
          expect(form.hasAttribute('data-readonly')).toBe(true);
          expect(controlOf(mounted, 'email').disabled).toBe(false);
          expect(controlOf(mounted, 'email').readOnly).toBe(true);
          expect(mounted.state()).toMatchObject({
            isDisabled: false,
            isReadOnly: true,
          });
        },
        PHASE,
      );
    });

    group('binding', () => {
      scenario(
        'a text field shows its value from defaultValues; typing changes values, fields and isDirty',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: 'jane@example.com' } },
          });
          const input = controlOf(mounted, 'email');
          expect(input.value).toBe('jane@example.com');
          expect(input.name).toBe('email');
          expect(fieldState(mounted, 'email')).toEqual({
            value: 'jane@example.com',
            defaultValue: 'jane@example.com',
            errors: [],
            status: 'unvalidated',
            isTouched: false,
            isDirty: false,
            isActive: true,
          });

          await focusEnd(keyboard, input);
          await typeText(keyboard, '.uk');
          expect(input.value).toBe('jane@example.com.uk');
          expect(mounted.state().values).toEqual({
            email: 'jane@example.com.uk',
          });
          expect(fieldState(mounted, 'email')).toMatchObject({
            value: 'jane@example.com.uk',
            defaultValue: 'jane@example.com',
            isTouched: true,
            isDirty: true,
          });
          expect(mounted.state()).toMatchObject({
            isDirty: true,
            isTouched: true,
            canReset: true,
          });
          expect(formOf(mounted).hasAttribute('data-dirty')).toBe(true);
        },
        PHASE,
      );

      scenario(
        'typing reports valuesChange from the user, once per change',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: '' } },
            events: EVENTS,
          });
          controlOf(mounted, 'email').focus();
          await typeText(keyboard, 'ab');
          expect(
            details<FormValuesChangeDetail>(mounted, 'valuesChange'),
          ).toEqual([
            {
              values: { email: 'a' },
              names: ['email'],
              source: 'user',
              kind: 'set',
            },
            {
              values: { email: 'ab' },
              names: ['email'],
              source: 'user',
              kind: 'set',
            },
          ]);
        },
        PHASE,
      );

      scenario(
        'typing and the check on leaving the field render no component',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
              textField('name', 'Name'),
            ]),
            props: { validationMessages: { valueMissing: 'Fill this in' } },
          });
          const renders = mounted.renderCount();
          controlOf(mounted, 'email').focus();
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');
          // The change that fixes the error checks; later ones uncheck it.
          controlOf(mounted, 'email').focus();
          await typeText(keyboard, 'j');
          await expect.poll(() => statusOf(mounted, 'email')).toBe('valid');
          await typeText(keyboard, 'ane');
          await expect
            .poll(() => statusOf(mounted, 'email'))
            .toBe('unvalidated');
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );

      scenario(
        'a name takes its default from defaultValues, else from its field’s own default',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('name', 'Name', { defaultValue: 'Sam' }),
              textField('nickname', 'Nickname', { defaultValue: 'sammy' }),
              checkbox('terms', 'Accept the terms', { defaultSelected: true }),
            ]),
            props: { defaultValues: { name: 'Jane' } },
          });
          expect(controlOf(mounted, 'name').value).toBe('Jane');
          expect(controlOf(mounted, 'nickname').value).toBe('sammy');
          expect(controlOf(mounted, 'terms').checked).toBe(true);
          expect(mounted.state().values).toEqual({
            name: 'Jane',
            nickname: 'sammy',
            terms: true,
          });
          expect(fieldState(mounted, 'name')).toMatchObject({
            defaultValue: 'Jane',
            isDirty: false,
          });
          expect(fieldState(mounted, 'nickname')).toMatchObject({
            defaultValue: 'sammy',
            isDirty: false,
          });
          expect(fieldState(mounted, 'terms')).toMatchObject({
            defaultValue: true,
            isDirty: false,
          });
          expect(mounted.state().isDirty).toBe(false);
        },
        PHASE,
      );

      scenario(
        'NumberField binds a number, committed when focus leaves it, and submits it through its hidden input',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([numberField('quantity', 'Quantity')]),
            props: { defaultValues: { quantity: 3 } },
          });
          const input = controlOf(mounted, 'quantity');
          const hidden = fieldPart(
            mounted,
            'quantity',
            'hiddenInput',
          ) as HTMLInputElement;
          expect(input.value).toBe('3');
          expect(hidden.name).toBe('quantity');
          expect(new FormData(formOf(mounted)).get('quantity')).toBe('3');

          input.focus();
          input.select();
          await keyboard.press('5');
          await keyboard.tab();
          await expect.poll(() => mounted.state().values['quantity']).toBe(5);
          expect(fieldState(mounted, 'quantity')).toMatchObject({
            value: 5,
            defaultValue: 3,
            isDirty: true,
          });
          expect(new FormData(formOf(mounted)).get('quantity')).toBe('5');
        },
        PHASE,
      );

      scenario(
        'Checkbox and Switch bind booleans and submit through their inputs when on',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp([
              checkbox('terms', 'Accept the terms'),
              toggleSwitch('wifi', 'Wi-Fi'),
            ]),
            props: { defaultValues: { terms: false, wifi: true } },
          });
          const terms = controlOf(mounted, 'terms');
          const wifi = controlOf(mounted, 'wifi');
          expect(terms.checked).toBe(false);
          expect(wifi.checked).toBe(true);
          expect(terms.name).toBe('terms');
          expect(wifi.name).toBe('wifi');

          await pointer.click(terms);
          await pointer.click(wifi);
          expect(terms.checked).toBe(true);
          expect(wifi.checked).toBe(false);
          expect(mounted.state().values).toEqual({ terms: true, wifi: false });
          const data = new FormData(formOf(mounted));
          expect(data.get('terms')).toBe('on');
          expect(data.has('wifi')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'CheckboxGroup binds a list of values and RadioGroup one value',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp([
              checkboxGroup('notifications', 'Notifications', [
                ['email', 'Email'],
                ['sms', 'SMS'],
              ]),
              radioGroup('plan', 'Plan', [
                ['free', 'Free'],
                ['pro', 'Pro'],
                ['team', 'Team'],
              ]),
            ]),
            props: {
              defaultValues: { notifications: ['email'], plan: 'pro' },
            },
          });
          expect(optionInput(mounted, 'notifications', 'email').checked).toBe(
            true,
          );
          expect(optionInput(mounted, 'notifications', 'sms').checked).toBe(
            false,
          );
          expect(optionInput(mounted, 'plan', 'pro').checked).toBe(true);

          await pointer.click(optionInput(mounted, 'notifications', 'sms'));
          await pointer.click(optionInput(mounted, 'plan', 'team'));
          expect(mounted.state().values).toEqual({
            notifications: ['email', 'sms'],
            plan: 'team',
          });
          const data = new FormData(formOf(mounted));
          expect(data.getAll('notifications')).toEqual(['email', 'sms']);
          expect(data.get('plan')).toBe('team');
        },
        PHASE,
      );

      scenario(
        'Select binds a key in single mode, submitted through its hidden select',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([select('fruit', 'Fruit')]),
            props: { defaultValues: { fruit: 'banana' } },
          });
          expect(fieldPart(mounted, 'fruit', 'value').textContent).toBe(
            'Banana',
          );
          const hidden = fieldPart(
            mounted,
            'fruit',
            'hiddenSelect',
          ) as HTMLSelectElement;
          expect(hidden.name).toBe('fruit');
          expect(hidden.value).toBe('banana');

          await openSelect(mounted, keyboard, 'fruit', 'banana');
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          await expect
            .poll(() => mounted.state().values['fruit'])
            .toBe('cherry');
          expect(fieldPart(mounted, 'fruit', 'value').textContent).toBe(
            'Cherry',
          );
          expect(new FormData(formOf(mounted)).get('fruit')).toBe('cherry');
        },
        PHASE,
      );

      scenario(
        'Select binds a list of keys in multiple mode',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              select('fruits', 'Fruits', { selectionMode: 'multiple' }),
            ]),
            props: { defaultValues: { fruits: ['apple'] } },
          });
          await openSelect(mounted, keyboard, 'fruits', 'apple');
          await keyboard.press('ArrowDown');
          await keyboard.press('Enter');
          await keyboard.press('Escape');
          await expect
            .poll(() => mounted.state().values['fruits'])
            .toEqual(['apple', 'banana']);
          expect(new FormData(formOf(mounted)).getAll('fruits')).toEqual([
            'apple',
            'banana',
          ]);
        },
        PHASE,
      );

      scenario(
        'Field alone binds the native control it labels',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([field('nickname', 'Nickname')]),
            props: { defaultValues: { nickname: 'jj' } },
          });
          const control = controlOf(mounted, 'nickname');
          expect(control.value).toBe('jj');
          expect(control.name).toBe('nickname');

          await focusEnd(keyboard, control);
          await typeText(keyboard, 'x');
          expect(mounted.state().values).toEqual({ nickname: 'jjx' });
          expect(fieldState(mounted, 'nickname')).toMatchObject({
            value: 'jjx',
            isDirty: true,
            isTouched: true,
          });
        },
        PHASE,
      );

      scenario(
        'a path binds nested data, and a field’s key and native name escape its segments',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('path', 'Email', { name: ['user', 'email'] }),
              textField('dotted', 'Dotted', { name: 'user.email' }),
            ]),
            props: {
              defaultValues: { user: { email: 'a@b.co' }, 'user.email': 'q' },
            },
          });
          const path = controlOf(mounted, 'path');
          const dotted = controlOf(mounted, 'dotted');
          expect(path.value).toBe('a@b.co');
          expect(path.name).toBe('user.email');
          expect(dotted.value).toBe('q');
          expect(dotted.name).toBe('user\\.email');
          expect(fieldState(mounted, 'user.email')?.value).toBe('a@b.co');
          expect(fieldState(mounted, 'user\\.email')?.value).toBe('q');

          await focusEnd(keyboard, path);
          await typeText(keyboard, 'm');
          expect(mounted.state().values).toEqual({
            user: { email: 'a@b.com' },
            'user.email': 'q',
          });
        },
        PHASE,
      );

      scenario(
        'two fields with one name share its value',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('first', 'Email', { name: 'email' }),
              textField('second', 'Email again', { name: 'email' }),
            ]),
            props: { defaultValues: { email: 'a@b.co' } },
          });
          expect(controlOf(mounted, 'second').value).toBe('a@b.co');
          await focusEnd(keyboard, controlOf(mounted, 'first'));
          await typeText(keyboard, 'm');
          expect(controlOf(mounted, 'second').value).toBe('a@b.com');
          expect(mounted.state().values).toEqual({ email: 'a@b.com' });
        },
        PHASE,
      );
    });

    group('checks', () => {
      scenario(
        'a text field checks when focus leaves it, even unchanged, and shows the error through its Field',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
              textField('name', 'Name'),
            ]),
            props: { validationMessages: { valueMissing: 'Enter your email' } },
          });
          const input = controlOf(mounted, 'email');
          input.focus();
          controlOf(mounted, 'name').focus();
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');

          expectError(mounted, 'email', 'Enter your email');
          for (const part of ['label', 'error']) {
            expect(
              fieldPart(mounted, 'email', part).hasAttribute('data-invalid'),
              `data-invalid on ${part}`,
            ).toBe(true);
          }
          expect(fieldState(mounted, 'email')).toMatchObject({
            errors: ['Enter your email'],
            status: 'invalid',
            isTouched: true,
          });
          expect(formOf(mounted).hasAttribute('data-invalid')).toBe(true);
          expect(mounted.state()).toMatchObject({
            isInvalid: true,
            isValid: false,
            isTouched: true,
          });
        },
        PHASE,
      );

      scenario(
        'typing doesn’t check a blur field; leaving it does, minlength included',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('nickname', 'Nickname', {}, { minlength: '4' }),
            ]),
          });
          controlOf(mounted, 'nickname').focus();
          await typeText(keyboard, 'ab');
          await pause(100);
          expect(statusOf(mounted, 'nickname')).toBe('unvalidated');
          expectError(mounted, 'nickname', null);

          await keyboard.tab();
          await expect
            .poll(() => statusOf(mounted, 'nickname'))
            .toBe('invalid');
          expectError(mounted, 'nickname', 'Use at least 4 characters');
        },
        PHASE,
      );

      scenario(
        'an error goes on the change that fixes it; a later change unchecks the field until it is left',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
            ]),
            props: { validationMessages: { valueMissing: 'Enter your email' } },
          });
          const input = controlOf(mounted, 'email');
          input.focus();
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');

          input.focus();
          await typeText(keyboard, 'j');
          await expect.poll(() => statusOf(mounted, 'email')).toBe('valid');
          expectError(mounted, 'email', null);
          expect(formOf(mounted).hasAttribute('data-invalid')).toBe(false);

          // No error shows now, so the change doesn't check.
          await keyboard.press('Backspace');
          await expect
            .poll(() => statusOf(mounted, 'email'))
            .toBe('unvalidated');
          expectError(mounted, 'email', null);

          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');
          expectError(mounted, 'email', 'Enter your email');
        },
        PHASE,
      );

      scenario(
        'checkboxes and groups check on each change',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp([
              checkbox('terms', 'Accept the terms', {
                isRequired: true,
                validationMessages: { valueMissing: 'Accept the terms first' },
              }),
              checkboxGroup(
                'notifications',
                'Notifications',
                [
                  ['email', 'Email'],
                  ['sms', 'SMS'],
                ],
                {
                  isRequired: true,
                  validationMessages: { valueMissing: 'Pick a channel' },
                },
              ),
            ]),
          });
          const terms = controlOf(mounted, 'terms');
          await pointer.click(terms);
          await expect.poll(() => statusOf(mounted, 'terms')).toBe('valid');
          await pointer.click(terms);
          await expect.poll(() => statusOf(mounted, 'terms')).toBe('invalid');
          expectError(mounted, 'terms', 'Accept the terms first');

          const email = optionInput(mounted, 'notifications', 'email');
          await pointer.click(email);
          await expect
            .poll(() => statusOf(mounted, 'notifications'))
            .toBe('valid');
          await pointer.click(email);
          await expect
            .poll(() => statusOf(mounted, 'notifications'))
            .toBe('invalid');
          expectError(mounted, 'notifications', 'Pick a channel');
        },
        PHASE,
      );

      scenario(
        'type="email" counts, with the form’s message',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', {}, { type: 'email' }),
            ]),
            props: {
              validationMessages: { typeMismatch: 'Use an email address' },
            },
          });
          controlOf(mounted, 'email').focus();
          await typeText(keyboard, 'jane');
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');
          expectError(mounted, 'email', 'Use an email address');
        },
        PHASE,
      );

      scenario(
        'a field’s messages win over the form’s, and a message can be a function',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', {
                isRequired: true,
                validationMessages: { valueMissing: 'Enter your email' },
              }),
              textField('name', 'Name', { isRequired: true }),
              textField(
                'code',
                'Code',
                {
                  validationMessages: {
                    tooShort: ({ min }: { min?: number }) =>
                      `Type ${min} or more`,
                  },
                },
                { minlength: '3' },
              ),
            ]),
            props: {
              defaultValues: { email: '', name: '', code: 'a' },
              validationMessages: { valueMissing: 'This is required' },
            },
          });
          const result = (await mounted.call('validate')) as FormValidateResult;
          expect(result.isValid).toBe(false);
          expect(result.errors['email']).toEqual(['Enter your email']);
          expect(result.errors['name']).toEqual(['This is required']);
          expect(result.errors['code']).toEqual(['Type 3 or more']);
          expectError(mounted, 'email', 'Enter your email');
          expectError(mounted, 'name', 'This is required');
          expectError(mounted, 'code', 'Type 3 or more');
        },
        PHASE,
      );

      scenario(
        'the form’s submit trigger checks only on submit, and a field’s own trigger wins',
        async ({ mount, keyboard, pointer }) => {
          const { handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
              checkbox('terms', 'Accept the terms', { isRequired: true }),
              textField(
                'nickname',
                'Nickname',
                { validationTrigger: 'change' },
                { minlength: '3' },
              ),
            ]),
            props: {
              handleSubmit,
              validationTrigger: 'submit',
              validationMessages: { valueMissing: 'Fill this in' },
            },
          });
          controlOf(mounted, 'email').focus();
          await keyboard.tab();
          await pointer.click(controlOf(mounted, 'terms'));
          await pointer.click(controlOf(mounted, 'terms'));
          await pause(100);
          expect(statusOf(mounted, 'email')).toBe('unvalidated');
          expect(statusOf(mounted, 'terms')).toBe('unvalidated');

          controlOf(mounted, 'nickname').focus();
          await typeText(keyboard, 'a');
          await expect
            .poll(() => statusOf(mounted, 'nickname'))
            .toBe('invalid');
          expectError(mounted, 'nickname', 'Use at least 3 characters');

          await pointer.click(byId(mounted, 'submit'));
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');
          expectError(mounted, 'email', 'Fill this in');
          expectError(mounted, 'terms', 'Fill this in');
        },
        PHASE,
      );

      scenario(
        'validate gets the value with the name, the values and a signal, for empty values too',
        async ({ mount, keyboard }) => {
          const calls: { value: unknown; context: Record<string, unknown> }[] =
            [];
          const mounted = await mount({
            template: signUp([
              textField('username', 'Username', {
                validate: (
                  value: unknown,
                  context: Record<string, unknown>,
                ) => {
                  calls.push({ value, context });
                  return value === 'admin' ? 'That name is taken' : null;
                },
              }),
            ]),
            props: { defaultValues: { username: '' } },
          });
          const input = controlOf(mounted, 'username');
          input.focus();
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'username')).toBe('valid');
          expect(calls.map((call) => call.value)).toEqual(['']);

          input.focus();
          await typeText(keyboard, 'admin');
          await keyboard.tab();
          await expect
            .poll(() => statusOf(mounted, 'username'))
            .toBe('invalid');
          expectError(mounted, 'username', 'That name is taken');
          // Typing with no error shown didn't check.
          expect(calls).toHaveLength(2);
          const { value, context } = calls[1]!;
          expect(value).toBe('admin');
          expect(context['name']).toBe('username');
          expect(context['values']).toEqual({ username: 'admin' });
          expect(context['signal']).toBeInstanceOf(AbortSignal);
        },
        PHASE,
      );

      scenario(
        'validate may return a list of errors, throw, or pass with true',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('password', 'Password', {
                validate: () => ['Too short', 'No digits'],
              }),
              textField('error', 'Thrown error', {
                validate: () => {
                  throw new Error('Check failed');
                },
              }),
              textField('text', 'Thrown text', {
                validate: () => {
                  throw 'Plain text';
                },
              }),
              textField('fine', 'Fine', { validate: () => true }),
            ]),
          });
          await mounted.call('validate');
          expect(fieldState(mounted, 'password')).toMatchObject({
            errors: ['Too short', 'No digits'],
            status: 'invalid',
          });
          expectError(mounted, 'password', 'Too short');
          expect(fieldState(mounted, 'error')?.errors).toEqual([
            'Check failed',
          ]);
          expect(fieldState(mounted, 'text')?.errors).toEqual(['Plain text']);
          expect(fieldState(mounted, 'fine')).toMatchObject({
            errors: [],
            status: 'valid',
          });
          expectError(mounted, 'fine', null);
        },
        PHASE,
      );

      scenario(
        'an async check marks the field and the form as validating until it settles',
        async ({ mount, keyboard }) => {
          const { checks, validate } = asyncValidate();
          const mounted = await mount({
            template: signUp([textField('username', 'Username', { validate })]),
            props: { defaultValues: { username: 'ann' } },
          });
          controlOf(mounted, 'username').focus();
          await keyboard.tab();
          await expect
            .poll(() => statusOf(mounted, 'username'))
            .toBe('validating');
          expect(checks.map((check) => check.value)).toEqual(['ann']);
          expect(mounted.state().isValidating).toBe(true);
          expect(formOf(mounted).hasAttribute('data-validating')).toBe(true);
          for (const part of ['root', 'label', 'input', 'error']) {
            expect(
              fieldPart(mounted, 'username', part).hasAttribute(
                'data-validating',
              ),
              `data-validating on ${part}`,
            ).toBe(true);
          }

          checks[0]!.settle('That name is taken');
          await expect
            .poll(() => statusOf(mounted, 'username'))
            .toBe('invalid');
          expectError(mounted, 'username', 'That name is taken');
          expect(mounted.state().isValidating).toBe(false);
          expect(formOf(mounted).hasAttribute('data-validating')).toBe(false);
          for (const part of ['root', 'label', 'input', 'error']) {
            expect(
              fieldPart(mounted, 'username', part).hasAttribute(
                'data-validating',
              ),
              `data-validating on ${part}`,
            ).toBe(false);
          }
        },
        PHASE,
      );

      scenario(
        'a change aborts a running check, and its late result is dropped',
        async ({ mount, keyboard }) => {
          const { checks, validate } = asyncValidate();
          const mounted = await mount({
            template: signUp([textField('username', 'Username', { validate })]),
            props: { defaultValues: { username: 'ann' } },
          });
          const input = controlOf(mounted, 'username');
          input.focus();
          await keyboard.tab();
          await expect.poll(() => checks.length).toBe(1);

          await focusEnd(keyboard, input);
          await typeText(keyboard, 'a');
          expect(checks[0]!.signal.aborted).toBe(true);
          await expect
            .poll(() => statusOf(mounted, 'username'))
            .toBe('unvalidated');
          checks[0]!.settle('That name is taken');
          await pause(100);
          expect(fieldState(mounted, 'username')).toMatchObject({
            errors: [],
            status: 'unvalidated',
          });
          expectError(mounted, 'username', null);

          await keyboard.tab();
          await expect.poll(() => checks.length).toBe(2);
          expect(checks[1]!.value).toBe('anna');
          checks[1]!.settle(null);
          await expect.poll(() => statusOf(mounted, 'username')).toBe('valid');
        },
        PHASE,
      );

      scenario(
        'validationDelay waits before checking, with the field validating meanwhile',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('username', 'Username', {
                isRequired: true,
                validationDelay: 1000,
              }),
            ]),
            props: { validationMessages: { valueMissing: 'Pick a username' } },
          });
          controlOf(mounted, 'username').focus();
          await keyboard.tab();
          await expect
            .poll(() => statusOf(mounted, 'username'))
            .toBe('validating');
          await pause(300);
          expect(statusOf(mounted, 'username')).toBe('validating');
          expectError(mounted, 'username', null);
          await expect
            .poll(() => statusOf(mounted, 'username'), { timeout: 3000 })
            .toBe('invalid');
          expectError(mounted, 'username', 'Pick a username');
        },
        PHASE,
      );

      scenario(
        'disabled and read-only fields aren’t checked and stay in the payload',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', {
                isRequired: true,
                isDisabled: true,
              }),
              textField('nickname', 'Nickname', {
                isRequired: true,
                isReadOnly: true,
              }),
            ]),
            props: {
              handleSubmit,
              defaultValues: { email: '', nickname: '' },
            },
          });
          await pointer.click(byId(mounted, 'submit'));
          await expect.poll(() => calls.length).toBe(1);
          expect(calls[0]!.values).toEqual({ email: '', nickname: '' });
          expect(fieldState(mounted, 'email')?.errors).toEqual([]);
          expect(fieldState(mounted, 'nickname')?.errors).toEqual([]);
          expectError(mounted, 'nickname', null);
        },
        PHASE,
      );

      scenario(
        'dependsOn checks a field again when a name it depends on changes',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('password', 'Password'),
              textField('confirm', 'Confirm password', {
                dependsOn: ['password'],
                validate: (
                  value: unknown,
                  { values }: { values: FormValues },
                ) => (value === values['password'] ? null : 'Passwords differ'),
              }),
            ]),
            props: { defaultValues: { password: '', confirm: '' } },
          });
          const password = controlOf(mounted, 'password');
          const confirm = controlOf(mounted, 'confirm');
          password.focus();
          await typeText(keyboard, 'abc');
          confirm.focus();
          await typeText(keyboard, 'abc');
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'confirm')).toBe('valid');

          await focusEnd(keyboard, password);
          await typeText(keyboard, 'd');
          await expect.poll(() => statusOf(mounted, 'confirm')).toBe('invalid');
          expectError(mounted, 'confirm', 'Passwords differ');
          expect(document.activeElement).toBe(password);
        },
        PHASE,
      );

      scenario(
        'a field’s own isInvalid wins over the form’s errors',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isInvalid: false }),
              textField('name', 'Name', { isInvalid: true }),
            ]),
          });
          await mounted.call('setFieldErrors', 'email', ['Already taken']);
          expect(statusOf(mounted, 'email')).toBe('invalid');
          expect(controlOf(mounted, 'email').hasAttribute('aria-invalid')).toBe(
            false,
          );
          expect(controlOf(mounted, 'name').getAttribute('aria-invalid')).toBe(
            'true',
          );
        },
        PHASE,
      );
    });

    group('submitting', () => {
      scenario(
        'a press on Submit with invalid fields reports submitFailed, calls no handleSubmit and focuses the first, visibly',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('name', 'Name', { isRequired: true }),
              textField('email', 'Email', { isRequired: true }),
              textField('nickname', 'Nickname', { isRequired: true }),
            ]),
            props: {
              handleSubmit,
              defaultValues: { name: 'Jane', email: '', nickname: '' },
              validationMessages: { valueMissing: 'Fill this in' },
            },
            events: EVENTS,
          });
          byId(mounted, 'before').focus();
          await pointer.click(byId(mounted, 'submit'));
          const email = controlOf(mounted, 'email');
          await expect.poll(() => document.activeElement).toBe(email);
          expect(email.hasAttribute('data-focus-visible')).toBe(true);

          const failed = details<FormSubmitFailedDetail>(
            mounted,
            'submitFailed',
          );
          expect(failed).toHaveLength(1);
          const detail = failed[0]!;
          expect(detail.status).toBe('invalid');
          const errors = detail.status === 'invalid' ? detail.errors : {};
          expect(errors['email']).toEqual(['Fill this in']);
          expect(errors['nickname']).toEqual(['Fill this in']);
          expect(errors['name'] ?? []).toEqual([]);
          expect(calls).toEqual([]);
          expect(details(mounted, 'submitted')).toEqual([]);
          expectError(mounted, 'email', 'Fill this in');
          expectError(mounted, 'nickname', 'Fill this in');
          expectError(mounted, 'name', null);
          expect(mounted.state()).toMatchObject({
            isInvalid: true,
            isSubmitting: false,
          });
          expect(formOf(mounted).hasAttribute('data-invalid')).toBe(true);
        },
        PHASE,
      );

      scenario(
        'focus goes to each field’s own target, skipping a field that can’t take focus',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp([
              h(
                'div',
                { hidden: '' },
                textField('hidden', 'Hidden', { isRequired: true }),
              ),
              checkboxGroup(
                'notifications',
                'Notifications',
                [
                  ['email', 'Email', { isDisabled: true }],
                  ['sms', 'SMS'],
                ],
                { isRequired: true },
              ),
              radioGroup(
                'plan',
                'Plan',
                [
                  ['free', 'Free'],
                  ['pro', 'Pro'],
                ],
                {
                  validate: (value: unknown) =>
                    value === 'free' ? 'Pick a paid plan' : null,
                },
              ),
              select('fruit', 'Fruit', { isRequired: true }),
            ]),
            props: {
              handleSubmit: () => undefined,
              defaultValues: { plan: 'free' },
              validationMessages: { valueMissing: 'Fill this in' },
            },
          });
          await pointer.click(byId(mounted, 'submit'));
          const sms = optionInput(mounted, 'notifications', 'sms');
          await expect.poll(() => document.activeElement).toBe(sms);
          expect(sms.hasAttribute('data-focus-visible')).toBe(true);
          expect(statusOf(mounted, 'hidden')).toBe('invalid');

          await pointer.click(sms);
          await expect
            .poll(() => statusOf(mounted, 'notifications'))
            .toBe('valid');
          await mounted.call('focusInvalid');
          await expect
            .poll(() => document.activeElement)
            .toBe(optionInput(mounted, 'plan', 'free'));

          await pointer.click(optionInput(mounted, 'plan', 'pro'));
          await expect.poll(() => statusOf(mounted, 'plan')).toBe('valid');
          await mounted.call('focusInvalid');
          await expect
            .poll(() => document.activeElement)
            .toBe(controlOf(mounted, 'fruit'));
        },
        PHASE,
      );

      scenario(
        'a valid submit calls handleSubmit with the active values and the context, then reports submitted',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: {
              handleSubmit,
              defaultValues: { email: 'jane@example.com', referrer: 'ad' },
            },
            events: EVENTS,
          });
          const submit = byId(mounted, 'submit');
          await pointer.click(submit);
          await expect.poll(() => calls.length).toBe(1);
          const { values, context } = calls[0]!;
          expect(values).toEqual({ email: 'jane@example.com' });
          expect(context.signal).toBeInstanceOf(AbortSignal);
          expect(context.signal.aborted).toBe(false);
          expect(context.submitter).toBe(submit);
          expect(context.formData).toBeInstanceOf(FormData);
          expect(context.formData.get('email')).toBe('jane@example.com');

          await expect
            .poll(() => details<FormSubmittedDetail>(mounted, 'submitted'))
            .toEqual([{ values: { email: 'jane@example.com' } }]);
          expect(details(mounted, 'submitFailed')).toEqual([]);
          expect(mounted.state().isSubmitting).toBe(false);
        },
        PHASE,
      );

      scenario(
        'while handleSubmit is pending the form is submitting, can’t reset, and ignores another submit',
        async ({ mount, keyboard, pointer }) => {
          const pending = deferred();
          const { calls, handleSubmit } = recorder(() => pending.promise);
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { handleSubmit, defaultValues: { email: 'a@b.co' } },
            events: EVENTS,
          });
          await focusEnd(keyboard, controlOf(mounted, 'email'));
          await typeText(keyboard, 'm');
          expect(mounted.state().canReset).toBe(true);

          const submit = byId(mounted, 'submit');
          await pointer.click(submit);
          await expect.poll(() => calls.length).toBe(1);
          expect(mounted.state()).toMatchObject({
            isSubmitting: true,
            canReset: false,
          });
          expect(formOf(mounted).hasAttribute('data-submitting')).toBe(true);

          await pointer.click(submit);
          expect(await mounted.call('submit')).toMatchObject({
            status: 'ignored',
          });
          await pause(100);
          expect(calls).toHaveLength(1);

          pending.resolve(undefined);
          await expect
            .poll(() => details(mounted, 'submitted'))
            .toHaveLength(1);
          expect(mounted.state()).toMatchObject({
            isSubmitting: false,
            canReset: true,
          });
          expect(formOf(mounted).hasAttribute('data-submitting')).toBe(false);
        },
        PHASE,
      );

      scenario(
        'a failing handleSubmit sets submitError, shows the error part and reports submitFailed; the next submit clears it',
        async ({ mount, pointer }) => {
          const rejected = new Error('Server down');
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: {
              handleSubmit: () => Promise.reject(rejected),
              defaultValues: { email: 'a@b.co' },
            },
            events: EVENTS,
          });
          const error = mounted.part('error');
          await pointer.click(byId(mounted, 'submit'));
          await expect
            .poll(() => details(mounted, 'submitFailed'))
            .toEqual([{ status: 'failed', error: rejected }]);
          expect(mounted.state()).toMatchObject({
            submitError: rejected,
            isSubmitting: false,
          });
          expect(error.hidden).toBe(false);
          expect(details(mounted, 'submitted')).toEqual([]);

          const thrown = new Error('Bad request');
          await mounted.setProps({
            handleSubmit: () => {
              throw thrown;
            },
          });
          expect(await mounted.call('submit')).toMatchObject({
            status: 'failed',
            error: thrown,
          });
          expect(mounted.state().submitError).toBe(thrown);

          await mounted.setProps({ handleSubmit: () => undefined });
          await pointer.click(byId(mounted, 'submit'));
          await expect
            .poll(() => details(mounted, 'submitted'))
            .toHaveLength(1);
          expect(mounted.state().submitError).toBeUndefined();
          expect(error.hidden).toBe(true);
        },
        PHASE,
      );

      scenario(
        'a submitter with formnovalidate skips the checks',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const draft = h(
            'button',
            { type: 'submit', id: 'draft', formnovalidate: '' },
            'Save draft',
          );
          const mounted = await mount({
            template: signUp(
              [textField('email', 'Email', { isRequired: true })],
              { buttons: [draft, SUBMIT] },
            ),
            props: { handleSubmit, defaultValues: { email: '' } },
            events: EVENTS,
          });
          await pointer.click(byId(mounted, 'draft'));
          await expect.poll(() => calls.length).toBe(1);
          expect(calls[0]!.values).toEqual({ email: '' });
          expect(calls[0]!.context.submitter).toBe(byId(mounted, 'draft'));
          expect(statusOf(mounted, 'email')).toBe('unvalidated');
          expectError(mounted, 'email', null);
          expect(details(mounted, 'submitFailed')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'Enter in a text field submits through the first submit button',
        async ({ mount, keyboard }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { handleSubmit, defaultValues: { email: 'a@b.co' } },
          });
          controlOf(mounted, 'email').focus();
          await keyboard.press('Enter');
          await expect.poll(() => calls.length).toBe(1);
          expect(calls[0]!.values).toEqual({ email: 'a@b.co' });
          expect(calls[0]!.context.submitter).toBe(byId(mounted, 'submit'));
        },
        PHASE,
      );

      scenario(
        'submit() resolves with the result, and focuses the first invalid field unless told not to',
        async ({ mount }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
            ]),
            props: {
              handleSubmit,
              defaultValues: { email: '' },
              validationMessages: { valueMissing: 'Enter your email' },
            },
          });
          const before = byId(mounted, 'before');
          before.focus();
          expect(
            await mounted.call('submit', { shouldFocus: false }),
          ).toMatchObject({
            status: 'invalid',
            errors: { email: ['Enter your email'] },
          });
          await pause(100);
          expect(document.activeElement).toBe(before);

          expect(await mounted.call('submit')).toMatchObject({
            status: 'invalid',
          });
          const email = controlOf(mounted, 'email');
          await expect.poll(() => document.activeElement).toBe(email);
          expect(email.hasAttribute('data-focus-visible')).toBe(true);

          await mounted.call('setValue', 'email', 'a@b.co');
          expect(await mounted.call('submit')).toMatchObject({
            status: 'submitted',
          });
          expect(calls).toHaveLength(1);
        },
        PHASE,
      );

      scenario(
        'a form with no active fields submits, though isValid stays false',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([]),
            props: { handleSubmit },
            events: EVENTS,
          });
          await pointer.click(byId(mounted, 'submit'));
          await expect.poll(() => calls.length).toBe(1);
          expect(calls[0]!.values).toEqual({});
          await expect
            .poll(() => details(mounted, 'submitted'))
            .toEqual([{ values: {} }]);
          expect(mounted.state().isValid).toBe(false);
        },
        PHASE,
      );

      scenario(
        'a value that changes during the checks settles the submit stale, and nothing is sent',
        async ({ mount, keyboard }) => {
          const { checks, validate } = asyncValidate();
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([textField('username', 'Username', { validate })]),
            props: { handleSubmit, defaultValues: { username: 'ann' } },
            events: EVENTS,
          });
          const result = mounted.call('submit');
          await expect.poll(() => checks.length).toBe(1);
          await focusEnd(keyboard, controlOf(mounted, 'username'));
          await typeText(keyboard, 'a');
          checks[0]!.settle(null);
          expect(await result).toMatchObject({ status: 'stale' });
          await pause(100);
          expect(calls).toEqual([]);
          expect(details(mounted, 'submitted')).toEqual([]);
          expect(mounted.state().isSubmitting).toBe(false);
        },
        PHASE,
      );

      scenario(
        'cancelSubmit and reset abort a running submit, which settles stale',
        async ({ mount }) => {
          const { calls, handleSubmit } = recorder(
            // Never settles: only an abort ends this submit.
            () => new Promise(() => undefined),
          );
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { handleSubmit, defaultValues: { email: 'a@b.co' } },
            events: EVENTS,
          });
          const cancelled = mounted.call('submit');
          await expect.poll(() => calls.length).toBe(1);
          await mounted.call('cancelSubmit');
          expect(await cancelled).toMatchObject({ status: 'stale' });
          expect(calls[0]!.context.signal.aborted).toBe(true);
          expect(mounted.state().isSubmitting).toBe(false);

          const resetting = mounted.call('submit');
          await expect.poll(() => calls.length).toBe(2);
          await mounted.call('reset');
          expect(await resetting).toMatchObject({ status: 'stale' });
          expect(calls[1]!.context.signal.aborted).toBe(true);
          expect(mounted.state().isSubmitting).toBe(false);
          expect(details(mounted, 'submitted')).toEqual([]);
          expect(details(mounted, 'submitFailed')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'without handleSubmit, a valid form posts natively once, then reports submitted',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')], {
              attrs: POSTS_TO_SINK,
              after: [SINK],
            }),
            props: { defaultValues: { email: 'jane@example.com' } },
            events: EVENTS,
          });
          const watcher = watchPosts();
          try {
            const submit = byId(mounted, 'submit');
            await pointer.click(submit);
            await expect.poll(() => watcher.posts.length).toBe(1);
            expect(watcher.posts[0]!.form).toBe(formOf(mounted));
            expect(watcher.posts[0]!.submitter).toBe(submit);
            await expect
              .poll(() => details(mounted, 'submitted'))
              .toEqual([{ values: { email: 'jane@example.com' } }]);
            await expect.poll(() => mounted.state().isSubmitting).toBe(false);
            await pause(300);
            expect(watcher.posts).toHaveLength(1);
          } finally {
            watcher.stop();
          }
        },
        PHASE,
      );

      scenario(
        'without handleSubmit, an invalid form posts nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: signUp(
              [textField('email', 'Email', { isRequired: true })],
              { attrs: POSTS_TO_SINK, after: [SINK] },
            ),
            props: { defaultValues: { email: '' } },
            events: EVENTS,
          });
          const watcher = watchPosts();
          try {
            await pointer.click(byId(mounted, 'submit'));
            await expect
              .poll(() => details(mounted, 'submitFailed'))
              .toHaveLength(1);
            await pause(300);
            expect(watcher.posts).toEqual([]);
            expect(details(mounted, 'submitted')).toEqual([]);
          } finally {
            watcher.stop();
          }
        },
        PHASE,
      );

      scenario(
        'an unbound control’s native constraint stops the submit too',
        async ({ mount, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              h('input', { id: 'code', 'aria-label': 'Code', required: '' }),
            ]),
            props: { handleSubmit, defaultValues: { email: 'a@b.co' } },
          });
          await pointer.click(byId(mounted, 'submit'));
          await pause(300);
          expect(calls).toEqual([]);
        },
        PHASE,
      );
    });

    group('resetting', () => {
      scenario(
        'the reset button puts every value back, clears errors and touched, and reports valuesChange',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              textField('name', 'Name', { isRequired: true }),
            ]),
            props: {
              defaultValues: { email: 'a@b.co', name: '' },
              validationMessages: { valueMissing: 'Fill this in' },
            },
            events: EVENTS,
          });
          const email = controlOf(mounted, 'email');
          controlOf(mounted, 'name').focus();
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'name')).toBe('invalid');
          await focusEnd(keyboard, email);
          await typeText(keyboard, 'm');
          mounted.clearEvents();

          await pointer.click(byId(mounted, 'reset'));
          await expect
            .poll(() => mounted.state().values)
            .toEqual({ email: 'a@b.co', name: '' });
          expect(email.value).toBe('a@b.co');
          expect(controlOf(mounted, 'name').value).toBe('');
          expect(fieldState(mounted, 'name')).toMatchObject({
            errors: [],
            status: 'unvalidated',
            isTouched: false,
          });
          expect(fieldState(mounted, 'email')).toMatchObject({
            status: 'unvalidated',
            isTouched: false,
            isDirty: false,
          });
          expectError(mounted, 'name', null);
          expect(mounted.state()).toMatchObject({
            isDirty: false,
            isTouched: false,
            isInvalid: false,
            canReset: false,
          });
          const resets = details<FormValuesChangeDetail>(
            mounted,
            'valuesChange',
          ).filter((detail) => detail.kind === 'reset');
          expect(resets).toHaveLength(1);
          expect(resets[0]!.values).toEqual({ email: 'a@b.co', name: '' });
        },
        PHASE,
      );

      scenario(
        'reset() resets too, and reset({ values }) makes them the defaults first',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: 'a@b.co' } },
          });
          const email = controlOf(mounted, 'email');
          await focusEnd(keyboard, email);
          await typeText(keyboard, 'm');
          await mounted.call('reset');
          await expect.poll(() => email.value).toBe('a@b.co');
          expect(mounted.state().values).toEqual({ email: 'a@b.co' });

          await mounted.call('reset', { values: { email: 'new@b.co' } });
          await expect.poll(() => email.value).toBe('new@b.co');
          expect(mounted.state()).toMatchObject({
            values: { email: 'new@b.co' },
            defaultValues: { email: 'new@b.co' },
            isDirty: false,
          });
          expect(fieldState(mounted, 'email')).toMatchObject({
            defaultValue: 'new@b.co',
            isDirty: false,
          });
        },
        PHASE,
      );

      scenario(
        'a native reset a later listener cancels changes nothing',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: 'a@b.co' } },
          });
          const email = controlOf(mounted, 'email');
          await focusEnd(keyboard, email);
          await typeText(keyboard, 'm');
          const cancel = (event: Event) => event.preventDefault();
          window.addEventListener('reset', cancel);
          try {
            await pointer.click(byId(mounted, 'reset'));
            await pause(200);
          } finally {
            window.removeEventListener('reset', cancel);
          }
          expect(email.value).toBe('a@b.com');
          expect(mounted.state().values).toEqual({ email: 'a@b.com' });
          expect(mounted.state().isDirty).toBe(true);
        },
        PHASE,
      );
    });

    group('program writes and server errors', () => {
      scenario(
        'setValue and setValues write without touching or reporting valuesChange, unless asked',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              textField('name', 'Name'),
            ]),
            props: { defaultValues: { email: '', name: '' } },
            events: EVENTS,
          });
          await mounted.call('setValue', 'email', 'x@y.z');
          expect(controlOf(mounted, 'email').value).toBe('x@y.z');
          expect(mounted.state().values).toEqual({ email: 'x@y.z', name: '' });
          expect(fieldState(mounted, 'email')).toMatchObject({
            isTouched: false,
            isDirty: true,
          });
          expect(details(mounted, 'valuesChange')).toEqual([]);

          await mounted.call('setValue', 'email', 'q@y.z', {
            shouldNotify: true,
          });
          expect(details(mounted, 'valuesChange')).toEqual([
            {
              values: { email: 'q@y.z', name: '' },
              names: ['email'],
              source: 'program',
              kind: 'set',
            },
          ]);

          mounted.clearEvents();
          await mounted.call('setValues', { email: 'a@b.co', name: 'Sam' });
          expect(controlOf(mounted, 'email').value).toBe('a@b.co');
          expect(controlOf(mounted, 'name').value).toBe('Sam');
          expect(details(mounted, 'valuesChange')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a program write checks what a user change would, unless told otherwise',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              checkbox('terms', 'Accept the terms', { isRequired: true }),
              textField('email', 'Email', { isRequired: true }),
            ]),
            props: {
              defaultValues: { terms: false, email: '' },
              validationMessages: { valueMissing: 'Fill this in' },
            },
          });
          // A change field checks on a program write.
          await mounted.call('setValue', 'terms', true);
          await expect.poll(() => statusOf(mounted, 'terms')).toBe('valid');

          // A blur field showing no error doesn't.
          await mounted.call('setValue', 'email', 'a');
          await pause(100);
          expect(statusOf(mounted, 'email')).toBe('unvalidated');

          await mounted.call('setValue', 'email', '', { validation: 'always' });
          await expect.poll(() => statusOf(mounted, 'email')).toBe('invalid');
          expectError(mounted, 'email', 'Fill this in');

          await mounted.call('setValue', 'email', 'b', { validation: 'never' });
          await pause(100);
          expect(fieldState(mounted, 'email')?.errors).toEqual([
            'Fill this in',
          ]);

          // A blur field showing an error checks on any change.
          await mounted.call('setValue', 'email', 'c');
          await expect.poll(() => statusOf(mounted, 'email')).toBe('valid');
          expectError(mounted, 'email', null);
        },
        PHASE,
      );

      scenario(
        'setDefaultValues moves the names no one changed',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              textField('name', 'Name'),
            ]),
            props: { defaultValues: { email: 'a@b.co', name: 'Jane' } },
          });
          await focusEnd(keyboard, controlOf(mounted, 'name'));
          await typeText(keyboard, 't');
          await mounted.call('setDefaultValues', {
            email: 'c@d.co',
            name: 'Sam',
          });
          expect(controlOf(mounted, 'email').value).toBe('c@d.co');
          expect(controlOf(mounted, 'name').value).toBe('Janet');
          expect(mounted.state()).toMatchObject({
            values: { email: 'c@d.co', name: 'Janet' },
            defaultValues: { email: 'c@d.co', name: 'Sam' },
          });
          expect(fieldState(mounted, 'email')?.isDirty).toBe(false);
          expect(fieldState(mounted, 'name')?.isDirty).toBe(true);
        },
        PHASE,
      );

      scenario(
        'a defaultValues prop that changes later moves the names no one changed',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email'),
              textField('name', 'Name'),
            ]),
            props: { defaultValues: { email: 'a@b.co', name: 'Jane' } },
          });
          await focusEnd(keyboard, controlOf(mounted, 'name'));
          await typeText(keyboard, 't');
          await mounted.setProps({
            defaultValues: { email: 'c@d.co', name: 'Sam' },
          });
          expect(controlOf(mounted, 'email').value).toBe('c@d.co');
          expect(controlOf(mounted, 'name').value).toBe('Janet');
          expect(mounted.state().values).toEqual({
            email: 'c@d.co',
            name: 'Janet',
          });
        },
        PHASE,
      );

      scenario(
        'setFieldErrors shows errors without moving focus; focusInvalid moves to them; clearFieldErrors clears them',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('name', 'Name'),
              textField('email', 'Email'),
            ]),
            props: { defaultValues: { name: 'Jane', email: 'a@b.co' } },
          });
          const before = byId(mounted, 'before');
          before.focus();
          await mounted.call('setFieldErrors', 'email', ['Already taken']);
          expectError(mounted, 'email', 'Already taken');
          expect(fieldState(mounted, 'email')).toMatchObject({
            errors: ['Already taken'],
            status: 'invalid',
          });
          await pause(100);
          expect(document.activeElement).toBe(before);

          await mounted.call('focusInvalid');
          const email = controlOf(mounted, 'email');
          await expect.poll(() => document.activeElement).toBe(email);
          expect(email.hasAttribute('data-focus-visible')).toBe(true);

          await mounted.call('clearFieldErrors', 'email');
          expect(fieldState(mounted, 'email')).toMatchObject({
            errors: [],
            status: 'valid',
          });
          expectError(mounted, 'email', null);
        },
        PHASE,
      );

      scenario(
        'a server error stays through other changes until its field is checked again',
        async ({ mount, keyboard, pointer }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([
              textField('name', 'Name'),
              textField('email', 'Email'),
            ]),
            props: {
              handleSubmit,
              defaultValues: { name: 'Jane', email: 'a@b.co' },
            },
          });
          await mounted.call('setFieldErrors', 'email', ['Already taken']);
          // Another field changes and is checked; Email isn't.
          await focusEnd(keyboard, controlOf(mounted, 'name'));
          await typeText(keyboard, 't');
          byId(mounted, 'before').focus();
          await expect.poll(() => statusOf(mounted, 'name')).toBe('valid');
          expectError(mounted, 'email', 'Already taken');

          await pointer.click(byId(mounted, 'submit'));
          await expect.poll(() => calls.length).toBe(1);
          expect(fieldState(mounted, 'email')).toMatchObject({
            errors: [],
            status: 'valid',
          });
          expectError(mounted, 'email', null);
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'validate() resolves with the result; isValid holds once every active, checked field passed',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([
              textField('name', 'Name', { isRequired: true }),
              textField('email', 'Email', { isRequired: true }),
            ]),
            props: {
              defaultValues: { name: 'Jane', email: '' },
              validationMessages: { valueMissing: 'Fill this in' },
            },
          });
          expect(mounted.state().isValid).toBe(false);
          const failed = (await mounted.call('validate')) as FormValidateResult;
          expect(failed.isValid).toBe(false);
          expect(failed.isStale).toBe(false);
          expect(failed.errors['email']).toEqual(['Fill this in']);
          expect(failed.errors['name'] ?? []).toEqual([]);
          expect(mounted.state()).toMatchObject({
            isValid: false,
            isInvalid: true,
          });

          await mounted.call('setValue', 'email', 'a@b.co');
          await expect.poll(() => statusOf(mounted, 'email')).toBe('valid');
          expect(mounted.state()).toMatchObject({
            isValid: true,
            isInvalid: false,
          });
          expect(await mounted.call('validate', ['email'])).toMatchObject({
            isValid: true,
            isStale: false,
          });
        },
        PHASE,
      );

      scenario(
        'touch marks a name touched or not, and canReset follows',
        async ({ mount }) => {
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: '' } },
          });
          expect(mounted.state().canReset).toBe(false);
          await mounted.call('touch', 'email');
          expect(fieldState(mounted, 'email')?.isTouched).toBe(true);
          expect(mounted.state()).toMatchObject({
            isTouched: true,
            canReset: true,
          });
          await mounted.call('touch', 'email', false);
          expect(fieldState(mounted, 'email')?.isTouched).toBe(false);
          expect(mounted.state()).toMatchObject({
            isTouched: false,
            canReset: false,
          });
        },
        PHASE,
      );

      scenario(
        'activeValues leaves out names with no field, and submitValues all sends them',
        async ({ mount }) => {
          const { calls, handleSubmit } = recorder();
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: {
              handleSubmit,
              defaultValues: { email: 'a@b.co', referrer: 'ad' },
            },
          });
          expect(mounted.state()).toMatchObject({
            values: { email: 'a@b.co', referrer: 'ad' },
            activeValues: { email: 'a@b.co' },
          });
          expect(mounted.state().activeValues).not.toHaveProperty('referrer');
          expect(fieldState(mounted, 'email')?.isActive).toBe(true);

          await mounted.call('submit');
          expect(calls[0]!.values).toEqual({ email: 'a@b.co' });

          await mounted.setProps({ submitValues: 'all' });
          await mounted.call('submit');
          expect(calls[1]!.values).toEqual({
            email: 'a@b.co',
            referrer: 'ad',
          });
        },
        PHASE,
      );
    });

    // Each scenario has its own message text, so a late announcement from
    // another scenario can't count.
    group('announcements', () => {
      scenario(
        'an error shown on leaving a field is announced assertively, with its label',
        async ({ mount, keyboard, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', {}, { type: 'email' }),
            ]),
            props: {
              validationMessages: { typeMismatch: 'Use a real address' },
            },
          });
          controlOf(mounted, 'email').focus();
          await typeText(keyboard, 'jane');
          await keyboard.tab();
          const expected = ['assertive: Email Use a real address'];
          await expect
            .poll(() => heardOf(heard, 'Use a real address'))
            .toEqual(expected);
          await settle();
          expect(await heardOf(heard, 'Use a real address')).toEqual(expected);
        },
        PHASE,
      );

      scenario(
        'errors a press on Submit shows aren’t announced, the blur’s included: focus reads them',
        async ({ mount, pointer, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
              textField('name', 'Name', { isRequired: true }),
            ]),
            props: {
              handleSubmit: () => undefined,
              validationMessages: { valueMissing: 'Enter something here' },
            },
          });
          const email = controlOf(mounted, 'email');
          email.focus();
          await pointer.click(byId(mounted, 'submit'));
          await expect.poll(() => document.activeElement).toBe(email);
          await settle();
          expect(await heardOf(heard, 'Enter something here')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'Enter in an invalid field keeps focus there, so the form announces its label and error',
        async ({ mount, keyboard, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([
              textField('email', 'Email', { isRequired: true }),
            ]),
            props: {
              handleSubmit: () => undefined,
              validationMessages: { valueMissing: 'Type your email' },
            },
          });
          const email = controlOf(mounted, 'email');
          email.focus();
          await keyboard.press('Enter');
          const expected = ['assertive: Email Type your email'];
          await expect
            .poll(() => heardOf(heard, 'Type your email'))
            .toEqual(expected);
          await settle();
          expect(await heardOf(heard, 'Type your email')).toEqual(expected);
          expect(document.activeElement).toBe(email);
        },
        PHASE,
      );

      scenario(
        'a shown error whose text changes while its control has focus isn’t announced again',
        async ({ mount, keyboard, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([
              textField('username', 'Username', {
                validate: (value: unknown) => {
                  const length = String(value ?? '').length;
                  return length < 4 ? `Add ${4 - length} more` : null;
                },
              }),
            ]),
          });
          const input = controlOf(mounted, 'username');
          input.focus();
          await typeText(keyboard, 'a');
          await keyboard.tab();
          await expect
            .poll(() => heardOf(heard, 'Add 3 more'))
            .toEqual(['assertive: Username Add 3 more']);

          await focusEnd(keyboard, input);
          await typeText(keyboard, 'b');
          await expect
            .poll(() => fieldPart(mounted, 'username', 'errorText').textContent)
            .toBe('Add 2 more');
          await settle();
          expect(await heardOf(heard, 'Add 2 more')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a field checked again through dependsOn isn’t announced',
        async ({ mount, keyboard, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([
              textField('password', 'Password'),
              textField('confirm', 'Confirm password', {
                dependsOn: ['password'],
                validate: (
                  value: unknown,
                  { values }: { values: FormValues },
                ) =>
                  value === values['password'] ? null : 'Retype the password',
              }),
            ]),
            props: { defaultValues: { password: '', confirm: '' } },
          });
          const password = controlOf(mounted, 'password');
          password.focus();
          await typeText(keyboard, 'abc');
          controlOf(mounted, 'confirm').focus();
          await typeText(keyboard, 'abc');
          await keyboard.tab();
          await expect.poll(() => statusOf(mounted, 'confirm')).toBe('valid');

          await focusEnd(keyboard, password);
          await typeText(keyboard, 'd');
          await expect.poll(() => statusOf(mounted, 'confirm')).toBe('invalid');
          await settle();
          expect(await heardOf(heard, 'Retype the password')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'setFieldErrors announces nothing',
        async ({ mount, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: { defaultValues: { email: 'a@b.co' } },
          });
          await mounted.call('setFieldErrors', 'email', ['Already registered']);
          expectError(mounted, 'email', 'Already registered');
          await settle();
          expect(await heardOf(heard, 'Already registered')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'the submit error is announced assertively when the error part shows',
        async ({ mount, pointer, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: signUp([textField('email', 'Email')]),
            props: {
              handleSubmit: () => Promise.reject(new Error('Server down')),
              defaultValues: { email: 'a@b.co' },
            },
          });
          await pointer.click(byId(mounted, 'submit'));
          const expected = ['assertive: Could not sign up'];
          await expect
            .poll(() => heardOf(heard, 'Could not sign up'))
            .toEqual(expected);
          await settle();
          expect(await heardOf(heard, 'Could not sign up')).toEqual(expected);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      /** The spec's setup: a required Email whose message is pinned. */
      const email = () =>
        signUp([
          textField('email', 'Email', {
            isRequired: true,
            validationMessages: { valueMissing: 'Enter your email' },
          }),
        ]);

      scenario(
        'reads the form by its heading',
        async ({ mount, spoken }) => {
          await mount({ template: email() });
          expect(await spoken()).toContain('form, Sign up');
        },
        PHASE,
      );

      scenario(
        'after a failed submit, Email reads its error, invalid and required',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({
            template: email(),
            props: { handleSubmit: () => undefined },
          });
          await pointer.click(byId(mounted, 'submit'));
          await expect
            .poll(() => document.activeElement)
            .toBe(controlOf(mounted, 'email'));
          expect(await spoken()).toContain(
            'textbox, Email, Enter your email, invalid, required',
          );
        },
        PHASE,
      );
    });
  },
);
