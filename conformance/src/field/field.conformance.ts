/**
 * Field conformance, from the spec approved by @tenphi on 2026-10-15
 * (`packages/core/src/components/field/spec.md`): the parts and the
 * attributes UniAria owns, linking the label, the description and the error to
 * the control (only parts that are rendered, never a hidden error), the
 * invalid, required and disabled states, public state, announcing a new
 * error, and spoken output. Everything here is phase 3.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateElement, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { FieldProps, FieldState } from './types';

type MountedField = Mounted<FieldProps, FieldState>;

const PHASE = { phase: 3 } as const;

const PARTS = ['root', 'label', 'control', 'description', 'error'];

const STATE_ATTRIBUTES = ['data-invalid', 'data-required', 'data-disabled'];

interface EmailOptions {
  /** The label part; `null` leaves it out. */
  readonly label?: TemplateElement | null;
  readonly control?: TemplateElement;
  /** The description's text; `null` leaves the part out. */
  readonly description?: string | null;
  /** The error's text; `null` leaves the part out, `''` renders it empty. */
  readonly error?: string | null;
}

/**
 * The spec's example: a root around a native label, an email input, a
 * description and an error.
 */
function email({
  label = h('label', { part: 'label' }, 'Email'),
  control = h('input', { part: 'control', type: 'email', name: 'email' }),
  description = 'We never share it',
  error = 'Enter a valid email',
}: EmailOptions = {}): TemplateElement {
  const children: TemplateNode[] = [];
  if (label) children.push(label);
  children.push(control);
  if (description !== null) {
    children.push(h('p', { part: 'description' }, description));
  }
  if (error !== null) {
    children.push(h('p', { part: 'error' }, ...(error ? [error] : [])));
  }
  return h('div', { part: 'root' }, ...children);
}

/** The ids an attribute lists; empty when it is missing. */
function idList(element: Element, attribute: string): string[] {
  return element.getAttribute(attribute)?.split(' ').filter(Boolean) ?? [];
}

/** The ids of parts, in the order given. */
function idsOf(mounted: MountedField, ...names: string[]): string[] {
  return names.map((name) => mounted.part(name).id);
}

/**
 * The error is shown and linked, or hidden and unlinked, and `isErrorShown`
 * agrees.
 */
function expectErrorShown(mounted: MountedField, shown: boolean): void {
  const error = mounted.part('error');
  const describedBy = idList(mounted.part('control'), 'aria-describedby');
  expect(error.hidden, 'error hidden').toBe(!shown);
  expect(describedBy.includes(error.id), 'error linked').toBe(shown);
  expect(mounted.state().isErrorShown).toBe(shown);
}

/** A state attribute is on all five parts, or on none. */
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

/** Long enough for an announcement to reach its live region and be heard. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

/** The live-region phrases heard so far that carry `text`. */
async function heardOf(
  heard: () => Promise<string[]>,
  text: string,
): Promise<string[]> {
  return (await heard()).filter((phrase) => phrase.includes(text));
}

export const fieldConformance = defineConformance<FieldProps, FieldState>(
  'field',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'marks every part and sets no state while valid',
        async ({ mount }) => {
          const mounted = await mount({ template: email() });
          // `part()` fails without data-scope="field" and data-part.
          expect(mounted.part('root').hasAttribute('role')).toBe(false);
          const control = mounted.part('control');
          for (const name of [
            'aria-invalid',
            'aria-required',
            'required',
            'disabled',
            'aria-disabled',
          ]) {
            expect(control.hasAttribute(name), name).toBe(false);
          }
          for (const attribute of STATE_ATTRIBUTES) {
            expectOnEveryPart(mounted, attribute, false);
          }
          expectErrorShown(mounted, false);
        },
        PHASE,
      );

      scenario(
        'links the label to the control, so clicking it focuses the control',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: email() });
          const label = mounted.part('label');
          const control = mounted.part('control');
          expect(control.id).not.toBe('');
          expect(label.id).not.toBe('');
          expect(label.getAttribute('for')).toBe(control.id);
          expect(idList(control, 'aria-labelledby')).toEqual([label.id]);

          await pointer.click(label);
          expect(document.activeElement).toBe(control);
        },
        PHASE,
      );

      scenario(
        'controlId is the id the label points at',
        async ({ mount }) => {
          const mounted = await mount({
            template: email({
              control: h('input', {
                part: 'control',
                id: 'work-email',
                type: 'email',
              }),
            }),
            props: { controlId: 'work-email' },
          });
          expect(mounted.part('control').id).toBe('work-email');
          expect(mounted.part('label').getAttribute('for')).toBe('work-email');
        },
        PHASE,
      );

      scenario(
        'links the description, and the error only while it is shown',
        async ({ mount }) => {
          const mounted = await mount({ template: email() });
          const control = mounted.part('control');
          expect(idList(control, 'aria-describedby')).toEqual(
            idsOf(mounted, 'description'),
          );

          await mounted.setProps({ isInvalid: true });
          expect(idList(control, 'aria-describedby')).toEqual(
            idsOf(mounted, 'description', 'error'),
          );

          await mounted.setProps({ isInvalid: false });
          expect(idList(control, 'aria-describedby')).toEqual(
            idsOf(mounted, 'description'),
          );
        },
        PHASE,
      );

      scenario(
        'a label of another element names the control without for',
        async ({ mount }) => {
          const mounted = await mount({
            template: email({ label: h('span', { part: 'label' }, 'Email') }),
            props: { labelElementType: 'span' },
          });
          const label = mounted.part('label');
          expect(label.hasAttribute('for')).toBe(false);
          expect(idList(mounted.part('control'), 'aria-labelledby')).toEqual([
            label.id,
          ]);
        },
        PHASE,
      );

      scenario(
        "labelledBy and describedBy come after Field's own ids",
        async ({ mount }) => {
          const mounted = await mount({
            template: [
              email(),
              h('span', { id: 'email-scope' }, 'Work'),
              h('span', { id: 'email-tip' }, 'Ask IT if unsure'),
            ],
            props: { labelledBy: 'email-scope', describedBy: 'email-tip' },
          });
          const control = mounted.part('control');
          expect(idList(control, 'aria-labelledby')).toEqual([
            ...idsOf(mounted, 'label'),
            'email-scope',
          ]);
          expect(idList(control, 'aria-describedby')).toEqual([
            ...idsOf(mounted, 'description'),
            'email-tip',
          ]);

          await mounted.setProps({ isInvalid: true });
          expect(idList(control, 'aria-describedby')).toEqual([
            ...idsOf(mounted, 'description', 'error'),
            'email-tip',
          ]);
        },
        PHASE,
      );

      scenario(
        'links only the parts that are rendered',
        async ({ mount }) => {
          // A control alone: every other part is optional.
          const mounted = await mount({
            template: h('input', {
              part: 'control',
              type: 'email',
              'aria-label': 'Email',
            }),
            props: { isInvalid: true, isRequired: true },
          });
          const control = mounted.part('control');
          expect(control.id).not.toBe('');
          expect(control.hasAttribute('aria-labelledby')).toBe(false);
          expect(control.hasAttribute('aria-describedby')).toBe(false);
          expect(control.getAttribute('aria-invalid')).toBe('true');
          expect(control.getAttribute('aria-required')).toBe('true');
        },
        PHASE,
      );
    });

    group('states', () => {
      scenario(
        'isInvalid marks the control and every part, and shows the error',
        async ({ mount }) => {
          const mounted = await mount({ template: email() });
          const control = mounted.part('control');

          await mounted.setProps({ isInvalid: true });
          expect(control.getAttribute('aria-invalid')).toBe('true');
          expectOnEveryPart(mounted, 'data-invalid', true);
          expectErrorShown(mounted, true);

          // Removed, never "false", which reads "not invalid".
          await mounted.setProps({ isInvalid: false });
          expect(control.hasAttribute('aria-invalid')).toBe(false);
          expectOnEveryPart(mounted, 'data-invalid', false);
          expectErrorShown(mounted, false);
        },
        PHASE,
      );

      scenario(
        'isRequired sets aria-required, never the native required',
        async ({ mount }) => {
          const mounted = await mount({
            template: email(),
            props: { isRequired: true },
          });
          const control = mounted.part('control');
          expect(control.getAttribute('aria-required')).toBe('true');
          expect(control.hasAttribute('required')).toBe(false);
          expectOnEveryPart(mounted, 'data-required', true);

          await mounted.setProps({ isRequired: false });
          expect(control.hasAttribute('aria-required')).toBe(false);
          expectOnEveryPart(mounted, 'data-required', false);
        },
        PHASE,
      );

      scenario(
        'isDisabled marks every part and hides the error, leaving the control enabled',
        async ({ mount }) => {
          const mounted = await mount({
            template: email(),
            props: { isInvalid: true, isDisabled: true },
          });
          const control = mounted.part('control');
          expectOnEveryPart(mounted, 'data-disabled', true);
          expectOnEveryPart(mounted, 'data-invalid', true);
          expect(control.getAttribute('aria-invalid')).toBe('true');
          expect(control.hasAttribute('disabled')).toBe(false);
          expect(control.hasAttribute('aria-disabled')).toBe(false);
          expectErrorShown(mounted, false);

          await mounted.setProps({ isDisabled: false });
          expectOnEveryPart(mounted, 'data-disabled', false);
          expectErrorShown(mounted, true);
        },
        PHASE,
      );

      scenario(
        'public state is the three props and whether the error is shown',
        async ({ mount }) => {
          const mounted = await mount({ template: email() });
          expect(mounted.state()).toEqual({
            isInvalid: false,
            isRequired: false,
            isDisabled: false,
            isErrorShown: false,
          });

          await mounted.setProps({ isInvalid: true, isRequired: true });
          expect(mounted.state()).toEqual({
            isInvalid: true,
            isRequired: true,
            isDisabled: false,
            isErrorShown: true,
          });

          await mounted.setProps({ isDisabled: true });
          expect(mounted.state()).toEqual({
            isInvalid: true,
            isRequired: true,
            isDisabled: true,
            isErrorShown: false,
          });
        },
        PHASE,
      );
    });

    // Each scenario has its own error text, so a late announcement from
    // another scenario can't count.
    group('announcing the error', () => {
      scenario(
        'announces a new error assertively, once',
        async ({ mount, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: email({ error: 'Enter your email' }),
          });

          await mounted.setProps({ isInvalid: true });
          const expected = ['assertive: Enter your email'];
          await expect
            .poll(() => heardOf(heard, 'Enter your email'))
            .toEqual(expected);
          await settle();
          expect(await heardOf(heard, 'Enter your email')).toEqual(expected);
        },
        PHASE,
      );

      scenario(
        'announces the error again each time it is shown',
        async ({ mount, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: email({ error: 'Pick a shorter address' }),
          });

          await mounted.setProps({ isInvalid: true });
          await expect
            .poll(() => heardOf(heard, 'Pick a shorter address'))
            .toHaveLength(1);
          await mounted.setProps({ isInvalid: false });
          await mounted.setProps({ isInvalid: true });
          await expect
            .poll(() => heardOf(heard, 'Pick a shorter address'))
            .toEqual([
              'assertive: Pick a shorter address',
              'assertive: Pick a shorter address',
            ]);
        },
        PHASE,
      );

      scenario(
        'announces new error text while the error is shown',
        async ({ mount, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: email({ error: 'Enter an email' }),
          });
          await mounted.setProps({ isInvalid: true });
          await expect
            .poll(() => heardOf(heard, 'Enter an email'))
            .toEqual(['assertive: Enter an email']);

          // The consumer owns the error's content and changes it.
          mounted.part('error').textContent = 'Use your work email';
          await expect
            .poll(() => heardOf(heard, 'Use your work email'))
            .toEqual(['assertive: Use your work email']);
        },
        PHASE,
      );

      scenario(
        'stays quiet about an error already shown when it mounts',
        async ({ mount, listen }) => {
          const heard = await listen();
          await mount({
            template: email({ error: 'Already invalid' }),
            props: { isInvalid: true },
          });
          await settle();
          expect(await heardOf(heard, 'Already invalid')).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'stays quiet while disabled, and announces once enabled',
        async ({ mount, listen }) => {
          const heard = await listen();
          const mounted = await mount({
            template: email({ error: 'Fix this later' }),
            props: { isDisabled: true },
          });

          await mounted.setProps({ isInvalid: true });
          await settle();
          expect(await heardOf(heard, 'Fix this later')).toEqual([]);

          await mounted.setProps({ isDisabled: false });
          await expect
            .poll(() => heardOf(heard, 'Fix this later'))
            .toEqual(['assertive: Fix this later']);
        },
        PHASE,
      );

      scenario(
        'stays quiet without an error part or with an empty one',
        async ({ mount, listen }) => {
          const heard = await listen();
          const missing = await mount({ template: email({ error: null }) });
          const empty = await mount({ template: email({ error: '' }) });

          await missing.setProps({ isInvalid: true });
          await empty.setProps({ isInvalid: true });
          await settle();
          expect(await heard()).toEqual([]);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the label',
        async ({ mount, spoken }) => {
          await mount({ template: email({ description: null, error: null }) });
          expect(await spoken()).toContain('textbox, Email');
        },
        PHASE,
      );

      scenario(
        'reads the description, and never the hidden error',
        async ({ mount, spoken }) => {
          await mount({ template: email() });
          const phrases = await spoken();
          expect(phrases).toContain('textbox, Email, We never share it');
          expect(phrases.join('\n')).not.toContain('Enter a valid email');
        },
        PHASE,
      );

      scenario(
        'reads required',
        async ({ mount, spoken }) => {
          await mount({ template: email(), props: { isRequired: true } });
          expect(await spoken()).toContain(
            'textbox, Email, We never share it, required',
          );
        },
        PHASE,
      );

      scenario(
        'reads the error after the description, then invalid',
        async ({ mount, spoken }) => {
          await mount({ template: email(), props: { isInvalid: true } });
          expect(await spoken()).toContain(
            'textbox, Email, We never share it Enter a valid email, invalid',
          );
        },
        PHASE,
      );

      scenario(
        'reads invalid and required',
        async ({ mount, spoken }) => {
          await mount({
            template: email(),
            props: { isInvalid: true, isRequired: true },
          });
          expect(await spoken()).toContain(
            'textbox, Email, We never share it Enter a valid email, invalid, required',
          );
        },
        PHASE,
      );

      scenario(
        'stops reading the error once valid again',
        async ({ mount, spoken }) => {
          const mounted = await mount({
            template: email(),
            props: { isInvalid: true },
          });
          await mounted.setProps({ isInvalid: false });
          const phrases = await spoken();
          expect(phrases).toContain('textbox, Email, We never share it');
          expect(phrases.join('\n')).not.toContain('Enter a valid email');
        },
        PHASE,
      );

      scenario(
        'reads a disabled control as disabled and invalid, without the error',
        async ({ mount, spoken }) => {
          await mount({
            template: email({
              control: h('input', {
                part: 'control',
                type: 'email',
                disabled: '',
              }),
            }),
            props: { isInvalid: true, isDisabled: true },
          });
          expect(await spoken()).toContain(
            'textbox, Email, We never share it, disabled, invalid',
          );
        },
        PHASE,
      );

      scenario(
        'reads a checkbox control',
        async ({ mount, spoken }) => {
          await mount({
            template: h(
              'div',
              { part: 'root' },
              h('input', { part: 'control', type: 'checkbox' }),
              h('label', { part: 'label' }, 'Accept terms'),
              h('p', { part: 'error' }, 'You must accept'),
            ),
            props: { isInvalid: true, isRequired: true },
          });
          expect(await spoken()).toContain(
            'checkbox, Accept terms, You must accept, not checked, invalid, required',
          );
        },
        PHASE,
      );

      scenario(
        'reads a radio group control',
        async ({ mount, spoken }) => {
          const radio = (value: string, text: string) =>
            h(
              'label',
              null,
              h('input', { type: 'radio', name: 'plan', value }),
              text,
            );
          await mount({
            template: h(
              'div',
              { part: 'root' },
              h('span', { part: 'label' }, 'Plan'),
              h(
                'div',
                { part: 'control', role: 'radiogroup' },
                radio('free', 'Free'),
                radio('pro', 'Pro'),
              ),
            ),
            props: {
              labelElementType: 'span',
              isInvalid: true,
              isRequired: true,
            },
          });
          expect(await spoken()).toContain(
            'radiogroup, Plan, invalid, required',
          );
        },
        PHASE,
      );
    });
  },
);
