/**
 * ToggleButton conformance, from the spec approved by @tenphi on 2026-10-15
 * (`packages/core/src/components/toggle-button/spec.md`). ToggleButton is
 * Button plus `isSelected`, so this suite covers what the selection adds:
 * `aria-pressed` and `data-selected`, toggling from every input, the event
 * order, controlled and uncontrolled use, disabled modes, render counts and
 * spoken output, and `focusChange` (from the gate 3 API review). Press,
 * hover and focus behave as Button's suite checks. Everything here is
 * phase 3.
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateAttrs } from '@uniaria/testing';
import { expect } from 'vitest';

import type { PressEvent } from '../button/types';
import type { ToggleButtonProps, ToggleButtonState } from './types';

type MountedToggle = Mounted<ToggleButtonProps, ToggleButtonState>;

const PHASE = { phase: 3 } as const;

const EVENTS = ['pressStart', 'pressEnd', 'selectedChange', 'press'];

const bold = (attrs: TemplateAttrs = {}) =>
  h('button', { part: 'root', ...attrs }, 'Bold');

/** The `selectedChange` details so far, in order. */
function requests(mounted: MountedToggle): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'selectedChange')
    .map((event) => event.detail);
}

/** `aria-pressed`, `data-selected` and `isSelected` all say `isSelected`. */
function expectSelected(mounted: MountedToggle, isSelected: boolean): void {
  const root = mounted.part();
  expect(root.getAttribute('aria-pressed')).toBe(String(isSelected));
  expect(root.hasAttribute('data-selected')).toBe(isSelected);
  expect(mounted.state().isSelected).toBe(isSelected);
}

export const toggleButtonConformance = defineConformance<
  ToggleButtonProps,
  ToggleButtonState
>('toggle-button', ({ scenario, group }) => {
  group('anatomy', () => {
    scenario(
      'renders a native button that is off, with the attributes UniAria owns',
      async ({ mount }) => {
        const mounted = await mount({ template: bold() });
        const root = mounted.part();
        expect(root.tagName).toBe('BUTTON');
        expect(root.getAttribute('type')).toBe('button');
        expect(root.getAttribute('tabindex')).toBe('0');
        expect(root.getAttribute('data-uni')).toBe('toggle-button');
        expect(root.hasAttribute('data-element')).toBe(false);
        expectSelected(mounted, false);
        for (const name of ['role', 'disabled', 'aria-disabled']) {
          expect(root.hasAttribute(name), name).toBe(false);
        }
      },
      PHASE,
    );

    scenario(
      'defaultSelected starts it on',
      async ({ mount }) => {
        const mounted = await mount({
          template: bold(),
          props: { defaultSelected: true },
        });
        expectSelected(mounted, true);
      },
      PHASE,
    );

    scenario(
      'gives a non-native root a button role and aria-pressed',
      async ({ mount }) => {
        const mounted = await mount({
          template: h('div', { part: 'root' }, 'Bold'),
          props: { elementType: 'div' },
        });
        const root = mounted.part();
        expect(root.getAttribute('role')).toBe('button');
        expect(root.getAttribute('tabindex')).toBe('0');
        expect(root.hasAttribute('type')).toBe(false);
        expectSelected(mounted, false);
      },
      PHASE,
    );
  });

  group('toggling', () => {
    scenario(
      'a mouse press toggles and reports selectedChange before press',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        const root = mounted.part();

        await pointer.click(root);
        expect(mounted.eventNames()).toEqual(EVENTS);
        expect(requests(mounted)).toEqual([true]);
        expectSelected(mounted, true);

        mounted.clearEvents();
        await pointer.click(root);
        expect(mounted.eventNames()).toEqual(EVENTS);
        expect(requests(mounted)).toEqual([false]);
        expectSelected(mounted, false);
      },
      PHASE,
    );

    scenario(
      'Space and Enter toggle on keyup',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        mounted.part().focus();

        await keyboard.down('Space');
        expect(mounted.eventNames()).toEqual(['pressStart']);
        expectSelected(mounted, false);
        await keyboard.up('Space');
        expect(mounted.eventNames()).toEqual(EVENTS);
        expectSelected(mounted, true);

        mounted.clearEvents();
        await keyboard.down('Enter');
        expectSelected(mounted, true);
        await keyboard.up('Enter');
        expect(mounted.eventNames()).toEqual(EVENTS);
        expectSelected(mounted, false);
      },
      PHASE,
    );

    scenario(
      'a press released outside the root leaves it alone',
      async ({ mount, pointer }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        const root = mounted.part();

        await pointer.down(root);
        await pointer.moveOutside(root);
        await pointer.up();
        expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
        expectSelected(mounted, false);
      },
      PHASE,
    );

    scenario(
      'a screen-reader click toggles once',
      async ({ mount }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        mounted.part().click();
        expect(mounted.eventNames()).toEqual(EVENTS);
        const press = mounted.events.find((event) => event.name === 'press');
        expect(press?.detail).toMatchObject({ pointerType: 'virtual' });
        expectSelected(mounted, true);
      },
      PHASE,
    );

    scenario(
      'a tap toggles once',
      async ({ mount, touch }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        await touch.tap(mounted.part());
        await expect.poll(() => mounted.eventNames()).toEqual(EVENTS);
        const press = mounted.events.find((event) => event.name === 'press');
        expect((press?.detail as PressEvent).pointerType).toBe('touch');
        expectSelected(mounted, true);
      },
      { ...PHASE, needs: ['touch'] },
    );
  });

  group('controlled', () => {
    scenario(
      'a press reports the request and waits for the new value',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: bold(),
          props: { isSelected: false },
          events: EVENTS,
        });
        const root = mounted.part();

        await pointer.click(root);
        expect(mounted.eventNames()).toEqual(EVENTS);
        expect(requests(mounted)).toEqual([true]);
        expectSelected(mounted, false);

        // The consumer accepts it. Setting the value never reports a change.
        mounted.clearEvents();
        await mounted.setProps({ isSelected: true });
        expectSelected(mounted, true);
        await mounted.setProps({ isSelected: false });
        expectSelected(mounted, false);
        expect(mounted.eventNames()).toEqual([]);
      },
      PHASE,
    );
  });

  group('disabled', () => {
    scenario(
      'a disabled toggle keeps its state and never toggles',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: bold(),
          props: { defaultSelected: true, isDisabled: true },
          events: EVENTS,
        });
        const root = mounted.part();
        expect(root.hasAttribute('disabled')).toBe(true);
        expectSelected(mounted, true);

        await pointer.click(root);
        root.click();
        expect(mounted.eventNames()).toEqual([]);
        expectSelected(mounted, true);

        await mounted.setProps({ isDisabled: false });
        expectSelected(mounted, true);
      },
      PHASE,
    );

    scenario(
      'isFocusableWhenDisabled keeps focus and still never toggles',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: bold(),
          props: { isDisabled: true, isFocusableWhenDisabled: true },
          events: EVENTS,
        });
        const root = mounted.part();
        expect(root.getAttribute('aria-disabled')).toBe('true');
        expect(root.hasAttribute('disabled')).toBe(false);

        root.focus();
        expect(document.activeElement).toBe(root);
        await keyboard.press('Space');
        await keyboard.press('Enter');
        expect(mounted.eventNames()).toEqual([]);
        expectSelected(mounted, false);
      },
      PHASE,
    );
  });

  group('focus', () => {
    scenario(
      'shouldPreventFocusOnPress toggles and leaves focus where it was',
      async ({ mount, pointer }) => {
        const mounted = await mount({
          template: [
            h('input', { id: 'editor', 'aria-label': 'Editor' }),
            bold(),
          ],
          props: { shouldPreventFocusOnPress: true },
        });
        const editor = mounted.container.querySelector('#editor')!;
        (editor as HTMLElement).focus();

        await pointer.click(mounted.part());
        expectSelected(mounted, true);
        expect(document.activeElement).toBe(editor);
      },
      PHASE,
    );

    scenario(
      'focusChange reports focus and blur once each, toggling in between',
      async ({ mount, keyboard }) => {
        const mounted = await mount({
          template: bold(),
          events: [...EVENTS, 'focusChange'],
        });
        const root = mounted.part();
        root.focus();
        await keyboard.press('Space');
        root.blur();
        expectSelected(mounted, true);
        expect(
          mounted.events
            .filter((event) => event.name === 'focusChange')
            .map((event) => event.detail),
        ).toEqual([true, false]);
      },
      PHASE,
    );
  });

  group('state and renders', () => {
    scenario(
      'public state is Button state plus isSelected',
      async ({ mount, keyboard }) => {
        const mounted = await mount({ template: bold() });
        expect(mounted.state()).toEqual({
          isSelected: false,
          isPressed: false,
          isHovered: false,
          isFocused: false,
          isFocusVisible: false,
          isDisabled: false,
        });
        mounted.part().focus();
        await keyboard.press('Enter');
        expect(mounted.state()).toMatchObject({
          isSelected: true,
          isFocused: true,
        });
      },
      PHASE,
    );

    scenario(
      'uncontrolled toggling never re-renders the owner',
      async ({ mount, pointer, keyboard }) => {
        const mounted = await mount({ template: bold(), events: EVENTS });
        const root = mounted.part();
        const renders = mounted.renderCount();

        await pointer.click(root);
        await pointer.click(root);
        root.focus();
        await keyboard.press('Space');

        expect(requests(mounted)).toEqual([true, false, true]);
        expectSelected(mounted, true);
        expect(mounted.renderCount()).toBe(renders);
      },
      PHASE,
    );
  });

  group('spoken output', () => {
    scenario(
      'announces off as not pressed',
      async ({ mount, spoken }) => {
        await mount({ template: bold() });
        expect(await spoken()).toContain('button, Bold, not pressed');
      },
      PHASE,
    );

    scenario(
      'announces on as pressed',
      async ({ mount, spoken }) => {
        await mount({ template: bold(), props: { defaultSelected: true } });
        expect(await spoken()).toContain('button, Bold, pressed');
      },
      PHASE,
    );

    scenario(
      'announces a non-native root the same way',
      async ({ mount, spoken }) => {
        await mount({
          template: h('div', { part: 'root' }, 'Bold'),
          props: { elementType: 'div', defaultSelected: true },
        });
        expect(await spoken()).toContain('button, Bold, pressed');
      },
      PHASE,
    );

    scenario(
      'announces disabled before the pressed state',
      async ({ mount, spoken }) => {
        const mounted = await mount({
          template: bold(),
          props: { isDisabled: true },
        });
        expect(await spoken()).toContain('button, Bold, disabled, not pressed');
        await mounted.setProps({ isFocusableWhenDisabled: true });
        expect(await spoken()).toContain('button, Bold, disabled, not pressed');
      },
      PHASE,
    );

    scenario(
      'announces a disabled toggle that is on',
      async ({ mount, spoken }) => {
        await mount({
          template: bold(),
          props: { isDisabled: true, defaultSelected: true },
        });
        expect(await spoken()).toContain('button, Bold, disabled, pressed');
      },
      PHASE,
    );

    scenario(
      'reads the new state after a press',
      async ({ mount, pointer, spoken }) => {
        const mounted = await mount({ template: bold() });
        await pointer.click(mounted.part());
        expect(await spoken()).toContain('button, Bold, pressed');
      },
      PHASE,
    );
  });

  group('real screen readers', () => {
    scenario(
      'Tab reads the toggle button not pressed, and Space reads it pressed',
      async ({ mount, screenReader }) => {
        const heard = {
          voiceover: {
            button: /Bold toggle button/,
            pressed: /selected Bold toggle button/,
          },
          nvda: {
            button: /Bold, toggle button, not pressed/,
            pressed: /^pressed$/,
          },
        }[screenReader.name];
        const mounted = await mount({
          template: [
            h('input', { id: 'before', 'aria-label': 'Before' }),
            bold(),
          ],
        });
        await screenReader.startFrom(
          mounted.container.querySelector<HTMLElement>('#before')!,
        );
        await screenReader.press('Tab');
        expect.soft(await screenReader.spoken()).toMatch(heard.button);
        await screenReader.press('Space');
        expect.soft(await screenReader.spoken()).toMatch(heard.pressed);
      },
      { ...PHASE, needs: ['screenReader'] },
    );
  });
});
