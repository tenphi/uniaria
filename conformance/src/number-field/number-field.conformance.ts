/**
 * NumberField conformance, from the spec approved by @tenphi on 2026-10-17
 * (`packages/core/src/components/number-field/spec.md`): a text input with a
 * role description, parsing and formatting for the locale, typing checked
 * edit by edit, commits (clamp, snap, round), stepping by keys, the buttons
 * held and the wheel, controlled values, forms, announcements, public state
 * and spoken output. Field's own linking is Field's suite. Everything here is
 * phase 4.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateElement, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { NumberFieldProps, NumberFieldState } from './types';

type MountedField = Mounted<NumberFieldProps, NumberFieldState>;

const PHASE = { phase: 4 } as const;
const TOUCH = { phase: 4, needs: ['touch'] } as const;

const FIELD_PARTS = [
  'root',
  'wrapper',
  'label',
  'input',
  'description',
  'error',
];

const EVENTS = ['valueChange', 'focusChange'];

interface QuantityOptions {
  /** The label's text; `null` renders no label part. */
  readonly label?: string | null;
  /** The root's language, which the field formats for. */
  readonly lang?: string;
  /** More markup inside the wrapper, before the input. */
  readonly inWrapper?: readonly TemplateNode[];
  readonly error?: string;
}

/**
 * A root around a label, a wrapper with the input and both buttons, the
 * hidden input, a description and an error, in English unless `lang` says
 * otherwise.
 */
function quantity({
  label = 'Quantity',
  lang = 'en-US',
  inWrapper = [],
  error = 'Order at most 10',
}: QuantityOptions = {}): TemplateElement {
  return h(
    'div',
    { part: 'root', lang },
    ...(label === null ? [] : [h('label', { part: 'label' }, label)]),
    h(
      'div',
      { part: 'wrapper' },
      ...inWrapper,
      h('input', { part: 'input' }),
      h('button', { part: 'decrement' }, '−'),
      h('button', { part: 'increment' }, '+'),
    ),
    h('input', { part: 'hiddenInput', name: 'quantity' }),
    h('p', { part: 'description' }, 'How many to order'),
    h('p', { part: 'error' }, error),
  );
}

/** A label and the input, as the spec's spoken-output table has it. */
function bare({
  label = 'Quantity',
  lang = 'en-US',
  error,
  withButtons = false,
}: {
  label?: string;
  lang?: string;
  error?: string;
  withButtons?: boolean;
} = {}): TemplateElement {
  return h(
    'div',
    { part: 'root', lang },
    h('label', { part: 'label' }, label),
    h('input', { part: 'input' }),
    ...(withButtons
      ? [
          h('button', { part: 'decrement' }, '−'),
          h('button', { part: 'increment' }, '+'),
        ]
      : []),
    ...(error === undefined ? [] : [h('p', { part: 'error' }, error)]),
  );
}

/** Types `text` into the focused element, one key press per character. */
async function typeText(
  keyboard: { press(key: string): Promise<void> },
  text: string,
): Promise<void> {
  for (const character of text) await keyboard.press(character);
}

/** Focuses the input with all its text selected, so typing replaces it. */
function selectAll(mounted: MountedField): HTMLInputElement {
  const input = inputOf(mounted);
  input.focus();
  input.select();
  return input;
}

function inputOf(mounted: MountedField): HTMLInputElement {
  return mounted.part('input') as HTMLInputElement;
}

function hiddenOf(mounted: MountedField): HTMLInputElement {
  return mounted.part('hiddenInput') as HTMLInputElement;
}

/** The `valueChange` details so far, in order. */
function changes(mounted: MountedField): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'valueChange')
    .map((event) => event.detail);
}

/** A state attribute is on every field part, or on none. */
function expectOnEveryPart(
  mounted: MountedField,
  attribute: string,
  present: boolean,
): void {
  for (const name of FIELD_PARTS) {
    expect(
      mounted.part(name).hasAttribute(attribute),
      `${attribute} on ${name}`,
    ).toBe(present);
  }
}

/**
 * Pastes `text` over the input's selection. Not every engine lets a test
 * write the real clipboard, so the event is synthetic; the field handles the
 * paste itself, as in React Aria. Firefox empties the data a synthetic
 * `ClipboardEvent` is constructed with, so it goes on the event itself.
 */
function paste(input: HTMLInputElement, text: string): ClipboardEvent {
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/plain', text);
  const event = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  input.dispatchEvent(event);
  return event;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A form around the field, with a submit and a reset button. */
function inForm(field: TemplateElement): TemplateElement {
  return h(
    'form',
    null,
    field,
    h('button', { type: 'submit' }, 'Order'),
    h('button', { type: 'reset' }, 'Reset'),
  );
}

function formOf(mounted: MountedField): HTMLFormElement {
  return mounted.container.querySelector('form')!;
}

/** Records whether the page saw a key or wheel event already handled. */
function defaultPrevented(type: 'keydown' | 'wheel'): () => boolean[] {
  const seen: boolean[] = [];
  const listener = (event: Event) => seen.push(event.defaultPrevented);
  document.addEventListener(type, listener);
  return () => {
    document.removeEventListener(type, listener);
    return seen;
  };
}

export const numberFieldConformance = defineConformance<
  NumberFieldProps,
  NumberFieldState
>('number-field', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'a text input with a role description and no spin button values',
      async ({ mount }) => {
        const mounted = await mount({ template: quantity() });
        const input = inputOf(mounted);
        const label = mounted.part('label');
        expect(input.type).toBe('text');
        expect(input.getAttribute('inputmode')).toBe('numeric');
        expect(input.getAttribute('autocomplete')).toBe('off');
        expect(input.getAttribute('autocorrect')).toBe('off');
        expect(input.getAttribute('spellcheck')).toBe('false');
        expect(input.getAttribute('aria-roledescription')).toBe('Number field');
        expect(label.getAttribute('for')).toBe(input.id);
        expect(input.getAttribute('aria-labelledby')).toBe(label.id);
        for (const name of [
          'role',
          'name',
          'aria-valuenow',
          'aria-valuemin',
          'aria-valuemax',
          'aria-valuetext',
          'aria-invalid',
        ]) {
          expect(input.hasAttribute(name), name).toBe(false);
        }
        expect(mounted.part().hasAttribute('role')).toBe(false);
        expect(input.value).toBe('');
      },
      PHASE,
    );

    scenario(
      'the buttons are out of the Tab order and named "Increase" and "Decrease" with the label',
      async ({ mount }) => {
        const mounted = await mount({ template: quantity() });
        const input = inputOf(mounted);
        const label = mounted.part('label');
        for (const [name, word] of [
          ['increment', 'Increase'],
          ['decrement', 'Decrease'],
        ] as const) {
          const button = mounted.part(name);
          expect(button.getAttribute('type'), name).toBe('button');
          expect(button.getAttribute('tabindex'), name).toBe('-1');
          expect(button.getAttribute('aria-label'), name).toBe(word);
          expect(button.getAttribute('aria-labelledby'), name).toBe(
            `${button.id} ${label.id}`,
          );
          expect(button.getAttribute('aria-controls'), name).toBe(input.id);
          expect(button.hasAttribute('aria-disabled'), name).toBe(false);
        }
      },
      PHASE,
    );

    scenario(
      'labelledBy joins the buttons’ names; without a label part they are just their word',
      async ({ mount }) => {
        const withExtra = await mount({
          template: [h('span', { id: 'unit' }, 'boxes'), quantity()],
          props: { labelledBy: 'unit' },
        });
        const increment = withExtra.part('increment');
        expect(increment.getAttribute('aria-labelledby')).toBe(
          `${increment.id} ${withExtra.part('label').id} unit`,
        );

        const unlabelled = await mount({
          template: quantity({ label: null }),
        });
        expect(
          unlabelled.part('increment').hasAttribute('aria-labelledby'),
        ).toBe(false);
        expect(unlabelled.part('increment').getAttribute('aria-label')).toBe(
          'Increase',
        );
      },
      PHASE,
    );

    scenario(
      'a passed button name is the whole name, in any word order',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity({ label: 'Menge', lang: 'de-DE' }),
          props: {
            incrementLabel: 'Menge erhöhen',
            decrementLabel: 'Menge verringern',
          },
        });
        const increment = mounted.part('increment');
        const decrement = mounted.part('decrement');
        expect(increment.getAttribute('aria-label')).toBe('Menge erhöhen');
        expect(decrement.getAttribute('aria-label')).toBe('Menge verringern');
        expect(increment.hasAttribute('aria-labelledby')).toBe(false);
        expect(decrement.hasAttribute('aria-labelledby')).toBe(false);
      },
      PHASE,
    );

    scenario(
      'the role description is English only: another language has none unless one is passed',
      async ({ mount }) => {
        const german = await mount({
          template: quantity({ label: 'Menge', lang: 'de-DE' }),
        });
        expect(inputOf(german).hasAttribute('aria-roledescription')).toBe(
          false,
        );

        const passed = await mount({
          template: quantity({ label: 'Menge', lang: 'de-DE' }),
          props: { roleDescription: 'Zahlenfeld' },
        });
        expect(inputOf(passed).getAttribute('aria-roledescription')).toBe(
          'Zahlenfeld',
        );
      },
      PHASE,
    );

    scenario(
      'the hidden input carries the committed number as plain digits',
      async ({ mount }) => {
        const empty = await mount({ template: quantity() });
        const emptyHidden = hiddenOf(empty);
        expect(emptyHidden.type).toBe('hidden');
        expect(emptyHidden.value).toBe('');
        expect(inputOf(empty).hasAttribute('name')).toBe(false);

        const filled = await mount({
          template: quantity({ lang: 'de-DE' }),
          props: { defaultValue: 1234.5 },
        });
        expect(inputOf(filled).value).toBe('1.234,5');
        expect(hiddenOf(filled).value).toBe('1234.5');
      },
      PHASE,
    );
  });

  group('formatting and locale', () => {
    scenario(
      'formats the value for the locale prop',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { locale: 'de-DE', defaultValue: 1234.5 },
        });
        expect(inputOf(mounted).value).toBe('1.234,5');
      },
      PHASE,
    );

    scenario(
      'without a locale prop, the input’s nearest lang decides, for typing too',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity({ lang: 'de-DE' }),
          props: { defaultValue: 1234.5 },
          events: EVENTS,
        });
        expect(inputOf(mounted).value).toBe('1.234,5');

        selectAll(mounted);
        await typeText(keyboard, '2,5');
        await keyboard.press('Enter');
        expect(mounted.state().value).toBe(2.5);
        expect(inputOf(mounted).value).toBe('2,5');
      },
      PHASE,
    );

    scenario(
      'formats currencies and percentages',
      async ({ mount }) => {
        const euros = await mount({
          template: quantity(),
          props: {
            defaultValue: 12.5,
            formatOptions: { style: 'currency', currency: 'EUR' },
          },
        });
        expect(inputOf(euros).value).toBe('€12.50');

        const share = await mount({
          template: quantity(),
          props: { defaultValue: 0.25, formatOptions: { style: 'percent' } },
        });
        expect(inputOf(share).value).toBe('25%');
        expect(hiddenOf(share).value).toBe('0.25');
      },
      PHASE,
    );

    scenario(
      'a new locale formats the text again; equal format options change nothing',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: {
            defaultValue: 1234.5,
            formatOptions: { maximumFractionDigits: 2 },
          },
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '12');

        // A new object with the same options keeps the typed text.
        await mounted.setProps({ formatOptions: { maximumFractionDigits: 2 } });
        expect(input.value).toBe('12');

        await mounted.setProps({ locale: 'de-DE' });
        expect(input.value).toBe('1.234,5');
        expect(mounted.state().value).toBe(1234.5);
      },
      PHASE,
    );
  });

  group('typing and commit', () => {
    scenario(
      'typing reports nothing; blur commits and reports the number',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: quantity(), events: EVENTS });
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, '1234');
        expect(input.value).toBe('1234');
        expect(changes(mounted)).toEqual([]);
        expect(mounted.state().value).toBe(null);

        input.blur();
        expect(changes(mounted)).toEqual([1234]);
        expect(input.value).toBe('1,234');
        expect(hiddenOf(mounted).value).toBe('1234');
      },
      PHASE,
    );

    scenario(
      'refuses an edit that leaves no number in the making',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: quantity() });
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, '1a2');
        expect(input.value).toBe('12');
        await typeText(keyboard, '..3');
        expect(input.value).toBe('12.3');
      },
      PHASE,
    );

    scenario(
      'a minus sign only when the minimum allows one',
      async ({ mount, keyboard }) => {
        const positive = await mount({
          template: quantity(),
          props: { minValue: 0 },
        });
        inputOf(positive).focus();
        await typeText(keyboard, '-5');
        expect(inputOf(positive).value).toBe('5');

        const any = await mount({ template: quantity() });
        inputOf(any).focus();
        await typeText(keyboard, '-5');
        expect(inputOf(any).value).toBe('-5');
      },
      PHASE,
    );

    scenario(
      'a decimal separator only when the format shows fractions',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { formatOptions: { maximumFractionDigits: 0 } },
        });
        inputOf(mounted).focus();
        await typeText(keyboard, '1.5');
        expect(inputOf(mounted).value).toBe('15');
      },
      PHASE,
    );

    scenario(
      'Enter commits within the bounds',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { minValue: 0, maxValue: 10 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, '25');
        await keyboard.press('Enter');
        expect(input.value).toBe('10');
        expect(changes(mounted)).toEqual([10]);
        expect(document.activeElement).toBe(input);
      },
      PHASE,
    );

    scenario(
      'a commit snaps to the step counted from the minimum, never past the last step',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { minValue: 2, maxValue: 21, step: 3 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '7');
        await keyboard.press('Enter');
        expect(input.value).toBe('8');

        input.select();
        await typeText(keyboard, '21');
        await keyboard.press('Enter');
        expect(input.value).toBe('20');
        expect(changes(mounted)).toEqual([8, 20]);
      },
      PHASE,
    );

    scenario(
      'a commit rounds to the precision the format shows',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: quantity(), events: EVENTS });
        const input = inputOf(mounted);
        input.focus();
        await typeText(keyboard, '1.23456');
        input.blur();
        expect(input.value).toBe('1.235');
        expect(changes(mounted)).toEqual([1.235]);
      },
      PHASE,
    );

    scenario(
      'clearing the text commits null',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await keyboard.press('Backspace');
        input.blur();
        expect(changes(mounted)).toEqual([null]);
        expect(mounted.state().value).toBe(null);
        expect(hiddenOf(mounted).value).toBe('');
      },
      PHASE,
    );

    scenario(
      'text that is no number goes back to the value, and nothing is reported',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '-');
        expect(input.value).toBe('-');
        input.blur();
        expect(input.value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a commit that keeps the value reports nothing and formats the text',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '5.0');
        input.blur();
        expect(input.value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a paste over all the text commits at once',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { formatOptions: { style: 'currency', currency: 'USD' } },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        const event = paste(input, ' $1,234.50 ');
        expect(event.defaultPrevented).toBe(true);
        expect(input.value).toBe('$1,234.50');
        expect(changes(mounted)).toEqual([1234.5]);
      },
      PHASE,
    );

    scenario(
      'a paste into part of the text is left to the browser',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 12 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        input.setSelectionRange(1, 1);
        expect(paste(input, '3').defaultPrevented).toBe(false);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('keyboard', () => {
    scenario(
      'ArrowUp and ArrowDown step and report at once',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('6');
        await keyboard.press('ArrowDown');
        await keyboard.press('ArrowDown');
        expect(input.value).toBe('4');
        expect(changes(mounted)).toEqual([6, 5, 4]);
        expect(hiddenOf(mounted).value).toBe('4');
      },
      PHASE,
    );

    scenario(
      'from an empty field, up goes to the minimum and down to the maximum, else 0',
      async ({ mount, keyboard }) => {
        const bounded = await mount({
          template: quantity(),
          props: { minValue: 2, maxValue: 9 },
        });
        const input = inputOf(bounded);
        input.focus();
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('2');
        input.select();
        await keyboard.press('Backspace');
        await keyboard.press('ArrowDown');
        expect(input.value).toBe('9');

        const open = await mount({ template: quantity() });
        inputOf(open).focus();
        await keyboard.press('ArrowDown');
        expect(inputOf(open).value).toBe('0');
      },
      PHASE,
    );

    scenario(
      'steps from the typed text, and off the step to the next step that way',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5, step: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '2');
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('5');

        input.select();
        await typeText(keyboard, '7');
        await keyboard.press('ArrowDown');
        expect(input.value).toBe('5');

        input.select();
        await typeText(keyboard, '20');
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('25');
        expect(changes(mounted)).toEqual([25]);
      },
      PHASE,
    );

    scenario(
      'steps add in decimal, and percentages step by 1%',
      async ({ mount, keyboard }) => {
        const decimal = await mount({
          template: quantity(),
          props: { defaultValue: 0.2, step: 0.1 },
        });
        inputOf(decimal).focus();
        await keyboard.press('ArrowUp');
        expect(inputOf(decimal).value).toBe('0.3');
        expect(decimal.state().value).toBe(0.3);

        const share = await mount({
          template: quantity(),
          props: { defaultValue: 0.25, formatOptions: { style: 'percent' } },
        });
        inputOf(share).focus();
        await keyboard.press('ArrowUp');
        expect(inputOf(share).value).toBe('26%');
        expect(share.state().value).toBe(0.26);
      },
      PHASE,
    );

    scenario(
      'PageUp and PageDown move by ten steps, or by pageStep',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
        });
        const input = inputOf(mounted);
        input.focus();
        await keyboard.press('PageUp');
        expect(input.value).toBe('15');
        await keyboard.press('PageDown');
        expect(input.value).toBe('5');

        await mounted.setProps({ pageStep: 3 });
        await keyboard.press('PageDown');
        expect(input.value).toBe('2');
      },
      PHASE,
    );

    scenario(
      'Home and End go to the bounds when they are set',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 8, minValue: 2, maxValue: 21, step: 3 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await keyboard.press('End');
        expect(input.value).toBe('20');
        await keyboard.press('Home');
        expect(input.value).toBe('2');
        expect(changes(mounted)).toEqual([20, 2]);
      },
      PHASE,
    );

    scenario(
      'without bounds, Home and End keep their native meaning',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 123 },
          events: EVENTS,
        });
        inputOf(mounted).focus();
        const seen = defaultPrevented('keydown');
        await keyboard.press('Home');
        await keyboard.press('End');
        expect(seen()).toEqual([false, false]);
        expect(inputOf(mounted).value).toBe('123');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'at a bound a step does nothing and its button is disabled',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 10, maxValue: 10 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        const increment = mounted.part('increment');
        expect(increment.getAttribute('aria-disabled')).toBe('true');
        expect(increment.hasAttribute('data-disabled')).toBe(true);
        expect(increment.hasAttribute('disabled')).toBe(false);
        expect(mounted.state()).toMatchObject({
          canIncrement: false,
          canDecrement: true,
        });

        input.focus();
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('10');
        expect(changes(mounted)).toEqual([]);

        await keyboard.press('ArrowDown');
        expect(input.value).toBe('9');
        expect(increment.hasAttribute('aria-disabled')).toBe(false);
      },
      PHASE,
    );

    scenario(
      'canIncrement follows the text as it is typed',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { maxValue: 15 },
          events: EVENTS,
        });
        inputOf(mounted).focus();
        await typeText(keyboard, '100');
        expect(mounted.state().canIncrement).toBe(false);
        expect(mounted.part('increment').getAttribute('aria-disabled')).toBe(
          'true',
        );
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'keys with modifiers keep their native meaning',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        inputOf(mounted).focus();
        await keyboard.down('Shift');
        await keyboard.press('ArrowUp');
        await keyboard.up('Shift');
        expect(inputOf(mounted).value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a key a handler already prevented is left alone',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        mounted.container.addEventListener(
          'keydown',
          (event) => event.preventDefault(),
          { capture: true },
        );
        inputOf(mounted).focus();
        await keyboard.press('ArrowUp');
        expect(inputOf(mounted).value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('buttons', () => {
    scenario(
      'a click steps once and focuses the input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        await pointer.click(mounted.part('increment'));
        expect(inputOf(mounted).value).toBe('6');
        expect(document.activeElement).toBe(inputOf(mounted));
        await pointer.click(mounted.part('decrement'));
        expect(changes(mounted)).toEqual([6, 5]);
      },
      PHASE,
    );

    scenario(
      'a click steps from the typed text and leaves focus in the input',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '3');
        await pointer.click(mounted.part('increment'));
        expect(input.value).toBe('4');
        expect(document.activeElement).toBe(input);
        expect(changes(mounted)).toEqual([4]);
      },
      PHASE,
    );

    scenario(
      'held, a button repeats after 400 ms and stops at the bound',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5, maxValue: 8 },
          events: EVENTS,
        });
        const increment = mounted.part('increment');
        await pointer.down(increment);
        expect(inputOf(mounted).value).toBe('6');
        await wait(250);
        expect(inputOf(mounted).value).toBe('6');
        await expect.poll(() => inputOf(mounted).value).toBe('8');
        await pointer.up();
        expect(changes(mounted)).toEqual([6, 7, 8]);
      },
      PHASE,
    );

    scenario(
      'a held button opens no context menu; a released one does',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
        });
        const decrement = mounted.part('decrement');
        const menu = () => {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
          });
          decrement.dispatchEvent(event);
          return event.defaultPrevented;
        };
        await pointer.down(decrement);
        expect(menu()).toBe(true);
        await pointer.up();
        expect(menu()).toBe(false);
      },
      PHASE,
    );

    scenario(
      'a screen reader’s click steps once and focuses the button',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const increment = mounted.part('increment');
        increment.click();
        expect(inputOf(mounted).value).toBe('6');
        expect(document.activeElement).toBe(increment);
        // Past the 400 ms a held press waits: it never repeats.
        await wait(500);
        expect(changes(mounted)).toEqual([6]);
      },
      PHASE,
    );

    scenario(
      'touch: a tap steps once, on release, and focuses the button',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const increment = mounted.part('increment');
        await touch.down(increment);
        expect(inputOf(mounted).value).toBe('5');
        await touch.up();
        await expect.poll(() => inputOf(mounted).value).toBe('6');
        expect(document.activeElement).toBe(increment);
        expect(changes(mounted)).toEqual([6]);
      },
      TOUCH,
    );

    scenario(
      'touch: held, a button repeats after 600 ms and adds no step on release',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        await touch.down(mounted.part('increment'));
        await wait(450);
        expect(inputOf(mounted).value).toBe('5');
        await expect
          .poll(() => Number(inputOf(mounted).value))
          .toBeGreaterThanOrEqual(7);
        await touch.up();
        const settled = inputOf(mounted).value;
        await wait(200);
        expect(inputOf(mounted).value).toBe(settled);
      },
      TOUCH,
    );

    scenario(
      'touch: a finger that leaves for a scroll steps nothing',
      async ({ mount, touch }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        await touch.down(mounted.part('increment'));
        await touch.moveOutside(mounted.part('increment'));
        await touch.up();
        await wait(200);
        expect(inputOf(mounted).value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      TOUCH,
    );
  });

  group('wheel', () => {
    scenario(
      'steps while focus is in the field and the pointer over the input; up increments',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        await pointer.move(input);
        const unfocused = defaultPrevented('wheel');
        await pointer.wheel({ deltaY: -100 });
        expect(unfocused()).toEqual([false]);
        expect(input.value).toBe('5');

        input.focus();
        const focused = defaultPrevented('wheel');
        await pointer.wheel({ deltaY: -100 });
        await expect.poll(() => input.value).toBe('6');
        await pointer.wheel({ deltaY: 100 });
        await expect.poll(() => input.value).toBe('5');
        // The page doesn't scroll meanwhile.
        expect(focused()).toEqual([true, true]);
        expect(changes(mounted)).toEqual([6, 5]);
      },
      PHASE,
    );

    scenario(
      'isWheelDisabled and a mostly horizontal scroll leave the wheel alone',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        await pointer.move(input);
        input.focus();
        const seen = defaultPrevented('wheel');
        await pointer.wheel({ deltaX: 100, deltaY: 10 });
        await mounted.setProps({ isWheelDisabled: true });
        await pointer.wheel({ deltaY: -100 });
        await wait(100);
        expect(seen()).toEqual([false, false]);
        expect(input.value).toBe('5');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('states', () => {
    scenario(
      'read-only: no key, button or wheel changes it',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5, isReadOnly: true },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        expect(input.readOnly).toBe(true);
        expectOnEveryPart(mounted, 'data-readonly', true);
        for (const name of ['increment', 'decrement']) {
          expect(mounted.part(name).getAttribute('aria-disabled'), name).toBe(
            'true',
          );
        }
        input.focus();
        await keyboard.press('ArrowUp');
        await pointer.click(mounted.part('increment'));
        await pointer.move(input);
        await pointer.wheel({ deltaY: -100 });
        await wait(100);
        expect(input.value).toBe('5');
        expect(changes(mounted)).toEqual([]);
        expect(mounted.state()).toMatchObject({
          canIncrement: false,
          canDecrement: false,
        });
      },
      PHASE,
    );

    scenario(
      'disabled: the input, both buttons and the hidden input',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(quantity()),
          props: { defaultValue: 5, isDisabled: true },
          events: EVENTS,
        });
        expect(inputOf(mounted).disabled).toBe(true);
        expectOnEveryPart(mounted, 'data-disabled', true);
        for (const name of ['increment', 'decrement']) {
          expect(mounted.part(name).getAttribute('aria-disabled'), name).toBe(
            'true',
          );
        }
        expect(hiddenOf(mounted).disabled).toBe(true);
        // A disabled field is left out of the form, as a native one.
        expect(new FormData(formOf(mounted)).has('quantity')).toBe(false);
        await pointer.click(mounted.part('increment'));
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('controlled', () => {
    scenario(
      'a controlled value is shown as given, and follows props without reporting',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { value: 7, step: 5, maxValue: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        // Off the step and out of range, as given.
        expect(input.value).toBe('7');
        expect(input.hasAttribute('aria-invalid')).toBe(false);

        await mounted.setProps({ value: 1234, maxValue: undefined });
        expect(input.value).toBe('1,234');
        await mounted.setProps({ value: null });
        expect(input.value).toBe('');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a step reports, and the field shows the consumer’s value until it answers',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { value: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await keyboard.press('ArrowUp');
        expect(changes(mounted)).toEqual([6]);
        expect(input.value).toBe('5');

        await mounted.setProps({ value: 6 });
        expect(input.value).toBe('6');
      },
      PHASE,
    );

    scenario(
      'a value from outside replaces the typed text, even while focused',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { value: 5 },
          events: EVENTS,
        });
        const input = selectAll(mounted);
        await typeText(keyboard, '12');
        await mounted.setProps({ value: 3 });
        expect(input.value).toBe('3');
        expect(document.activeElement).toBe(input);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a value out of range stays until the user edits or steps it; the consumer marks it',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: quantity(),
          props: { value: 12, maxValue: 10 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        input.blur();
        expect(input.value).toBe('12');
        expect(changes(mounted)).toEqual([]);

        // The consumer's check, through Field: the error says why.
        await mounted.setProps({ isInvalid: true });
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(mounted.part('error').hidden).toBe(false);

        input.focus();
        await keyboard.press('ArrowDown');
        expect(changes(mounted)).toEqual([10]);
      },
      PHASE,
    );
  });

  group('forms', () => {
    scenario(
      'the form gets the number, and Enter commits before it submits',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: inForm(quantity({ lang: 'de-DE' })),
          props: { defaultValue: 1234.5 },
        });
        const form = formOf(mounted);
        expect(new FormData(form).get('quantity')).toBe('1234.5');

        const submitted: unknown[] = [];
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          submitted.push(new FormData(form).get('quantity'));
        });
        selectAll(mounted);
        await typeText(keyboard, '7,5');
        await keyboard.press('Enter');
        expect(submitted).toEqual(['7.5']);
      },
      PHASE,
    );

    scenario(
      'form reset returns an uncontrolled field to its default',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: inForm(quantity()),
          props: { defaultValue: 5 },
          events: EVENTS,
        });
        const input = inputOf(mounted);
        input.focus();
        await keyboard.press('ArrowUp');
        expect(input.value).toBe('6');

        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await pointer.click(reset);
        await expect.poll(() => input.value).toBe('5');
        expect(hiddenOf(mounted).value).toBe('5');
        expect(changes(mounted)).toEqual([6, 5]);
      },
      PHASE,
    );

    scenario(
      'form reset follows a default set after mount, with or without a change',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: inForm(quantity()),
          events: EVENTS,
        });
        const input = inputOf(mounted);
        const reset = mounted.container.querySelector<HTMLElement>(
          'button[type="reset"]',
        )!;
        await mounted.setProps({ defaultValue: 5 });
        expect(input.value).toBe('5');

        // Unchanged: the default stays, and nothing is reported.
        await pointer.click(reset);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(input.value).toBe('5');
        expect(hiddenOf(mounted).value).toBe('5');
        expect(mounted.state().value).toBe(5);
        expect(changes(mounted)).toEqual([]);

        // Changed, then a new default: the reset goes back to it.
        input.focus();
        await keyboard.press('ArrowUp');
        await mounted.setProps({ defaultValue: 8 });
        expect(input.value).toBe('6');
        await pointer.click(reset);
        await expect.poll(() => input.value).toBe('8');
        expect(hiddenOf(mounted).value).toBe('8');
        expect(mounted.state().value).toBe(8);
        expect(changes(mounted)).toEqual([6, 8]);
      },
      PHASE,
    );
  });

  group('announcements', () => {
    scenario(
      'a step announces the new text, with a minus sign read as minus',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 0 },
        });
        inputOf(mounted).focus();
        const heard = await listen();
        await keyboard.press('ArrowDown');
        await expect.poll(heard).toEqual(['assertive: −1']);
      },
      PHASE,
    );

    scenario(
      'a commit that changed the text is announced; typing is not',
      async ({ mount, keyboard, listen }) => {
        const mounted = await mount({
          template: quantity(),
          props: { maxValue: 10 },
        });
        const input = inputOf(mounted);
        input.focus();
        const heard = await listen();
        await typeText(keyboard, '7');
        await keyboard.press('Enter');
        input.select();
        await typeText(keyboard, '25');
        await keyboard.press('Enter');
        await expect.poll(heard).toEqual(['assertive: 10']);
      },
      PHASE,
    );
  });

  group('hover, focus and state', () => {
    scenario(
      'hover and focus on the input mark every field part',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: quantity() });
        const input = inputOf(mounted);
        await pointer.move(input);
        expectOnEveryPart(mounted, 'data-hovered', true);
        await pointer.click(input);
        expectOnEveryPart(mounted, 'data-focused', true);
        expectOnEveryPart(mounted, 'data-focus-visible', false);
        expect(mounted.part('increment').hasAttribute('data-focused')).toBe(
          false,
        );
        await pointer.move(mounted.part('increment'));
        expectOnEveryPart(mounted, 'data-hovered', false);
      },
      PHASE,
    );

    scenario(
      'a press on the wrapper outside any control focuses the input; on the rest of the root, not',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: quantity({
            inWrapper: [h('span', { id: 'unit' }, 'pcs')],
          }),
        });
        await pointer.click(mounted.container.querySelector('#unit')!);
        expect(document.activeElement).toBe(inputOf(mounted));

        // The root around the wrapper only holds the parts.
        inputOf(mounted).blur();
        await pointer.click(mounted.part('description'));
        expect(document.activeElement).not.toBe(inputOf(mounted));
      },
      PHASE,
    );

    scenario(
      'focusChange reports focus and blur',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: quantity(), events: EVENTS });
        await pointer.click(inputOf(mounted));
        inputOf(mounted).blur();
        expect(
          mounted.events
            .filter((event) => event.name === 'focusChange')
            .map((event) => event.detail),
        ).toEqual([true, false]);
      },
      PHASE,
    );

    scenario(
      'public state reports the value, what can step, interaction and the props',
      async ({ mount }) => {
        const mounted = await mount({
          template: quantity(),
          props: { defaultValue: 5, minValue: 5 },
        });
        expect(mounted.state()).toEqual({
          value: 5,
          canIncrement: true,
          canDecrement: false,
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
      'typing, stepping, hovering and focusing never re-render the owner',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({ template: quantity(), events: EVENTS });
        const input = inputOf(mounted);
        const renders = mounted.renderCount();
        await pointer.move(input);
        await pointer.click(input);
        await typeText(keyboard, '12');
        await keyboard.press('ArrowUp');
        await pointer.click(mounted.part('increment'));
        input.blur();
        expect(changes(mounted)).toEqual([13, 14]);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the role description and the label of an empty field',
      async ({ mount, spoken }) => {
        await mount({ template: bare() });
        expect(await spoken()).toContain('Number field, Quantity');
      },
      PHASE,
    );

    scenario(
      'reads the formatted value',
      async ({ mount, spoken }) => {
        await mount({ template: bare(), props: { defaultValue: 1024 } });
        expect(await spoken()).toContain('Number field, Quantity, 1,024');
      },
      PHASE,
    );

    scenario(
      'reads a currency as shown',
      async ({ mount, spoken }) => {
        await mount({
          template: bare({ label: 'Price' }),
          props: {
            defaultValue: 12.5,
            formatOptions: { style: 'currency', currency: 'EUR' },
          },
        });
        expect(await spoken()).toContain('Number field, Price, €12.50');
      },
      PHASE,
    );

    scenario(
      'reads read only after the value',
      async ({ mount, spoken }) => {
        await mount({
          template: bare(),
          props: { defaultValue: 5, isReadOnly: true },
        });
        expect(await spoken()).toContain(
          'Number field, Quantity, 5, read only',
        );
      },
      PHASE,
    );

    scenario(
      'reads disabled after the value',
      async ({ mount, spoken }) => {
        await mount({
          template: bare(),
          props: { defaultValue: 5, isDisabled: true },
        });
        expect(await spoken()).toContain('Number field, Quantity, 5, disabled');
      },
      PHASE,
    );

    scenario(
      'reads the error, invalid and required',
      async ({ mount, spoken }) => {
        await mount({
          template: bare({ error: 'At most 10' }),
          props: { defaultValue: 5, isInvalid: true, isRequired: true },
        });
        expect(await spoken()).toContain(
          'Number field, Quantity, 5, At most 10, invalid, required',
        );
      },
      PHASE,
    );

    scenario(
      'in another language, reads the screen reader’s own role word',
      async ({ mount, spoken }) => {
        await mount({
          template: bare({ label: 'Menge', lang: 'de-DE' }),
          props: { defaultValue: 5 },
        });
        expect(await spoken()).toContain('textbox, Menge, 5');
      },
      PHASE,
    );

    scenario(
      'reads the buttons with the label, and a button at a bound as disabled',
      async ({ mount, spoken }) => {
        await mount({
          template: bare({ withButtons: true }),
          props: { defaultValue: 10, maxValue: 10 },
        });
        const phrases = await spoken();
        // `aria-controls` is read as a count of controlled elements.
        expect(phrases).toContain('button, Decrease Quantity, 1 control');
        expect(phrases).toContain(
          'button, Increase Quantity, 1 control, disabled',
        );
      },
      PHASE,
    );
  });

  group('real screen readers', () => {
    scenario(
      'Tab reads the field by its label and role, and ArrowUp reads the new value',
      async ({ mount, screenReader }) => {
        const heard = {
          voiceover: {
            field: /Quantity How many to order number field/,
            value: /^0$/,
          },
          nvda: {
            field: /Quantity, Number field, How many to order, blank/,
            value: /^0$/,
          },
        }[screenReader.name];
        const mounted = await mount({
          template: [
            h('input', { id: 'before', 'aria-label': 'Before' }),
            quantity(),
          ],
        });
        await screenReader.startFrom(
          mounted.container.querySelector<HTMLElement>('#before')!,
        );
        await screenReader.press('Tab');
        expect.soft(await screenReader.spoken()).toMatch(heard.field);
        await screenReader.press('ArrowUp');
        expect.soft(await screenReader.spoken()).toMatch(heard.value);
      },
      { ...PHASE, needs: ['screenReader'] },
    );
  });
});
