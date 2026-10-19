/**
 * RadioGroup conformance, from the spec approved by @tenphi on 2026-10-16
 * (`packages/core/src/components/radio-group/spec.md`): Field composed on a
 * `role="radiogroup"` root, the value its radios read and change through
 * their owner link, the `name` they share, the arrow keys and Tab, the
 * group's modes and states, form reset, focus within, public state, render
 * counts and spoken output. The radios are nested Radio components. Phase 3.
 *
 * The virtual screen reader reads a radio's checked state only from the
 * `checked` attribute, so the state is checked through the `checked`
 * property, and spoken output covers it only where the markup carries it.
 */

import { defineConformance, h, nested, partSelector } from '@uniaria/testing';
import type {
  Mounted,
  TemplateComponent,
  TemplateElement,
  TemplateNode,
} from '@uniaria/testing';
import { expect } from 'vitest';

import type { RadioGroupProps, RadioGroupState } from './types';

type MountedGroup = Mounted<RadioGroupProps, RadioGroupState>;

const PHASE = { phase: 3 } as const;

const PARTS = ['root', 'label', 'description', 'error'];

const RADIO_PARTS = ['root', 'input', 'indicator', 'label'];

const EVENTS = ['valueChange', 'focusChange'];

/** A radio in the group: a `label` root around its input and label. */
function option(
  value: string,
  label: string,
  props: Readonly<Record<string, unknown>> = {},
  input: Readonly<Record<string, string>> = {},
): TemplateComponent {
  return nested(
    'radio',
    { value, labelElementType: 'span', ...props },
    h(
      'label',
      { part: 'root' },
      h('input', { part: 'input', type: 'radio', ...input }),
      h('span', { part: 'indicator' }),
      h('span', { part: 'label' }, label),
    ),
  );
}

const FREE_PRO_TEAM = [
  option('free', 'Free'),
  option('pro', 'Pro'),
  option('team', 'Team'),
];

interface PlanOptions {
  readonly options?: readonly TemplateNode[];
  readonly hasDescription?: boolean;
}

/**
 * A group "Plan" with Free, Pro and Team, then the description
 * and the error, all inside the group's root (its outermost element).
 */
function plan({
  options = FREE_PRO_TEAM,
  hasDescription = true,
}: PlanOptions = {}): TemplateElement[] {
  return [
    h(
      'div',
      { part: 'root' },
      h('span', { part: 'label' }, 'Plan'),
      ...options,
      ...(hasDescription
        ? [h('p', { part: 'description' }, 'Billed monthly')]
        : []),
      h('p', { part: 'error' }, 'Pick a plan'),
    ),
  ];
}

/**
 * Text fields around the group, for Tab: WebKit's Tab skips buttons unless
 * the user turns on full keyboard access.
 */
function between(nodes: TemplateElement[]): TemplateElement[] {
  return [
    h('input', { id: 'before', 'aria-label': 'Before' }),
    ...nodes,
    h('input', { id: 'after', 'aria-label': 'After' }),
  ];
}

/** A nested radio part, in document order. */
function radioParts(mounted: MountedGroup, part: string): HTMLElement[] {
  return Array.from(
    mounted.container.querySelectorAll<HTMLElement>(
      partSelector('radio', part),
    ),
  );
}

/** The radios' inputs, in document order. */
function inputs(mounted: MountedGroup): HTMLInputElement[] {
  return radioParts(mounted, 'input') as HTMLInputElement[];
}

/** Each radio's `checked`, in document order. */
function checked(mounted: MountedGroup): boolean[] {
  return inputs(mounted).map((input) => input.checked);
}

/** Each radio's `tabindex`, in document order. */
function tabStops(mounted: MountedGroup): (string | null)[] {
  return inputs(mounted).map((input) => input.getAttribute('tabindex'));
}

function byId(mounted: MountedGroup, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
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

/** A state attribute is on every part of every radio, or on none. */
function expectOnEveryRadioPart(
  mounted: MountedGroup,
  attribute: string,
  present: boolean,
): void {
  for (const name of RADIO_PARTS) {
    for (const part of radioParts(mounted, name)) {
      expect(
        part.hasAttribute(attribute),
        `${attribute} on radio ${name}`,
      ).toBe(present);
    }
  }
}

/** Counts the native `change` events that reach the container. */
function countChanges(mounted: MountedGroup): { count: number } {
  const counter = { count: 0 };
  mounted.container.addEventListener('change', () => counter.count++);
  return counter;
}

/**
 * Records whether each arrow keydown was prevented, once the page has seen
 * it, until `stop()`.
 */
function watchArrows(mounted: MountedGroup): {
  readonly prevented: boolean[];
  stop(): void;
} {
  const prevented: boolean[] = [];
  const document = mounted.container.ownerDocument;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key.startsWith('Arrow')) prevented.push(event.defaultPrevented);
  };
  document.addEventListener('keydown', onKeyDown);
  return {
    prevented,
    stop: () => document.removeEventListener('keydown', onKeyDown),
  };
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

export const radioGroupConformance = defineConformance<
  RadioGroupProps,
  RadioGroupState
>('radio-group', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'composes Field on a radiogroup, and names its radios as one group',
      async ({ mount }) => {
        const mounted = await mount({ template: plan() });
        const root = mounted.part('root');
        const label = mounted.part('label');
        expect(root.getAttribute('role')).toBe('radiogroup');
        expect(root.getAttribute('aria-labelledby')).toBe(label.id);
        expect(root.getAttribute('aria-describedby')).toBe(
          mounted.part('description').id,
        );
        expect(label.hasAttribute('for')).toBe(false);
        expect(mounted.part('error').hidden).toBe(true);
        for (const name of [
          'aria-disabled',
          'aria-invalid',
          'aria-required',
          'aria-readonly',
          'aria-orientation',
        ]) {
          expect(root.hasAttribute(name), name).toBe(false);
        }
        for (const attribute of [
          'data-disabled',
          'data-readonly',
          'data-invalid',
          'data-required',
          'data-focus-within',
          'data-focus-visible',
          'data-orientation',
        ]) {
          expectOnEveryPart(mounted, attribute, false);
        }

        const radios = inputs(mounted);
        const name = radios[0]!.name;
        expect(name).not.toBe('');
        for (const input of radios) {
          expect(input.type).toBe('radio');
          expect(input.name).toBe(name);
          expect(input.hasAttribute('aria-checked')).toBe(false);
          expect(input.hasAttribute('aria-invalid')).toBe(false);
          expect(input.hasAttribute('aria-required')).toBe(false);
        }
        expect(radios.map((input) => input.value)).toEqual([
          'free',
          'pro',
          'team',
        ]);
        expect(checked(mounted)).toEqual([false, false, false]);
        // None selected: every radio is a tab stop.
        expect(tabStops(mounted)).toEqual(['0', '0', '0']);
        expect(
          radioParts(mounted, 'indicator')[0]!.getAttribute('aria-hidden'),
        ).toBe('true');
      },
      PHASE,
    );

    scenario(
      'the name prop is every radio name',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { name: 'plan' },
        });
        expect(inputs(mounted).map((input) => input.name)).toEqual([
          'plan',
          'plan',
          'plan',
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
            h('legend', { part: 'label' }, 'Plan'),
            option('free', 'Free'),
          ),
          props: { labelElementType: 'legend' },
        });
        const root = mounted.part('root');
        expect(root.getAttribute('role')).toBe('radiogroup');
        expect(root.getAttribute('aria-labelledby')).toBe(
          mounted.part('label').id,
        );
      },
      PHASE,
    );

    scenario(
      'orientation is written only when given',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { orientation: 'horizontal' },
        });
        expect(mounted.part('root').getAttribute('aria-orientation')).toBe(
          'horizontal',
        );
        for (const name of PARTS) {
          expect(mounted.part(name).getAttribute('data-orientation')).toBe(
            'horizontal',
          );
        }
        await mounted.setProps({ orientation: undefined });
        expect(mounted.part('root').hasAttribute('aria-orientation')).toBe(
          false,
        );
        expectOnEveryPart(mounted, 'data-orientation', false);
      },
      PHASE,
    );
  });

  group('value', () => {
    scenario(
      'a click selects a radio and reports it; the selected radio is the tab stop',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: plan(), events: EVENTS });
        const [free, pro] = inputs(mounted);

        await pointer.click(pro!);
        expect(checked(mounted)).toEqual([false, true, false]);
        expect(mounted.state().value).toBe('pro');
        expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);
        expect(
          radioParts(mounted, 'root')[1]!.hasAttribute('data-selected'),
        ).toBe(true);

        await pointer.click(free!);
        await pointer.click(free!);
        expect(checked(mounted)).toEqual([true, false, false]);
        expect(changes(mounted)).toEqual(['pro', 'free']);
      },
      PHASE,
    );

    scenario(
      'defaultValue checks its radio without reporting a change',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { defaultValue: 'team' },
          events: EVENTS,
        });
        expect(checked(mounted)).toEqual([false, false, true]);
        expect(tabStops(mounted)).toEqual(['-1', '-1', '0']);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'a controlled value follows props without reporting a change; null clears it',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { value: 'free' },
          events: EVENTS,
        });
        expect(checked(mounted)).toEqual([true, false, false]);

        await mounted.setProps({ value: 'team' });
        expect(checked(mounted)).toEqual([false, false, true]);
        await mounted.setProps({ value: null });
        expect(checked(mounted)).toEqual([false, false, false]);
        expect(mounted.state().value).toBe(null);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'controlled: a click reports the request, and the radios show the value until the consumer accepts',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: plan(),
          props: { value: 'free' },
          events: EVENTS,
        });
        const [, pro] = inputs(mounted);

        await pointer.click(pro!);
        expect(changes(mounted)).toEqual(['pro']);
        // The browser's change is put back: Free is checked again.
        expect(checked(mounted)).toEqual([true, false, false]);

        await mounted.setProps({ value: 'pro' });
        expect(checked(mounted)).toEqual([false, true, false]);
      },
      PHASE,
    );

    scenario(
      'a value with no radio checks none and keeps every radio a tab stop',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { defaultValue: 'enterprise' },
        });
        expect(checked(mounted)).toEqual([false, false, false]);
        expect(tabStops(mounted)).toEqual(['0', '0', '0']);
        expect(mounted.state().value).toBe('enterprise');
      },
      PHASE,
    );
  });

  group('keyboard', () => {
    scenario(
      'arrows move focus and select, wrapping both ways, with native change events',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: plan(),
          props: { defaultValue: 'free' },
          events: EVENTS,
        });
        const native = countChanges(mounted);
        const [free, pro, team] = inputs(mounted);
        free!.focus();

        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(pro);
        expect(checked(mounted)).toEqual([false, true, false]);
        await keyboard.press('ArrowRight');
        expect(document.activeElement).toBe(team);
        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(free);
        await keyboard.press('ArrowUp');
        expect(document.activeElement).toBe(team);
        await keyboard.press('ArrowLeft');
        expect(document.activeElement).toBe(pro);

        expect(checked(mounted)).toEqual([false, true, false]);
        expect(changes(mounted)).toEqual([
          'pro',
          'team',
          'free',
          'team',
          'pro',
        ]);
        expect(native.count).toBe(5);
      },
      PHASE,
    );

    scenario(
      'arrows skip a disabled radio',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: plan({
            options: [
              option('free', 'Free'),
              option('pro', 'Pro', { isDisabled: true }),
              option('team', 'Team'),
            ],
          }),
          props: { defaultValue: 'free' },
        });
        const [free, pro, team] = inputs(mounted);
        expect(pro!.disabled).toBe(true);
        expect(pro!.hasAttribute('tabindex')).toBe(false);
        free!.focus();
        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(team);
        expect(checked(mounted)).toEqual([false, false, true]);
      },
      PHASE,
    );

    scenario(
      'right to left, the horizontal arrows swap when the group is horizontal',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: h('div', { dir: 'rtl' }, ...plan()),
          props: { defaultValue: 'pro', orientation: 'horizontal' },
        });
        const [free, pro, team] = inputs(mounted);
        pro!.focus();
        await keyboard.press('ArrowRight');
        expect(document.activeElement).toBe(free);
        await keyboard.press('ArrowLeft');
        expect(document.activeElement).toBe(pro);
        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(team);

        await mounted.setProps({ orientation: 'vertical' });
        await keyboard.press('ArrowRight');
        expect(document.activeElement).toBe(free);
      },
      PHASE,
    );

    scenario(
      'Space selects the focused radio; Enter neither selects nor is prevented',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: plan(), events: EVENTS });
        const prevented: boolean[] = [];
        mounted.container.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') prevented.push(event.defaultPrevented);
        });
        const [, pro, team] = inputs(mounted);
        pro!.focus();

        await keyboard.press('Space');
        expect(checked(mounted)).toEqual([false, true, false]);
        team!.focus();
        await keyboard.press('Enter');
        expect(checked(mounted)).toEqual([false, true, false]);
        expect(prevented).toEqual([false]);
        expect(changes(mounted)).toEqual(['pro']);
      },
      PHASE,
    );

    scenario(
      'arrows with Alt, Ctrl or Meta are left to the browser',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: plan(),
          props: { defaultValue: 'free' },
          events: EVENTS,
        });
        const arrows = watchArrows(mounted);
        inputs(mounted)[0]!.focus();
        for (const modifier of ['Alt', 'Control', 'Meta']) {
          await keyboard.down(modifier);
          await keyboard.press('ArrowDown');
          await keyboard.up(modifier);
        }
        arrows.stop();
        expect(arrows.prevented).toEqual([false, false, false]);
      },
      PHASE,
    );

    scenario(
      "leaves the arrow keys of radios that aren't its own to them",
      async ({ mount, keyboard }) => {
        const seats = (value: string) =>
          h('input', {
            type: 'radio',
            name: 'seats',
            value,
            'aria-label': `${value} seats`,
          });
        const mounted = await mount({
          template: plan({
            options: [...FREE_PRO_TEAM, seats('5'), seats('10')],
          }),
          props: { defaultValue: 'free' },
          events: EVENTS,
        });
        const arrows = watchArrows(mounted);
        mounted.container
          .querySelector<HTMLInputElement>('input[name="seats"]')!
          .focus();
        await keyboard.press('ArrowDown');
        arrows.stop();
        expect(arrows.prevented).toEqual([false]);
        expect(checked(mounted)).toEqual([true, false, false]);
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );

    scenario(
      'Tab enters at the selected radio and leaves the group',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: between(plan()),
          props: { defaultValue: 'pro' },
        });
        const [, pro] = inputs(mounted);
        byId(mounted, 'before').focus();

        await keyboard.tab();
        expect(document.activeElement).toBe(pro);
        await keyboard.tab();
        expect(document.activeElement).toBe(byId(mounted, 'after'));
        await keyboard.tab({ isBackward: true });
        expect(document.activeElement).toBe(pro);
        await keyboard.tab({ isBackward: true });
        expect(document.activeElement).toBe(byId(mounted, 'before'));
      },
      PHASE,
    );

    scenario(
      'with none selected, Tab enters at the first radio',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: between(plan()) });
        byId(mounted, 'before').focus();
        await keyboard.tab();
        expect(document.activeElement).toBe(inputs(mounted)[0]);
      },
      PHASE,
    );
  });

  group('modes and states', () => {
    scenario(
      'isDisabled disables every radio natively and marks the group',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: plan(),
          props: { isDisabled: true, isInvalid: true },
          events: EVENTS,
        });
        expect(mounted.part('root').getAttribute('aria-disabled')).toBe('true');
        expectOnEveryPart(mounted, 'data-disabled', true);
        expectOnEveryRadioPart(mounted, 'data-disabled', true);
        expect(mounted.part('error').hidden).toBe(true);
        expect(inputs(mounted).map((input) => input.disabled)).toEqual([
          true,
          true,
          true,
        ]);

        await pointer.click(radioParts(mounted, 'label')[0]!);
        expect(checked(mounted)).toEqual([false, false, false]);
        expect(changes(mounted)).toEqual([]);

        await mounted.setProps({ isDisabled: false });
        expect(mounted.part('root').hasAttribute('aria-disabled')).toBe(false);
        expect(inputs(mounted).some((input) => input.disabled)).toBe(false);
      },
      PHASE,
    );

    scenario(
      'isReadOnly cancels every selection; arrows move focus only, and Tab leaves either way',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: between(plan()),
          props: { isReadOnly: true, defaultValue: 'pro' },
          events: EVENTS,
        });
        const native = countChanges(mounted);
        const [free, pro, team] = inputs(mounted);
        expect(mounted.part('root').getAttribute('aria-readonly')).toBe('true');
        expectOnEveryPart(mounted, 'data-readonly', true);
        expectOnEveryRadioPart(mounted, 'data-readonly', true);

        await pointer.click(team!);
        await pointer.click(radioParts(mounted, 'label')[0]!);
        expect(checked(mounted)).toEqual([false, true, false]);

        pro!.focus();
        await keyboard.press('ArrowUp');
        expect(document.activeElement).toBe(free);
        await keyboard.press('Space');
        expect(checked(mounted)).toEqual([false, true, false]);

        // From an unselected radio, Tab leaves rather than stopping on the
        // selected radio ahead, and Shift+Tab on the one behind.
        await keyboard.tab();
        expect(document.activeElement).toBe(byId(mounted, 'after'));
        team!.focus();
        await keyboard.tab({ isBackward: true });
        expect(document.activeElement).toBe(byId(mounted, 'before'));
        expect(changes(mounted)).toEqual([]);
        expect(native.count).toBe(0);
      },
      PHASE,
    );

    scenario(
      'a radio focusable while disabled is reached by arrows but never selected',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: plan({
            options: [
              option('free', 'Free'),
              option('pro', 'Pro', {
                isDisabled: true,
                isFocusableWhenDisabled: true,
              }),
              option('team', 'Team'),
            ],
          }),
          props: { defaultValue: 'free' },
          events: EVENTS,
        });
        const [free, pro, team] = inputs(mounted);
        expect(pro!.disabled).toBe(false);
        expect(pro!.getAttribute('aria-disabled')).toBe('true');
        expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);
        expect(
          radioParts(mounted, 'root')[1]!.hasAttribute('data-disabled'),
        ).toBe(true);

        await pointer.click(pro!);
        expect(checked(mounted)).toEqual([true, false, false]);

        free!.focus();
        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(pro);
        expect(checked(mounted)).toEqual([true, false, false]);
        await keyboard.press('ArrowDown');
        expect(document.activeElement).toBe(team);
        expect(checked(mounted)).toEqual([false, false, true]);
        expect(changes(mounted)).toEqual(['team']);
      },
      PHASE,
    );

    scenario(
      'isRequired and isInvalid go on the radiogroup; the error joins every radio',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { isRequired: true, isInvalid: true },
        });
        const root = mounted.part('root');
        const error = mounted.part('error');
        expect(root.getAttribute('aria-required')).toBe('true');
        expect(root.getAttribute('aria-invalid')).toBe('true');
        expect(root.getAttribute('aria-describedby')?.split(' ')).toContain(
          error.id,
        );
        expect(error.hidden).toBe(false);
        expectOnEveryPart(mounted, 'data-required', true);
        expectOnEveryPart(mounted, 'data-invalid', true);
        expectOnEveryRadioPart(mounted, 'data-invalid', true);
        for (const input of inputs(mounted)) {
          expect(input.hasAttribute('aria-invalid')).toBe(false);
          expect(input.hasAttribute('aria-required')).toBe(false);
          expect(input.getAttribute('aria-describedby')).toBe(error.id);
        }

        await mounted.setProps({ isInvalid: false });
        for (const input of inputs(mounted)) {
          expect(input.hasAttribute('aria-describedby')).toBe(false);
        }
        expectOnEveryRadioPart(mounted, 'data-invalid', false);
      },
      PHASE,
    );

    scenario(
      'announces a new group error once',
      async ({ mount, listen }) => {
        const mounted = await mount({ template: plan() });
        const heard = await listen();
        await mounted.setProps({ isInvalid: true });
        expect(await heard()).toEqual(['assertive: Pick a plan']);
      },
      PHASE,
    );
  });

  group('form reset', () => {
    scenario(
      'returns an uncontrolled group to its default',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(plan()),
          props: { defaultValue: 'pro' },
          events: EVENTS,
        });
        await pointer.click(inputs(mounted)[2]!);
        expect(checked(mounted)).toEqual([false, false, true]);

        await reset(mounted, pointer);
        await expect.poll(() => checked(mounted)).toEqual([false, true, false]);
        expect(mounted.state().value).toBe('pro');
        expect(changes(mounted)).toEqual(['team', 'pro']);
      },
      PHASE,
    );

    scenario(
      'asks a controlled group for the value it mounted with',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(plan()),
          props: { value: 'pro' },
          events: EVENTS,
        });
        await mounted.setProps({ value: 'free' });
        mounted.clearEvents();

        await reset(mounted, pointer);
        expect(changes(mounted)).toEqual(['pro']);
        // Still the controlled value until the consumer accepts.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(checked(mounted)).toEqual([true, false, false]);

        await mounted.setProps({ value: 'pro' });
        expect(checked(mounted)).toEqual([false, true, false]);
      },
      PHASE,
    );

    scenario(
      'a reset the page cancels changes nothing',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: inForm(plan()),
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
        expect(checked(mounted)).toEqual([true, false, false]);
        expect(mounted.state().value).toBe('free');
        expect(changes(mounted)).toEqual([]);
      },
      PHASE,
    );
  });

  group('hover and focus', () => {
    scenario(
      'hovering and focusing a radio marks its parts, and hover never while disabled',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({
          template: between(plan()),
          props: { defaultValue: 'pro' },
        });
        const partsOf = (index: number) =>
          RADIO_PARTS.map((name) => radioParts(mounted, name)[index]!);
        const expectOnRadio = (
          index: number,
          attribute: string,
          present: boolean,
        ) => {
          for (const part of partsOf(index)) {
            expect(part.hasAttribute(attribute), attribute).toBe(present);
          }
        };

        await pointer.move(radioParts(mounted, 'label')[1]!);
        expectOnRadio(1, 'data-hovered', true);
        expectOnRadio(0, 'data-hovered', false);
        await pointer.moveOutside(mounted.part('root'));
        expectOnRadio(1, 'data-hovered', false);

        byId(mounted, 'before').focus();
        await keyboard.tab();
        expectOnRadio(1, 'data-focused', true);
        expectOnRadio(1, 'data-focus-visible', true);
        expectOnRadio(0, 'data-focused', false);
        byId(mounted, 'after').focus();
        expectOnRadio(1, 'data-focused', false);
        expectOnRadio(1, 'data-focus-visible', false);

        await mounted.setProps({ isDisabled: true });
        await pointer.move(radioParts(mounted, 'label')[1]!);
        expectOnRadio(1, 'data-hovered', false);
      },
      PHASE,
    );

    scenario(
      "a radio's wrapper is its hovered area, not the rest of its root",
      async ({ mount, pointer }) => {
        const described = nested(
          'radio',
          { value: 'pro', labelElementType: 'span' },
          h(
            'div',
            { part: 'root' },
            h(
              'label',
              { part: 'wrapper' },
              h('input', { part: 'input', type: 'radio' }),
              h('span', { part: 'indicator' }),
              h('span', { part: 'label' }, 'Pro'),
            ),
            h('p', { part: 'description' }, 'For small teams'),
          ),
        );
        const mounted = await mount({
          template: plan({ options: [option('free', 'Free'), described] }),
        });
        const [root] = radioParts(mounted, 'root').slice(1);
        const [wrapper] = radioParts(mounted, 'wrapper');

        await pointer.move(radioParts(mounted, 'label')[1]!);
        expect(root!.hasAttribute('data-hovered')).toBe(true);
        expect(wrapper!.hasAttribute('data-hovered')).toBe(true);

        await pointer.move(radioParts(mounted, 'description')[0]!);
        expect(root!.hasAttribute('data-hovered')).toBe(false);
      },
      PHASE,
    );

    scenario(
      'focus within marks the group, visible after keyboard, and focusChange reports it once',
      async ({ mount, keyboard, pointer }) => {
        const mounted = await mount({
          template: between(plan()),
          props: { defaultValue: 'free' },
          events: EVENTS,
        });
        byId(mounted, 'before').focus();

        await keyboard.tab();
        expectOnEveryPart(mounted, 'data-focus-within', true);
        expectOnEveryPart(mounted, 'data-focus-visible', true);
        expect(mounted.state()).toMatchObject({
          isFocusWithin: true,
          isFocusVisible: true,
        });
        await keyboard.press('ArrowDown');
        expect(focusChanges(mounted)).toEqual([true]);

        await pointer.click(inputs(mounted)[2]!);
        inputs(mounted)[2]!.focus();
        expectOnEveryPart(mounted, 'data-focus-visible', false);

        byId(mounted, 'after').focus();
        expectOnEveryPart(mounted, 'data-focus-within', false);
        expect(focusChanges(mounted)).toEqual([true, false]);
      },
      PHASE,
    );
  });

  group('state and renders', () => {
    scenario(
      'public state reports the value and the props',
      async ({ mount }) => {
        const mounted = await mount({
          template: plan(),
          props: { defaultValue: 'pro' },
        });
        expect(mounted.state()).toEqual({
          value: 'pro',
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
      'selecting by click and arrow key never re-renders the owner',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({ template: plan(), events: EVENTS });
        const renders = mounted.renderCount();
        const [free] = inputs(mounted);

        await pointer.click(free!);
        free!.focus();
        await keyboard.press('ArrowDown');
        free!.blur();

        expect(changes(mounted)).toEqual(['free', 'pro']);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'reads the group with its name and description, and each radio with its position',
      async ({ mount, spoken }) => {
        await mount({ template: plan() });
        const phrases = await spoken();
        expect(phrases).toContain('radiogroup, Plan, Billed monthly');
        expect(phrases).toContain(
          'radio, Free, not checked, position 1, set size 3',
        );
        expect(phrases).toContain(
          'radio, Team, not checked, position 3, set size 3',
        );
      },
      PHASE,
    );

    scenario(
      'reads a radio checked in the markup',
      async ({ mount, spoken }) => {
        await mount({
          template: plan({
            options: [
              option('free', 'Free'),
              option('pro', 'Pro', {}, { checked: '' }),
              option('team', 'Team'),
            ],
          }),
          props: { defaultValue: 'pro' },
        });
        expect(await spoken()).toContain(
          'radio, Pro, checked, position 2, set size 3',
        );
      },
      PHASE,
    );

    scenario(
      'reads required and invalid on the group, and the error on each radio',
      async ({ mount, spoken }) => {
        await mount({
          template: plan({ hasDescription: false }),
          props: { isRequired: true, isInvalid: true },
        });
        const phrases = await spoken();
        expect(phrases).toContain(
          'radiogroup, Plan, Pick a plan, invalid, required',
        );
        expect(phrases).toContain(
          'radio, Free, Pick a plan, not checked, position 1, set size 3',
        );
      },
      PHASE,
    );

    scenario(
      'reads a disabled group and its disabled radios',
      async ({ mount, spoken }) => {
        await mount({
          template: plan({ hasDescription: false }),
          props: { isDisabled: true },
        });
        const phrases = await spoken();
        expect(phrases).toContain('radiogroup, Plan, disabled');
        expect(phrases).toContain(
          'radio, Pro, not checked, disabled, position 2, set size 3',
        );
      },
      PHASE,
    );

    scenario(
      'reads read only and the orientation on the group',
      async ({ mount, spoken }) => {
        await mount({
          template: plan({ hasDescription: false }),
          props: { isReadOnly: true, orientation: 'horizontal' },
        });
        expect(await spoken()).toContain(
          'radiogroup, Plan, orientated horizontally, read only',
        );
      },
      PHASE,
    );
  });

  group('real screen readers', () => {
    scenario(
      'Tab reads the group and its first radio, and an arrow checks the next',
      async ({ mount, screenReader }) => {
        const heard = {
          voiceover: {
            group: /Free radio button, 1 of 3 Plan Billed monthly radio group/,
            next: /Pro selected radio button, 2 of 3/,
          },
          nvda: {
            group: /Plan, grouping, Billed monthly/,
            next: /Pro, radio button, checked, 2 of 3/,
          },
        }[screenReader.name];
        const mounted = await mount({ template: between(plan()) });
        await screenReader.startFrom(
          mounted.container.querySelector<HTMLElement>('#before')!,
        );
        await screenReader.press('Tab');
        expect.soft(await screenReader.spoken()).toMatch(heard.group);
        // NVDA's speech stops at the group; its focus report names the radio.
        // VoiceOver has no item text for a radio.
        if (screenReader.name === 'nvda') {
          expect
            .soft(await screenReader.readFocus())
            .toMatch(/Free, radio button, focused, not checked, 1 of 3/);
        }
        await screenReader.press('ArrowDown');
        expect.soft(await screenReader.spoken()).toMatch(heard.next);
      },
      { ...PHASE, needs: ['screenReader'] },
    );
  });
});
