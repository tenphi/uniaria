/**
 * TextField conformance, from the spec approved by @tenphi on 2026-10-15
 * (`packages/core/src/components/text-field/spec.md`): Field composed on a
 * native input or textarea, the value (uncontrolled, controlled and
 * buffered, form reset), disabled and read-only, hover and focus on every
 * part, the wrapper press, public state, render counts and spoken output.
 * Field's own linking is Field's suite. Everything here is phase 3.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateElement, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { TextFieldProps, TextFieldState } from './types';

type MountedField = Mounted<TextFieldProps, TextFieldState>;

const PHASE = { phase: 3 } as const;

const PARTS = ['root', 'wrapper', 'label', 'input', 'description', 'error'];

const STATE_ATTRIBUTES = [
  'data-hovered',
  'data-focused',
  'data-focus-visible',
  'data-disabled',
  'data-readonly',
  'data-invalid',
  'data-required',
];

const EVENTS = ['valueChange', 'focusChange'];

interface EmailOptions {
  readonly input?: TemplateElement;
  /** More markup inside the wrapper, before the input: a prefix, a button. */
  readonly inWrapper?: readonly TemplateNode[];
}

/**
 * A root around a label, a wrapper with an email input, a description and an
 * error.
 */
function email({
  input = h('input', { part: 'input', type: 'email', name: 'email' }),
  inWrapper = [],
}: EmailOptions = {}): TemplateElement {
  return h(
    'div',
    { part: 'root' },
    h('label', { part: 'label' }, 'Email'),
    h('div', { part: 'wrapper' }, ...inWrapper, input),
    h('p', { part: 'description' }, 'We never share it'),
    h('p', { part: 'error' }, 'Enter a valid email'),
  );
}

/** Just a label and the input, as the spec's spoken-output table has it. */
function bare(input = h('input', { part: 'input' })): TemplateElement {
  return h(
    'div',
    { part: 'root' },
    h('label', { part: 'label' }, 'Email'),
    input,
  );
}

/** Types `text` into the focused element, one key press per character. */
async function typeText(
  keyboard: { press(key: string): Promise<void> },
  text: string,
): Promise<void> {
  for (const character of text) await keyboard.press(character);
}

/** The input element, typed. */
function inputOf(mounted: MountedField): HTMLInputElement {
  return mounted.part('input') as HTMLInputElement;
}

/** The `valueChange` details so far, in order. */
function changes(mounted: MountedField): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'valueChange')
    .map((event) => event.detail);
}

/** The `focusChange` details so far, in order. */
function focusChanges(mounted: MountedField): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'focusChange')
    .map((event) => event.detail);
}

/** A state attribute is on every part, or on none. */
function expectOnEveryPart(
  mounted: MountedField,
  attribute: string,
  present: boolean,
): void {
  for (const name of PARTS) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(present);
  }
}

/** A form with the field and a reset button. */
function inForm(field: TemplateElement): TemplateElement {
  return h('form', null, field, h('button', { type: 'reset' }, 'Reset'));
}

export const textFieldConformance = defineConformance<
  TextFieldProps,
  TextFieldState
>('text-field', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'composes Field on a native input, with nothing set while idle',
      async ({ mount }) => {
        const mounted = await mount({ template: email() });
        const input = inputOf(mounted);
        const label = mounted.part('label');
        expect(input.tagName).toBe('INPUT');
        expect(label.getAttribute('for')).toBe(input.id);
        expect(input.getAttribute('aria-labelledby')).toBe(label.id);
        expect(input.getAttribute('aria-describedby')).toBe(
          mounted.part('description').id,
        );
        expect(mounted.part('error').hidden).toBe(true);
        for (const name of [
          'disabled',
          'readonly',
          'required',
          'aria-invalid',
          'aria-required',
          'aria-disabled',
          'aria-readonly',
        ]) {
          expect(input.hasAttribute(name), name).toBe(false);
        }
        for (const attribute of STATE_ATTRIBUTES) {
          expectOnEveryPart(mounted, attribute, false);
        }
        expect(input.value).toBe('');
      },
      PHASE,
    );

    scenario(
      'works on a textarea, where Enter adds a line',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: email({
            input: h('textarea', { part: 'input', name: 'bio' }),
          }),
        });
        const input = mounted.part('input') as HTMLTextAreaElement;
        expect(input.tagName).toBe('TEXTAREA');
        expect(mounted.part('label').getAttribute('for')).toBe(input.id);

        input.focus();
        await typeText(keyboard, 'hi');
        await keyboard.press('Enter');
        await typeText(keyboard, 'yo');
        expect(input.value).toBe('hi\nyo');
        expect(mounted.state().value).toBe('hi\nyo');
      },
      PHASE,
    );

    scenario(
      'inputId is the id the label points at',
      async ({ mount }) => {
        const mounted = await mount({
          template: email({
            input: h('input', { part: 'input', id: 'work-email' }),
          }),
          props: { inputId: 'work-email' },
        });
        expect(inputOf(mounted).id).toBe('work-email');
        expect(mounted.part('label').getAttribute('for')).toBe('work-email');
      },
      PHASE,
    );
  });

  group('value', () => {
    scenario(
      'typing reports each change and keeps the text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: email(), events: EVENTS });
        const input = inputOf(mounted);
        input.focus();
        mounted.clearEvents();

        await typeText(keyboard, 'abc');
        expect(changes(mounted)).toEqual(['a', 'ab', 'abc']);
        expect(input.value).toBe('abc');
        expect(mounted.state().value).toBe('abc');

        await keyboard.press('Backspace');
        expect(changes(mounted).at(-1)).toBe('ab');
        expect(mounted.state().value).toBe('ab');
      },
      PHASE,
    );

    scenario(
      'defaultValue fills the input without reporting a change',
      async ({ mount }) => {
        const mounted = await mount({
          template: email(),
          props: { defaultValue: 'jane' },
          events: EVENTS,
        });
        expect(inputOf(mounted).value).toBe('jane');
        expect(mounted.state().value).toBe('jane');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a controlled value follows props without reporting a change',
      async ({ mount }) => {
        const mounted = await mount({
          template: email(),
          props: { value: 'jane' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        expect(input.value).toBe('jane');

        await mounted.setProps({ value: 'bob' });
        expect(input.value).toBe('bob');
        expect(mounted.state().value).toBe('bob');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'controlled: the typed text stays while the consumer answers, and a late echo leaves it alone',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          // A text input: an email input has no caret position.
          template: email({
            input: h('input', { part: 'input', name: 'email' }),
          }),
          props: { value: '' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        mounted.clearEvents();

        await typeText(keyboard, 'ab');
        expect(changes(mounted)).toEqual(['a', 'ab']);
        expect(input.value).toBe('ab');
        expect(mounted.state().value).toBe('');

        // The consumer answers late: first the echo of the first keystroke.
        await mounted.setProps({ value: 'a' });
        expect(input.value).toBe('ab');
        await mounted.setProps({ value: 'ab' });
        expect(input.value).toBe('ab');
        expect(input.selectionStart).toBe(2);
        expect(mounted.state().value).toBe('ab');
      },
      PHASE,
    );

    scenario(
      'controlled: a transformed value replaces the typed text at once',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: email(),
          props: { value: '' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();

        await typeText(keyboard, 'a');
        expect(changes(mounted)).toEqual(['a']);
        await mounted.setProps({ value: 'A' });
        expect(input.value).toBe('A');

        await typeText(keyboard, 'b');
        expect(changes(mounted).at(-1)).toBe('Ab');
        await mounted.setProps({ value: 'AB' });
        expect(input.value).toBe('AB');
      },
      PHASE,
    );

    scenario(
      'controlled: a value from outside replaces the typed text at once',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: email(),
          props: { value: '' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();

        await typeText(keyboard, 'ab');
        await mounted.setProps({ value: 'hello' });
        expect(input.value).toBe('hello');
        expect(mounted.state().value).toBe('hello');
      },
      PHASE,
    );

    scenario(
      'controlled: a value the consumer never accepts is put back on blur',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: email(),
          props: { value: '' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();

        await typeText(keyboard, 'y');
        expect(changes(mounted)).toEqual(['y']);
        expect(input.value).toBe('y');

        input.blur();
        expect(input.value).toBe('');
        expect(mounted.state().value).toBe('');
      },
      PHASE,
    );

    scenario(
      'form reset returns an uncontrolled field to its default',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: inForm(email()),
          props: { defaultValue: 'jane' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, 'x');
        expect(input.value).not.toBe('jane');

        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await pointer.click(reset);
        await expect.poll(() => input.value).toBe('jane');
        expect(mounted.state().value).toBe('jane');
        expect(changes(mounted).at(-1)).toBe('jane');
      },
      PHASE,
    );

    scenario(
      'form reset follows a default set after mount, with or without a change',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: inForm(email()),
          events: EVENTS,
        });
        const input = inputOf(mounted);
        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await mounted.setProps({ defaultValue: 'jane' });
        expect(input.value).toBe('jane');

        // Unchanged: the default stays, and nothing is reported.
        await pointer.click(reset);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(input.value).toBe('jane');
        expect(mounted.state().value).toBe('jane');
        expect(changes(mounted)).toEqual([]);

        // Changed, then a new default: the reset goes back to it.
        input.focus();
        await typeText(keyboard, 'x');
        const typed = input.value;
        expect(typed).not.toBe('jane');
        await mounted.setProps({ defaultValue: 'bob' });
        expect(input.value).toBe(typed);
        await pointer.click(reset);
        await expect.poll(() => input.value).toBe('bob');
        expect(mounted.state().value).toBe('bob');
        expect(changes(mounted)).toEqual([typed, 'bob']);
      },
      PHASE,
    );

    scenario(
      'form reset asks a controlled field for the value it mounted with',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(email()),
          props: { value: 'jane' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        await mounted.setProps({ value: 'bob' });
        mounted.clearEvents();

        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await pointer.click(reset);
        expect(changes(mounted)).toEqual(['jane']);
        // Still the controlled value until the consumer accepts.
        await expect.poll(() => input.value).toBe('bob');

        await mounted.setProps({ value: 'jane' });
        expect(input.value).toBe('jane');
      },
      PHASE,
    );

    scenario(
      'a reset the page cancels changes nothing',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: inForm(email()),
          props: { defaultValue: 'jane' },
          events: EVENTS,
        });
        mounted.container.addEventListener(
          'reset',
          (event) => event.preventDefault(),
          { capture: true },
        );
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, 'x');
        const typed = input.value;
        mounted.clearEvents();

        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await pointer.click(reset);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(input.value).toBe(typed);
        expect(mounted.state().value).toBe(typed);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('states', () => {
    scenario(
      'isDisabled disables the input natively and marks every part',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: email(),
          props: { isDisabled: true, isInvalid: true },
        });
        const input = inputOf(mounted);
        expect(input.disabled).toBe(true);
        expectOnEveryPart(mounted, 'data-disabled', true);
        // Field: the error hides while disabled; invalid stays.
        expect(mounted.part('error').hidden).toBe(true);
        expect(input.getAttribute('aria-invalid')).toBe('true');

        await pointer.click(input);
        expect(document.activeElement).not.toBe(input);

        await mounted.setProps({ isDisabled: false });
        expect(input.disabled).toBe(false);
        expectOnEveryPart(mounted, 'data-disabled', false);
      },
      PHASE,
    );

    scenario(
      'isReadOnly makes the input read-only natively and keeps it focusable',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: email(),
          props: { isReadOnly: true, defaultValue: 'jane' },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        expect(input.readOnly).toBe(true);
        expect(input.hasAttribute('aria-readonly')).toBe(false);
        expectOnEveryPart(mounted, 'data-readonly', true);

        input.focus();
        expect(document.activeElement).toBe(input);
        await typeText(keyboard, 'x');
        expect(input.value).toBe('jane');
        expect(changes(mounted)).toEqual([]);

        await mounted.setProps({ isReadOnly: false });
        expect(input.readOnly).toBe(false);
        expectOnEveryPart(mounted, 'data-readonly', false);
      },
      PHASE,
    );

    scenario(
      "isRequired and isInvalid are Field's",
      async ({ mount }) => {
        const mounted = await mount({
          template: email(),
          props: { isRequired: true, isInvalid: true },
        });
        const input = inputOf(mounted);
        expect(input.getAttribute('aria-required')).toBe('true');
        expect(input.hasAttribute('required')).toBe(false);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(
          mounted.part('error').id,
        );
        expectOnEveryPart(mounted, 'data-required', true);
        expectOnEveryPart(mounted, 'data-invalid', true);
      },
      PHASE,
    );
  });

  group('hover and focus', () => {
    scenario(
      'hovering the input marks every part; the label does not count',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: email() });
        const input = inputOf(mounted);

        await pointer.move(mounted.part('label'));
        expect(mounted.state().isHovered).toBe(false);
        expectOnEveryPart(mounted, 'data-hovered', false);

        await pointer.move(input);
        expect(mounted.state().isHovered).toBe(true);
        expectOnEveryPart(mounted, 'data-hovered', true);

        await pointer.moveOutside(input);
        expect(mounted.state().isHovered).toBe(false);
        expectOnEveryPart(mounted, 'data-hovered', false);
      },
      PHASE,
    );

    scenario(
      'focus marks every part, and only keyboard focus is visible',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: [h('button', { type: 'button' }, 'Before'), email()],
        });
        const input = inputOf(mounted);
        mounted.container.querySelector('button')!.focus();

        await keyboard.tab();
        expect(document.activeElement).toBe(input);
        expectOnEveryPart(mounted, 'data-focused', true);
        expectOnEveryPart(mounted, 'data-focus-visible', true);
        expect(mounted.state()).toMatchObject({
          isFocused: true,
          isFocusVisible: true,
        });

        input.blur();
        expectOnEveryPart(mounted, 'data-focused', false);
        expectOnEveryPart(mounted, 'data-focus-visible', false);

        await pointer.click(input);
        expectOnEveryPart(mounted, 'data-focused', true);
        expectOnEveryPart(mounted, 'data-focus-visible', false);
        // Typing never makes focus visible.
        await typeText(keyboard, 'a');
        expectOnEveryPart(mounted, 'data-focus-visible', false);
      },
      PHASE,
    );

    scenario(
      'focusChange reports focus and blur',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: email(), events: EVENTS });
        const input = inputOf(mounted);
        await pointer.click(input);
        input.blur();
        expect(focusChanges(mounted)).toEqual([true, false]);
      },
      PHASE,
    );

    scenario(
      'a press on the wrapper outside any control focuses the input; on the rest of the root, not',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: email({
            inWrapper: [
              h('span', { id: 'prefix' }, '@'),
              // tabindex: WebKit focuses a clicked button only with one.
              h(
                'button',
                { type: 'button', id: 'action', tabindex: '0' },
                'Paste',
              ),
            ],
          }),
        });
        const input = inputOf(mounted);
        const prefix = mounted.container.querySelector('#prefix')!;
        const action = mounted.container.querySelector('#action')!;

        await pointer.click(prefix);
        expect(document.activeElement).toBe(input);

        // Another control inside the wrapper keeps its own press.
        await pointer.click(action);
        expect(document.activeElement).toBe(action);

        // The root around the wrapper only holds the parts.
        await pointer.click(mounted.part('description'));
        expect(document.activeElement).not.toBe(input);
      },
      PHASE,
    );
  });

  group('state and renders', () => {
    scenario(
      'public state reports the value, interaction and the props',
      async ({ mount }) => {
        const mounted = await mount({
          template: email(),
          props: { defaultValue: 'jane' },
        });
        expect(mounted.state()).toEqual({
          value: 'jane',
          isFocused: false,
          isFocusVisible: false,
          isHovered: false,
          isDisabled: false,
          isReadOnly: false,
          isRequired: false,
          isInvalid: false,
          isErrorShown: false,
        });
      },
      PHASE,
    );

    scenario(
      'typing, hovering and focusing never re-render the owner',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({ template: email(), events: EVENTS });
        const input = inputOf(mounted);
        const renders = mounted.renderCount();

        await pointer.move(input);
        await pointer.click(input);
        await typeText(keyboard, 'abc');
        await keyboard.press('Backspace');

        expect(changes(mounted)).toEqual(['a', 'ab', 'abc', 'ab']);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the label of an empty field',
      async ({ mount, spoken }) => {
        await mount({ template: bare() });
        expect(await spoken()).toContain('textbox, Email');
      },
      PHASE,
    );

    scenario(
      'reads the typed value',
      async ({ mount, keyboard, spoken }) => {
        const mounted = await mount({ template: bare() });
        inputOf(mounted).focus();
        await typeText(keyboard, 'jane');
        expect(await spoken()).toContain('textbox, Email, jane');
      },
      PHASE,
    );

    scenario(
      'reads a controlled value',
      async ({ mount, spoken }) => {
        await mount({
          template: bare(),
          props: { value: 'jane@example.com' },
        });
        expect(await spoken()).toContain('textbox, Email, jane@example.com');
      },
      PHASE,
    );

    scenario(
      'reads the placeholder of an empty field',
      async ({ mount, spoken }) => {
        await mount({
          template: bare(
            h('input', { part: 'input', placeholder: 'you@example.com' }),
          ),
        });
        expect(await spoken()).toContain(
          'textbox, Email, placeholder you@example.com',
        );
      },
      PHASE,
    );

    scenario(
      'reads read only after the value',
      async ({ mount, spoken }) => {
        await mount({
          template: bare(),
          props: { isReadOnly: true, defaultValue: 'jane@example.com' },
        });
        expect(await spoken()).toContain(
          'textbox, Email, jane@example.com, read only',
        );
      },
      PHASE,
    );

    scenario(
      'reads disabled',
      async ({ mount, spoken }) => {
        await mount({ template: bare(), props: { isDisabled: true } });
        expect(await spoken()).toContain('textbox, Email, disabled');
      },
      PHASE,
    );

    scenario(
      'reads a textarea as a textbox',
      async ({ mount, spoken }) => {
        await mount({ template: bare(h('textarea', { part: 'input' })) });
        expect(await spoken()).toContain('textbox, Email');
      },
      PHASE,
    );

    scenario(
      'reads the value before the description',
      async ({ mount, spoken }) => {
        await mount({ template: email(), props: { defaultValue: 'jane' } });
        expect(await spoken()).toContain(
          'textbox, Email, jane, We never share it',
        );
      },
      PHASE,
    );
  });

  group('real screen readers', () => {
    scenario(
      'Tab reads the field by its label and description, and typing echoes',
      async ({ mount, screenReader }) => {
        const heard = {
          voiceover: { field: /Email We never share it/, typed: /^a$/ },
          nvda: {
            field: /Email, edit, We never share it, blank/,
            typed: /^a$/,
          },
        }[screenReader.name];
        const mounted = await mount({
          template: [
            h('input', { id: 'before', 'aria-label': 'Before' }),
            email(),
          ],
        });
        await screenReader.startFrom(
          mounted.container.querySelector<HTMLElement>('#before')!,
        );
        await screenReader.press('Tab');
        expect.soft(await screenReader.spoken()).toMatch(heard.field);
        await screenReader.type('a');
        expect.soft(await screenReader.spoken()).toMatch(heard.typed);
      },
      { ...PHASE, needs: ['screenReader'] },
    );
  });
});
