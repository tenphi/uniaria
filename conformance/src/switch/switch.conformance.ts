/**
 * Switch conformance, from the spec approved by @tenphi on 2026-10-16
 * (`packages/core/src/components/switch/spec.md`): Checkbox's core on a
 * native checkbox with `role="switch"`, without the indeterminate state:
 * the selected state (uncontrolled, controlled, form reset), disabled and
 * read-only, hover and focus on every part, public state, render counts and
 * spoken output. Field's own linking is Field's suite. Everything here is
 * phase 3.
 *
 * The virtual screen reader reads the checked state only from the `checked`
 * attribute (Checkbox's spec, Resolved questions 1), so the state is checked
 * through the `checked` property, and spoken output covers the on state only
 * where the markup carries the attribute.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateElement } from '@uniaria/testing';
import { expect } from 'vitest';

import type { SwitchProps, SwitchState } from './types';

type MountedSwitch = Mounted<SwitchProps, SwitchState>;

const PHASE = { phase: 3 } as const;

/** isFocusableWhenDisabled came with Tooltip (Tooltip spec, Resolved questions 12). */
const FOCUSABLE_PHASE = { phase: 4 } as const;

const PARTS = ['root', 'input', 'indicator', 'label', 'description', 'error'];

const STATE_ATTRIBUTES = [
  'data-selected',
  'data-hovered',
  'data-focused',
  'data-focus-visible',
  'data-disabled',
  'data-readonly',
  'data-invalid',
  'data-required',
];

const EVENTS = ['selectedChange', 'focusChange'];

/** The label part is a `span` inside a `label` root. */
const IN_LABEL = { labelElementType: 'span' } as const;

interface WifiOptions {
  readonly input?: TemplateElement;
  readonly hasDescription?: boolean;
}

/**
 * A `label` root around the input, an indicator (the track) and a `span`
 * label, with the description and error outside it: the spec's first layout.
 */
function wifi({
  input = h('input', { part: 'input', type: 'checkbox', name: 'wifi' }),
  hasDescription = true,
}: WifiOptions = {}): TemplateElement[] {
  return [
    h(
      'label',
      { part: 'root' },
      input,
      h('span', { part: 'indicator' }, '•'),
      h('span', { part: 'label' }, 'Wi-Fi'),
    ),
    ...(hasDescription
      ? [h('p', { part: 'description' }, 'Uses more battery')]
      : []),
    h('p', { part: 'error' }, 'Turn on to sync'),
  ];
}

/** A `div` root with the input and a `label` label part: the second layout. */
function plain(
  input = h('input', { part: 'input', type: 'checkbox' }),
): TemplateElement {
  return h(
    'div',
    { part: 'root' },
    input,
    h('label', { part: 'label' }, 'Wi-Fi'),
  );
}

/** The input element, typed. */
function inputOf(mounted: MountedSwitch): HTMLInputElement {
  return mounted.part('input') as HTMLInputElement;
}

/** The `selectedChange` details so far, in order. */
function changes(mounted: MountedSwitch): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'selectedChange')
    .map((event) => event.detail);
}

/** The `focusChange` details so far, in order. */
function focusChanges(mounted: MountedSwitch): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'focusChange')
    .map((event) => event.detail);
}

/** A state attribute is on every part, or on none. */
function expectOnEveryPart(
  mounted: MountedSwitch,
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

/** Counts the native `input` and `change` events that reach the container. */
function countNativeEvents(mounted: MountedSwitch): { count: number } {
  const counter = { count: 0 };
  for (const type of ['input', 'change']) {
    mounted.container.addEventListener(type, () => counter.count++);
  }
  return counter;
}

/** A form with the switch and a reset button. */
function inForm(nodes: TemplateElement[]): TemplateElement {
  return h('form', null, ...nodes, h('button', { type: 'reset' }, 'Reset'));
}

/** Clicks the form's reset button. */
async function reset(
  mounted: MountedSwitch,
  pointer: { click(target: Element): Promise<void> },
): Promise<void> {
  await pointer.click(
    mounted.container.querySelector<HTMLElement>('button[type="reset"]')!,
  );
}

export const switchConformance = defineConformance<SwitchProps, SwitchState>(
  'switch',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'composes Field on a native checkbox with the switch role, with nothing set while idle',
        async ({ mount }) => {
          const mounted = await mount({ template: wifi(), props: IN_LABEL });
          const input = inputOf(mounted);
          const label = mounted.part('label');
          expect(input.type).toBe('checkbox');
          expect(input.getAttribute('role')).toBe('switch');
          expect(input.getAttribute('aria-labelledby')).toBe(label.id);
          // A span inside the label root: no `for`.
          expect(label.hasAttribute('for')).toBe(false);
          expect(input.getAttribute('aria-describedby')).toBe(
            mounted.part('description').id,
          );
          expect(mounted.part('error').hidden).toBe(true);
          expect(mounted.part('indicator').getAttribute('aria-hidden')).toBe(
            'true',
          );
          for (const name of [
            'checked',
            'disabled',
            'readonly',
            'required',
            'aria-checked',
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
          expect(input.checked).toBe(false);
          expect(input.indeterminate).toBe(false);
        },
        PHASE,
      );

      scenario(
        'writes the type and the role, and a label part that is a label points at the input and toggles it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: plain(h('input', { part: 'input' })),
            events: EVENTS,
          });
          const input = inputOf(mounted);
          const label = mounted.part('label');
          expect(input.getAttribute('type')).toBe('checkbox');
          expect(input.getAttribute('role')).toBe('switch');
          expect(label.getAttribute('for')).toBe(input.id);

          await pointer.click(label);
          expect(input.checked).toBe(true);
          expect(changes(mounted)).toEqual([true]);
        },
        PHASE,
      );

      scenario(
        'inputId is the id the label points at',
        async ({ mount }) => {
          const mounted = await mount({
            template: plain(
              h('input', { part: 'input', type: 'checkbox', id: 'wifi' }),
            ),
            props: { inputId: 'wifi' },
          });
          expect(inputOf(mounted).id).toBe('wifi');
          expect(mounted.part('label').getAttribute('for')).toBe('wifi');
        },
        PHASE,
      );
      scenario(
        "labelledBy and describedBy join Field's ids, after its own",
        async ({ mount }) => {
          const mounted = await mount({
            template: [
              h('span', { id: 'network' }, 'Network'),
              h('span', { id: 'hint' }, 'Uses more battery when on'),
              ...wifi(),
            ],
            props: { ...IN_LABEL, labelledBy: 'network', describedBy: 'hint' },
          });
          const input = inputOf(mounted);
          expect(input.getAttribute('aria-labelledby')).toBe(
            `${mounted.part('label').id} network`,
          );
          expect(input.getAttribute('aria-describedby')).toBe(
            `${mounted.part('description').id} hint`,
          );
        },
        PHASE,
      );
    });

    group('selection', () => {
      scenario(
        'a click toggles and reports each change, without aria-checked',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: wifi(),
            props: IN_LABEL,
            events: EVENTS,
          });
          const input = inputOf(mounted);

          await pointer.click(input);
          expect(input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expectOnEveryPart(mounted, 'data-selected', true);
          expect(input.hasAttribute('aria-checked')).toBe(false);
          // Binary: no indeterminate state.
          expect(input.indeterminate).toBe(false);
          expectOnEveryPart(mounted, 'data-indeterminate', false);

          await pointer.click(input);
          expect(input.checked).toBe(false);
          expect(mounted.state().isSelected).toBe(false);
          expectOnEveryPart(mounted, 'data-selected', false);
          expect(changes(mounted)).toEqual([true, false]);
        },
        PHASE,
      );

      scenario(
        'a click on the label part or the indicator inside a label root toggles',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: wifi(),
            props: IN_LABEL,
            events: EVENTS,
          });
          const input = inputOf(mounted);

          await pointer.click(mounted.part('label'));
          expect(input.checked).toBe(true);
          await pointer.click(mounted.part('indicator'));
          expect(input.checked).toBe(false);
          expect(changes(mounted)).toEqual([true, false]);
        },
        PHASE,
      );

      scenario(
        'Space toggles; Enter neither toggles nor is prevented',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: wifi(),
            props: IN_LABEL,
            events: EVENTS,
          });
          const input = inputOf(mounted);
          const prevented: boolean[] = [];
          mounted.container.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') prevented.push(event.defaultPrevented);
          });
          input.focus();

          await keyboard.press('Space');
          expect(input.checked).toBe(true);
          expect(changes(mounted)).toEqual([true]);

          await keyboard.press('Enter');
          expect(input.checked).toBe(true);
          expect(changes(mounted)).toEqual([true]);
          expect(prevented).toEqual([false]);
        },
        PHASE,
      );

      scenario(
        'defaultSelected checks the input without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, defaultSelected: true },
            events: EVENTS,
          });
          expect(inputOf(mounted).checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expectOnEveryPart(mounted, 'data-selected', true);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a controlled state follows props without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, isSelected: true },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          expect(input.checked).toBe(true);

          await mounted.setProps({ isSelected: false });
          expect(input.checked).toBe(false);
          expect(mounted.state().isSelected).toBe(false);
          expectOnEveryPart(mounted, 'data-selected', false);
          expect(changes(mounted)).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'controlled: a click reports the request, and the switch shows isSelected until the consumer accepts',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, isSelected: false },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          // Listeners of the native event see the toggle the browser made.
          const seen: boolean[] = [];
          mounted.container.addEventListener('change', () =>
            seen.push(input.checked),
          );

          await pointer.click(input);
          expect(changes(mounted)).toEqual([true]);
          expect(seen).toEqual([true]);
          expect(input.checked).toBe(false);
          expect(mounted.state().isSelected).toBe(false);
          expectOnEveryPart(mounted, 'data-selected', false);

          await mounted.setProps({ isSelected: true });
          expect(input.checked).toBe(true);
          expectOnEveryPart(mounted, 'data-selected', true);
        },
        PHASE,
      );

      scenario(
        'controlled: a consumer that accepts from the native change event keeps the toggle',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, isSelected: false },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          mounted.container.addEventListener('change', () => {
            void mounted.setProps({ isSelected: input.checked });
          });

          await pointer.click(input);
          expect(input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expectOnEveryPart(mounted, 'data-selected', true);
        },
        PHASE,
      );
    });

    group('form reset', () => {
      scenario(
        'returns an uncontrolled switch to its default',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: inForm(wifi()),
            props: { ...IN_LABEL, defaultSelected: true },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          await pointer.click(input);
          expect(input.checked).toBe(false);

          await reset(mounted, pointer);
          await expect.poll(() => input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expect(changes(mounted)).toEqual([false, true]);
        },
        PHASE,
      );

      scenario(
        'asks a controlled switch for the state it mounted with',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: inForm(wifi()),
            props: { ...IN_LABEL, isSelected: true },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          await mounted.setProps({ isSelected: false });
          mounted.clearEvents();

          await reset(mounted, pointer);
          expect(changes(mounted)).toEqual([true]);
          // Still the controlled state until the consumer accepts.
          await new Promise((resolve) => setTimeout(resolve, 50));
          expect(input.checked).toBe(false);

          await mounted.setProps({ isSelected: true });
          expect(input.checked).toBe(true);
        },
        PHASE,
      );

      scenario(
        'a reset the page cancels changes nothing',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: inForm(wifi()),
            props: IN_LABEL,
            events: EVENTS,
          });
          mounted.container.addEventListener(
            'reset',
            (event) => event.preventDefault(),
            { capture: true },
          );
          const input = inputOf(mounted);
          await pointer.click(input);
          mounted.clearEvents();

          await reset(mounted, pointer);
          await new Promise((resolve) => setTimeout(resolve, 50));
          expect(input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
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
            template: wifi(),
            props: { ...IN_LABEL, isDisabled: true, isInvalid: true },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          expect(input.disabled).toBe(true);
          expectOnEveryPart(mounted, 'data-disabled', true);
          // Field: the error hides while disabled; invalid stays.
          expect(mounted.part('error').hidden).toBe(true);
          expect(input.getAttribute('aria-invalid')).toBe('true');

          await pointer.click(mounted.part('label'));
          expect(input.checked).toBe(false);
          expect(document.activeElement).not.toBe(input);
          expect(changes(mounted)).toEqual([]);

          await mounted.setProps({ isDisabled: false });
          expect(input.disabled).toBe(false);
          expectOnEveryPart(mounted, 'data-disabled', false);
        },
        PHASE,
      );

      scenario(
        'isReadOnly keeps the switch focusable and cancels every toggle',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, isReadOnly: true, defaultSelected: true },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          const native = countNativeEvents(mounted);
          expect(input.getAttribute('aria-readonly')).toBe('true');
          // Not the `readonly` attribute, which drops it from validation.
          expect(input.hasAttribute('readonly')).toBe(false);
          expectOnEveryPart(mounted, 'data-readonly', true);

          await pointer.click(input);
          await pointer.click(mounted.part('label'));
          input.focus();
          expect(document.activeElement).toBe(input);
          await keyboard.press('Space');

          expect(input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expect(changes(mounted)).toEqual([]);
          expect(native.count).toBe(0);

          await mounted.setProps({ isReadOnly: false });
          expect(input.hasAttribute('aria-readonly')).toBe(false);
          expectOnEveryPart(mounted, 'data-readonly', false);
          await keyboard.press('Space');
          expect(input.checked).toBe(false);
        },
        PHASE,
      );

      scenario(
        'isFocusableWhenDisabled keeps a disabled switch focusable, with aria-disabled, and cancels every toggle',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: [
              h('button', { type: 'button' }, 'Before'),
              // tabindex: WebKit tabs to a checkbox only with one, as macOS.
              ...wifi({
                input: h('input', {
                  part: 'input',
                  type: 'checkbox',
                  tabindex: '0',
                }),
              }),
            ],
            props: {
              ...IN_LABEL,
              isDisabled: true,
              isFocusableWhenDisabled: true,
              defaultSelected: true,
            },
            events: EVENTS,
          });
          const input = inputOf(mounted);
          const native = countNativeEvents(mounted);
          expect(input.disabled).toBe(false);
          expect(input.getAttribute('aria-disabled')).toBe('true');
          expectOnEveryPart(mounted, 'data-disabled', true);
          expect(mounted.state().isDisabled).toBe(true);

          mounted.container.querySelector('button')!.focus();
          await keyboard.tab();
          expect(document.activeElement).toBe(input);
          await keyboard.press('Space');
          await pointer.click(input);
          await pointer.click(mounted.part('label'));
          expect(input.checked).toBe(true);
          expect(mounted.state().isSelected).toBe(true);
          expect(changes(mounted)).toEqual([]);
          expect(native.count).toBe(0);

          await mounted.setProps({
            ...IN_LABEL,
            isDisabled: true,
            isFocusableWhenDisabled: false,
            defaultSelected: true,
          });
          expect(input.disabled).toBe(true);
          expect(input.hasAttribute('aria-disabled')).toBe(false);
        },
        FOCUSABLE_PHASE,
      );

      scenario(
        'a focusable disabled switch is left out of its form’s data, as a disabled one is',
        async ({ mount }) => {
          const mounted = await mount({
            template: inForm([
              ...wifi({
                input: h('input', {
                  part: 'input',
                  type: 'checkbox',
                  name: 'wifi',
                  value: 'yes',
                }),
              }),
              h('input', { type: 'hidden', name: 'wifi', value: 'also' }),
            ]),
            props: {
              ...IN_LABEL,
              isDisabled: true,
              isFocusableWhenDisabled: true,
              defaultSelected: true,
            },
          });
          const form = mounted.container.querySelector('form')!;
          expect(new FormData(form).getAll('wifi')).toEqual(['also']);

          await mounted.setProps({
            ...IN_LABEL,
            isDisabled: false,
            isFocusableWhenDisabled: true,
            defaultSelected: true,
          });
          expect(new FormData(form).getAll('wifi')).toEqual(['yes', 'also']);
        },
        FOCUSABLE_PHASE,
      );

      scenario(
        "isRequired and isInvalid are Field's",
        async ({ mount }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, isRequired: true, isInvalid: true },
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
        'hovering the root or the input marks every part, never while disabled',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: wifi(), props: IN_LABEL });
          const root = mounted.part('root');

          await pointer.move(mounted.part('label'));
          expect(mounted.state().isHovered).toBe(true);
          expectOnEveryPart(mounted, 'data-hovered', true);

          await pointer.moveOutside(root);
          expect(mounted.state().isHovered).toBe(false);
          expectOnEveryPart(mounted, 'data-hovered', false);

          await pointer.move(inputOf(mounted));
          expect(mounted.state().isHovered).toBe(true);
          await pointer.moveOutside(root);

          await mounted.setProps({ isDisabled: true });
          await pointer.move(mounted.part('label'));
          expect(mounted.state().isHovered).toBe(false);
          expectOnEveryPart(mounted, 'data-hovered', false);
        },
        PHASE,
      );

      scenario(
        'hovering a root-less switch counts the input',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: [
              h('input', { part: 'input', type: 'checkbox', id: 'wifi' }),
              h('label', { part: 'label', for: 'wifi' }, 'Wi-Fi'),
            ],
            props: { inputId: 'wifi' },
          });
          const input = inputOf(mounted);
          await pointer.move(input);
          expect(mounted.state().isHovered).toBe(true);
          expect(input.hasAttribute('data-hovered')).toBe(true);
          await pointer.moveOutside(input);
          expect(mounted.state().isHovered).toBe(false);
        },
        PHASE,
      );

      scenario(
        'focus marks every part, and only keyboard focus is visible',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: [
              h('button', { type: 'button' }, 'Before'),
              // tabindex: WebKit tabs to a switch only with one, as macOS.
              ...wifi({
                input: h('input', {
                  part: 'input',
                  type: 'checkbox',
                  tabindex: '0',
                }),
              }),
            ],
            props: IN_LABEL,
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

          // Whether a click focuses a switch is the browser's (WebKit
          // doesn't), so focus follows it from script.
          await pointer.click(input);
          input.focus();
          expectOnEveryPart(mounted, 'data-focused', true);
          expectOnEveryPart(mounted, 'data-focus-visible', false);
        },
        PHASE,
      );

      scenario(
        'focusChange reports focus and blur',
        async ({ mount }) => {
          const mounted = await mount({
            template: wifi(),
            props: IN_LABEL,
            events: EVENTS,
          });
          const input = inputOf(mounted);
          input.focus();
          input.blur();
          expect(focusChanges(mounted)).toEqual([true, false]);
        },
        PHASE,
      );
    });

    group('state and renders', () => {
      scenario(
        'public state reports the selection, interaction and the props',
        async ({ mount }) => {
          const mounted = await mount({
            template: wifi(),
            props: { ...IN_LABEL, defaultSelected: true },
          });
          expect(mounted.state()).toEqual({
            isSelected: true,
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
        'toggling, hovering and focusing never re-render the owner',
        async ({ mount, keyboard, pointer }) => {
          const mounted = await mount({
            template: wifi(),
            props: IN_LABEL,
            events: EVENTS,
          });
          const input = inputOf(mounted);
          const renders = mounted.renderCount();

          await pointer.move(input);
          await pointer.click(input);
          input.focus();
          await keyboard.press('Space');

          expect(changes(mounted)).toEqual([true, false]);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads a switch that is off',
        async ({ mount, spoken }) => {
          await mount({ template: wifi(), props: IN_LABEL });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, Uses more battery, not checked',
          );
        },
        PHASE,
      );

      scenario(
        'reads a label part that is a label the same way',
        async ({ mount, spoken }) => {
          await mount({ template: plain() });
          expect(await spoken()).toContain('switch, Wi-Fi, not checked');
        },
        PHASE,
      );

      scenario(
        'reads a switch on in the markup',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({
              input: h('input', {
                part: 'input',
                type: 'checkbox',
                name: 'wifi',
                checked: '',
              }),
            }),
            props: { ...IN_LABEL, defaultSelected: true },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, Uses more battery, checked',
          );
        },
        PHASE,
      );

      scenario(
        'reads read only',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({ hasDescription: false }),
            props: { ...IN_LABEL, isReadOnly: true },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, not checked, read only',
          );
        },
        PHASE,
      );

      scenario(
        'reads required',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({ hasDescription: false }),
            props: { ...IN_LABEL, isRequired: true },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, not checked, required',
          );
        },
        PHASE,
      );

      scenario(
        'reads the error and invalid',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({ hasDescription: false }),
            props: { ...IN_LABEL, isInvalid: true },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, Turn on to sync, not checked, invalid',
          );
        },
        PHASE,
      );

      scenario(
        'reads disabled',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({ hasDescription: false }),
            props: { ...IN_LABEL, isDisabled: true },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, not checked, disabled',
          );
        },
        PHASE,
      );

      scenario(
        'reads a focusable disabled switch as disabled',
        async ({ mount, spoken }) => {
          await mount({
            template: wifi({ hasDescription: false }),
            props: {
              ...IN_LABEL,
              isDisabled: true,
              isFocusableWhenDisabled: true,
            },
          });
          expect(await spoken()).toContain(
            'switch, Wi-Fi, not checked, disabled',
          );
        },
        FOCUSABLE_PHASE,
      );

      scenario(
        'announces nothing on a toggle: the screen reader reads the new state itself',
        async ({ mount, pointer, listen }) => {
          const mounted = await mount({ template: wifi(), props: IN_LABEL });
          const heard = await listen();
          await pointer.click(inputOf(mounted));
          await pointer.click(inputOf(mounted));
          expect(await heard()).toEqual([]);
        },
        PHASE,
      );
    });

    group('real screen readers', () => {
      scenario(
        'Tab reads the switch off, with its description, and Space reads it on',
        async ({ mount, screenReader }) => {
          const heard = {
            voiceover: {
              off: /Wi-Fi Uses more battery off switch/,
              on: /^on Wi-Fi/,
            },
            nvda: { off: /Wi-Fi, switch, off, Uses more battery/, on: /^on$/ },
          }[screenReader.name];
          const mounted = await mount({
            template: [
              h('input', { id: 'before', 'aria-label': 'Before' }),
              ...wifi(),
            ],
            props: IN_LABEL,
          });
          await screenReader.startFrom(
            mounted.container.querySelector<HTMLElement>('#before')!,
          );
          await screenReader.press('Tab');
          expect.soft(await screenReader.spoken()).toMatch(heard.off);
          await screenReader.press('Space');
          expect.soft(await screenReader.spoken()).toMatch(heard.on);
        },
        { ...PHASE, needs: ['screenReader'] },
      );
    });
  },
);
