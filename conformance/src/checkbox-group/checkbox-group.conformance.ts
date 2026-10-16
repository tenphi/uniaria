/**
 * CheckboxGroup conformance, from the spec approved by @tenphi on 2026-10-15
 * (`packages/core/src/components/checkbox-group/spec.md`): Field composed on
 * a `role="group"` root, the `string[]` value its checkboxes read and change
 * through their owner link, the group's modes, required and invalid states
 * on every checkbox, form reset, focus within, public state, render counts
 * and spoken output, and the `name` and focus-visible the gate 3 API review
 * added (@tenphi, 2026-10-16). The checkboxes are nested Checkbox
 * components; their own behavior is Checkbox's suite. Everything here is
 * phase 3.
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type {
  Mounted,
  TemplateComponent,
  TemplateElement,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { CheckboxGroupProps, CheckboxGroupState } from './types';

type MountedGroup = Mounted<CheckboxGroupProps, CheckboxGroupState>;

const PHASE = { phase: 3 } as const;

const PARTS = ['root', 'label', 'description', 'error'];

const STATE_ATTRIBUTES = [
  'data-disabled',
  'data-readonly',
  'data-invalid',
  'data-required',
  'data-focus-within',
  'data-focus-visible',
];

const EVENTS = ['valueChange', 'focusChange'];

/** A checkbox in the group: a `label` root around its input and label. */
function option(
  value: string,
  label: string,
  props: Readonly<Record<string, unknown>> = {},
  input: Readonly<Record<string, string>> = {},
): TemplateComponent {
  return nested(
    'checkbox',
    { value, labelElementType: 'span', ...props },
    h(
      'label',
      { part: 'root' },
      h('input', { part: 'input', type: 'checkbox', name: 'notify', ...input }),
      h('span', { part: 'label' }, label),
    ),
  );
}

interface NotifyOptions {
  readonly options?: readonly TemplateComponent[];
  readonly hasDescription?: boolean;
}

/**
 * A group "Notifications" with Email and SMS, and the description and error
 * after it, as Cube UI Kit's field wrapper places them.
 */
function notify({
  options = [option('email', 'Email'), option('sms', 'SMS')],
  hasDescription = true,
}: NotifyOptions = {}): TemplateElement[] {
  return [
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Notifications'),
      ...options,
    ),
    ...(hasDescription
      ? [h('p', { part: 'description' }, 'Pick at least one')]
      : []),
    h('p', { part: 'error' }, 'Select one'),
  ];
}

/** A nested checkbox part, in document order. */
function boxParts(mounted: MountedGroup, part: string): HTMLElement[] {
  return Array.from(
    mounted.container.querySelectorAll<HTMLElement>(
      `[data-scope="checkbox"][data-part="${part}"]`,
    ),
  );
}

/** The checkboxes' inputs, in document order. */
function inputs(mounted: MountedGroup): HTMLInputElement[] {
  return boxParts(mounted, 'input') as HTMLInputElement[];
}

/** Each checkbox's `checked`, in document order. */
function checked(mounted: MountedGroup): boolean[] {
  return inputs(mounted).map((input) => input.checked);
}

/** The `valueChange` details so far, in order. */
function changes(mounted: MountedGroup): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'valueChange')
    .map((event) => event.detail);
}

/** The `focusChange` details so far, in order. */
function focusChanges(mounted: MountedGroup): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'focusChange')
    .map((event) => event.detail);
}

/** A state attribute is on every part of the group, or on none. */
function expectOnEveryPart(
  mounted: MountedGroup,
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

/** A form with the group and a reset button. */
function inForm(nodes: TemplateElement[]): TemplateElement {
  return h('form', null, ...nodes, h('button', { type: 'reset' }, 'Reset'));
}

async function reset(
  mounted: MountedGroup,
  pointer: { click(target: Element): Promise<void> },
): Promise<void> {
  await pointer.click(
    mounted.container.querySelector<HTMLElement>('button[type="reset"]')!,
  );
}

export const checkboxGroupConformance = defineConformance<
  CheckboxGroupProps,
  CheckboxGroupState
>('checkbox-group', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'composes Field on a group, with nothing set while idle',
      async ({ mount }) => {
        const mounted = await mount({ template: notify() });
        const root = mounted.part('root');
        const label = mounted.part('label');
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
        expect(root.getAttribute('aria-describedby')).toBe(
          mounted.part('description').id,
        );
        // A group can't be labelled natively.
        expect(label.hasAttribute('for')).toBe(false);
        expect(mounted.part('error').hidden).toBe(true);
        for (const name of ['aria-disabled', 'aria-invalid', 'aria-required']) {
          expect(root.hasAttribute(name), name).toBe(false);
        }
        for (const attribute of STATE_ATTRIBUTES) {
          expectOnEveryPart(mounted, attribute, false);
        }
        expect(checked(mounted)).toEqual([false, false]);
        expect(inputs(mounted).map((input) => input.value)).toEqual([
          'email',
          'sms',
        ]);
      },
      PHASE,
    );

    scenario(
      "the name prop is every checkbox's name; without it, each keeps its own",
      async ({ mount }) => {
        const named = await mount({
          template: notify(),
          props: { name: 'channels' },
        });
        expect(inputs(named).map((input) => input.name)).toEqual([
          'channels',
          'channels',
        ]);

        const unnamed = await mount({ template: notify() });
        expect(inputs(unnamed).map((input) => input.name)).toEqual([
          'notify',
          'notify',
        ]);
      },
      PHASE,
    );

    scenario(
      'a fieldset root with a legend label works the same way',
      async ({ mount }) => {
        const mounted = await mount({
          template: h(
            'fieldset',
            { part: 'root' },
            h('legend', { part: 'label' }, 'Notifications'),
            option('email', 'Email'),
          ),
          props: { labelElementType: 'legend' },
        });
        const root = mounted.part('root');
        expect(root.getAttribute('role')).toBe('group');
        expect(root.getAttribute('aria-labelledby')).toBe(
          mounted.part('label').id,
        );
        expect(mounted.part('label').hasAttribute('for')).toBe(false);
      },
      PHASE,
    );
  });

  group('value', () => {
    scenario(
      'a click on a checkbox adds its value last, and another removes it',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: notify(), events: EVENTS });
        const [email, sms] = inputs(mounted);

        await pointer.click(sms!);
        await pointer.click(email!);
        expect(mounted.state().value).toEqual(['sms', 'email']);
        expect(checked(mounted)).toEqual([true, true]);

        await pointer.click(sms!);
        expect(mounted.state().value).toEqual(['email']);
        expect(checked(mounted)).toEqual([true, false]);
        expect(changes(mounted)).toEqual([
          ['sms'],
          ['sms', 'email'],
          ['email'],
        ]);
      },
      PHASE,
    );

    scenario(
      'defaultValue checks its checkboxes without reporting a change',
      async ({ mount }) => {
        const mounted = await mount({
          template: notify(),
          props: { defaultValue: ['sms'] },
          events: EVENTS,
        });
        expect(checked(mounted)).toEqual([false, true]);
        expect(mounted.state().value).toEqual(['sms']);
        expect(
          boxParts(mounted, 'root')[1]!.hasAttribute('data-selected'),
        ).toBe(true);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a controlled value follows props without reporting a change',
      async ({ mount }) => {
        const mounted = await mount({
          template: notify(),
          props: { value: ['email'] },
          events: EVENTS,
        });
        expect(checked(mounted)).toEqual([true, false]);

        await mounted.setProps({ value: ['sms', 'email'] });
        expect(checked(mounted)).toEqual([true, true]);
        expect(mounted.state().value).toEqual(['sms', 'email']);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'controlled: a click reports the request, and the checkbox shows the value until the consumer accepts',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: notify(),
          props: { value: [] },
          events: EVENTS,
        });
        const [email] = inputs(mounted);

        await pointer.click(email!);
        expect(changes(mounted)).toEqual([['email']]);
        expect(email!.checked).toBe(false);
        expect(mounted.state().value).toEqual([]);

        await mounted.setProps({ value: ['email'] });
        expect(email!.checked).toBe(true);
      },
      PHASE,
    );

    scenario(
      'a value with no checkbox stays in the value',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: notify(),
          props: { defaultValue: ['fax'] },
          events: EVENTS,
        });
        expect(checked(mounted)).toEqual([false, false]);
        await pointer.click(inputs(mounted)[0]!);
        expect(changes(mounted)).toEqual([['fax', 'email']]);
      },
      PHASE,
    );
  });

  group('checkboxes in the group', () => {
    scenario(
      'isDisabled disables every checkbox natively and marks the group',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: notify(),
          props: { isDisabled: true, isInvalid: true },
          events: EVENTS,
        });
        expect(mounted.part('root').getAttribute('aria-disabled')).toBe('true');
        expectOnEveryPart(mounted, 'data-disabled', true);
        expect(mounted.part('error').hidden).toBe(true);
        expect(inputs(mounted).map((input) => input.disabled)).toEqual([
          true,
          true,
        ]);

        await pointer.click(boxParts(mounted, 'label')[0]!);
        expect(checked(mounted)).toEqual([false, false]);
        expect(changes(mounted)).toEqual([]);

        await mounted.setProps({ isDisabled: false });
        expect(mounted.part('root').hasAttribute('aria-disabled')).toBe(false);
        expect(inputs(mounted).map((input) => input.disabled)).toEqual([
          false,
          false,
        ]);
      },
      PHASE,
    );

    scenario(
      "a checkbox's own isDisabled still applies in the group",
      async ({ mount }) => {
        const mounted = await mount({
          template: notify({
            options: [
              option('email', 'Email', { isDisabled: true }),
              option('sms', 'SMS'),
            ],
          }),
        });
        expect(inputs(mounted).map((input) => input.disabled)).toEqual([
          true,
          false,
        ]);
      },
      PHASE,
    );

    scenario(
      'isReadOnly makes every checkbox read-only',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: notify(),
          props: { isReadOnly: true, defaultValue: ['sms'] },
          events: EVENTS,
        });
        expectOnEveryPart(mounted, 'data-readonly', true);
        expect(
          inputs(mounted).map((input) => input.getAttribute('aria-readonly')),
        ).toEqual(['true', 'true']);

        for (const input of inputs(mounted)) await pointer.click(input);
        expect(checked(mounted)).toEqual([false, true]);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'isRequired marks every checkbox required while nothing is selected',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: notify(),
          props: { isRequired: true },
        });
        const required = () =>
          inputs(mounted).map((input) => input.getAttribute('aria-required'));
        expect(required()).toEqual(['true', 'true']);
        expect(mounted.part('root').hasAttribute('aria-required')).toBe(false);
        expectOnEveryPart(mounted, 'data-required', true);

        await pointer.click(inputs(mounted)[1]!);
        expect(required()).toEqual([null, null]);

        await pointer.click(inputs(mounted)[1]!);
        expect(required()).toEqual(['true', 'true']);
      },
      PHASE,
    );

    scenario(
      "isInvalid marks every checkbox and links the group's error to each",
      async ({ mount }) => {
        const mounted = await mount({
          template: notify(),
          props: { isInvalid: true },
        });
        const error = mounted.part('error');
        const description = mounted.part('description');
        expect(error.hidden).toBe(false);
        expectOnEveryPart(mounted, 'data-invalid', true);
        expect(mounted.part('root').hasAttribute('aria-invalid')).toBe(false);
        for (const input of inputs(mounted)) {
          expect(input.getAttribute('aria-invalid')).toBe('true');
          const ids = input.getAttribute('aria-describedby')?.split(' ');
          expect(ids).toContain(error.id);
          // The description is the group's: read on entering it.
          expect(ids).not.toContain(description.id);
        }

        await mounted.setProps({ isInvalid: false });
        for (const input of inputs(mounted)) {
          expect(input.hasAttribute('aria-invalid')).toBe(false);
          expect(input.hasAttribute('aria-describedby')).toBe(false);
        }
      },
      PHASE,
    );

    scenario(
      'announces a new group error once',
      async ({ mount, listen }) => {
        const mounted = await mount({ template: notify() });
        const heard = await listen();
        await mounted.setProps({ isInvalid: true });
        expect(await heard()).toEqual(['assertive: Select one']);
      },
      PHASE,
    );
  });

  group('form reset', () => {
    scenario(
      'returns an uncontrolled group to its default',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(notify()),
          props: { defaultValue: ['sms'] },
          events: EVENTS,
        });
        const [email, sms] = inputs(mounted);
        await pointer.click(email!);
        await pointer.click(sms!);
        expect(checked(mounted)).toEqual([true, false]);

        await reset(mounted, pointer);
        await expect.poll(() => checked(mounted)).toEqual([false, true]);
        expect(mounted.state().value).toEqual(['sms']);
        expect(changes(mounted).at(-1)).toEqual(['sms']);
      },
      PHASE,
    );

    scenario(
      'asks a controlled group for the value it mounted with',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(notify()),
          props: { value: ['sms'] },
          events: EVENTS,
        });
        await mounted.setProps({ value: ['email'] });
        mounted.clearEvents();

        await reset(mounted, pointer);
        expect(changes(mounted)).toEqual([['sms']]);
        // Still the controlled value until the consumer accepts.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(checked(mounted)).toEqual([true, false]);

        await mounted.setProps({ value: ['sms'] });
        expect(checked(mounted)).toEqual([false, true]);
      },
      PHASE,
    );

    scenario(
      'a reset the page cancels changes nothing',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(notify()),
          events: EVENTS,
        });
        mounted.container.addEventListener(
          'reset',
          (event) => event.preventDefault(),
          { capture: true },
        );
        await pointer.click(inputs(mounted)[0]!);
        mounted.clearEvents();

        await reset(mounted, pointer);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(checked(mounted)).toEqual([true, false]);
        expect(mounted.state().value).toEqual(['email']);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('focus', () => {
    scenario(
      'focus within marks every part, visible after keyboard, and focusChange reports entering and leaving',
      async ({ mount, keyboard, pointer }) => {
        // tabindex: WebKit tabs to a checkbox only with one, as macOS.
        const tabbable = { tabindex: '0' };
        const mounted = await mount({
          template: [
            h('button', { type: 'button' }, 'Before'),
            ...notify({
              options: [
                option('email', 'Email', {}, tabbable),
                option('sms', 'SMS', {}, tabbable),
              ],
            }),
          ],
          events: EVENTS,
        });
        mounted.container.querySelector('button')!.focus();

        await keyboard.tab();
        expect(document.activeElement).toBe(inputs(mounted)[0]);
        expectOnEveryPart(mounted, 'data-focus-within', true);
        expectOnEveryPart(mounted, 'data-focus-visible', true);
        expect(mounted.state()).toMatchObject({
          isFocusWithin: true,
          isFocusVisible: true,
        });

        await keyboard.tab();
        expect(document.activeElement).toBe(inputs(mounted)[1]);
        expect(focusChanges(mounted)).toEqual([true]);

        inputs(mounted)[1]!.blur();
        expectOnEveryPart(mounted, 'data-focus-within', false);
        expectOnEveryPart(mounted, 'data-focus-visible', false);
        expect(focusChanges(mounted)).toEqual([true, false]);

        // After a pointer press, focus within isn't visible.
        await pointer.click(inputs(mounted)[0]!);
        inputs(mounted)[0]!.focus();
        expectOnEveryPart(mounted, 'data-focus-within', true);
        expectOnEveryPart(mounted, 'data-focus-visible', false);
        expect(mounted.state().isFocusVisible).toBe(false);
      },
      PHASE,
    );
  });

  group('state and renders', () => {
    scenario(
      'public state reports the value and the props',
      async ({ mount }) => {
        const mounted = await mount({
          template: notify(),
          props: { defaultValue: ['sms'] },
        });
        expect(mounted.state()).toEqual({
          value: ['sms'],
          isDisabled: false,
          isReadOnly: false,
          isRequired: false,
          isInvalid: false,
          isErrorShown: false,
          isFocusWithin: false,
          isFocusVisible: false,
        });
      },
      PHASE,
    );

    scenario(
      'toggling checkboxes and moving focus never re-render the owner',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: notify(), events: EVENTS });
        const renders = mounted.renderCount();
        const [email, sms] = inputs(mounted);

        await pointer.click(email!);
        await pointer.click(sms!);
        email!.focus();
        email!.blur();

        expect(changes(mounted)).toEqual([['email'], ['email', 'sms']]);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the group with its name and description',
      async ({ mount, spoken }) => {
        await mount({ template: notify() });
        const phrases = await spoken();
        expect(phrases).toContain('group, Notifications, Pick at least one');
        expect(phrases).toContain('checkbox, Email, not checked');
        expect(phrases).toContain(
          'end of group, Notifications, Pick at least one',
        );
      },
      PHASE,
    );

    scenario(
      'reads a disabled group',
      async ({ mount, spoken }) => {
        await mount({
          template: notify({ hasDescription: false }),
          props: { isDisabled: true },
        });
        expect(await spoken()).toContain('group, Notifications, disabled');
      },
      PHASE,
    );

    scenario(
      'reads required on each checkbox of an empty required group',
      async ({ mount, spoken }) => {
        await mount({
          template: notify({ hasDescription: false }),
          props: { isRequired: true },
        });
        expect(await spoken()).toContain(
          'checkbox, Email, not checked, required',
        );
      },
      PHASE,
    );

    scenario(
      "reads the group's error on an invalid checkbox",
      async ({ mount, spoken }) => {
        await mount({
          template: notify({ hasDescription: false }),
          props: { isInvalid: true },
        });
        expect(await spoken()).toContain(
          'checkbox, Email, Select one, not checked, invalid',
        );
      },
      PHASE,
    );
  });
});
