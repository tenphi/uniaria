/**
 * Button conformance, from the spec approved by @tenphi on 2026-10-14
 * (`packages/core/src/components/button/spec.md`). Phase 1 covers attributes,
 * keyboard, mouse, disabled modes, link mode, public state, render counts and
 * spoken output. Phase 2 adds what the interaction layer brings: hover,
 * focus-visible, screen-reader (virtual) clicks, `touch-action` and touch:
 * touch presses, text-selection suppression, emulated mouse events after
 * touch, a touch that turns into a scroll and the long-press click
 * fallback. Touch scenarios need real touch input, which only Chromium
 * takes; elsewhere they are skipped. Nested pressables need a second
 * component and join with the first composite. Phase 3 adds `focusChange`,
 * from the gate 3 API review (@tenphi, 2026-10-16).
 */

import { defineConformance, h } from '@uniaria/testing';
import type { Mounted, TemplateAttrs } from '@uniaria/testing';
import { expect } from 'vitest';

import type { ButtonProps, ButtonState, PressEvent } from './types';

type MountedButton = Mounted<ButtonProps, ButtonState>;

const PRESS_EVENTS = ['pressStart', 'pressEnd', 'press'];

const STATE_ATTRIBUTES = [
  'data-pressed',
  'data-hovered',
  'data-focused',
  'data-focus-visible',
  'data-disabled',
];

const save = (attrs: TemplateAttrs = {}) =>
  h('button', { part: 'root', ...attrs }, 'Save');

const docs = (attrs: TemplateAttrs = {}) =>
  h('a', { part: 'root', ...attrs }, 'Docs');

function pressEvents(mounted: MountedButton, name = 'press'): PressEvent[] {
  return mounted.events
    .filter((event) => event.name === name)
    .map((event) => event.detail as PressEvent);
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Records whether each event of `type` reached the document prevented. */
function watchDefault(type: string, shouldPreventAfterwards = false) {
  const log: boolean[] = [];
  const listener = (event: Event) => {
    log.push(event.defaultPrevented);
    if (shouldPreventAfterwards) event.preventDefault();
  };
  document.addEventListener(type, listener);
  return {
    log,
    stop: () => document.removeEventListener(type, listener),
  };
}

export const buttonConformance = defineConformance<ButtonProps, ButtonState>(
  'button',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'renders a native button with the attributes UniAria owns',
        async ({ mount }) => {
          const root = (await mount({ template: save() })).part();
          expect(root.tagName).toBe('BUTTON');
          expect(root.getAttribute('type')).toBe('button');
          expect(root.getAttribute('tabindex')).toBe('0');
          expect(root.classList.contains('uni-button')).toBe(true);
          expect(root.hasAttribute('data-scope')).toBe(false);
          expect(root.hasAttribute('data-element')).toBe(false);
          for (const name of [
            'role',
            'disabled',
            'aria-disabled',
            ...STATE_ATTRIBUTES,
          ]) {
            expect(root.hasAttribute(name), name).toBe(false);
          }
        },
      );

      scenario('uses the type prop on native buttons', async ({ mount }) => {
        const mounted = await mount({
          template: save(),
          props: { type: 'submit' },
        });
        expect(mounted.part().getAttribute('type')).toBe('submit');
        await mounted.setProps({ type: 'reset' });
        expect(mounted.part().getAttribute('type')).toBe('reset');
      });

      scenario(
        'gives a non-native root a button role and a tabindex',
        async ({ mount }) => {
          const root = (
            await mount({
              template: h('div', { part: 'root' }, 'Save'),
              props: { elementType: 'div' },
            })
          ).part();
          expect(root.getAttribute('role')).toBe('button');
          expect(root.getAttribute('tabindex')).toBe('0');
          expect(root.hasAttribute('type')).toBe(false);
        },
      );

      scenario(
        'leaves consumer-owned attributes alone',
        async ({ mount, pointer, keyboard }) => {
          const consumer = {
            id: 'save',
            class: 'primary',
            'aria-label': 'Save draft',
            'aria-describedby': 'hint',
            name: 'action',
            value: 'save',
          };
          const mounted = await mount({
            template: [
              save(consumer),
              h('p', { id: 'hint' }, 'Saves without publishing'),
            ],
          });
          const root = mounted.part();
          root.focus();
          await keyboard.press('Enter');
          await pointer.click(root);
          const { class: classes, ...attributes } = consumer;
          for (const [name, value] of Object.entries(attributes)) {
            expect(root.getAttribute(name), name).toBe(value);
          }
          // UniAria adds only its own class beside the consumer's.
          expect([...root.classList].sort()).toEqual(
            [classes, 'uni-button'].sort(),
          );
          for (const name of [
            'aria-pressed',
            'aria-expanded',
            'aria-haspopup',
          ]) {
            expect(root.hasAttribute(name), name).toBe(false);
          }
        },
      );

      scenario(
        'takes the root out of the tab order with shouldExcludeFromTabOrder',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [
              save(),
              h('button', { id: 'after', tabindex: '0' }, 'After'),
            ],
            props: { shouldExcludeFromTabOrder: true },
          });
          expect(mounted.part().getAttribute('tabindex')).toBe('-1');
          await keyboard.tab();
          expect(document.activeElement?.id).toBe('after');
        },
      );
    });

    group('keyboard', () => {
      scenario(
        'Enter starts the press on keydown and presses on keyup',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          root.focus();

          await keyboard.down('Enter');
          expect(mounted.eventNames()).toEqual(['pressStart']);
          expect(root.hasAttribute('data-pressed')).toBe(true);
          expect(mounted.state().isPressed).toBe(true);

          await keyboard.up('Enter');
          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'press',
          ]);
          expect(root.hasAttribute('data-pressed')).toBe(false);
          expect(mounted.state().isPressed).toBe(false);

          const [press] = pressEvents(mounted);
          expect(press).toMatchObject({
            type: 'press',
            pointerType: 'keyboard',
            key: 'Enter',
          });
          expect(press!.target).toBe(root);
        },
      );

      scenario(
        'Space presses on keyup and does not scroll the page',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          root.focus();
          const keydown = watchDefault('keydown');

          await keyboard.down('Space');
          expect(mounted.eventNames()).toEqual(['pressStart']);
          expect(root.hasAttribute('data-pressed')).toBe(true);
          await keyboard.up('Space');
          keydown.stop();

          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'press',
          ]);
          expect(pressEvents(mounted)[0]).toMatchObject({
            pointerType: 'keyboard',
          });
          expect(keydown.log).toEqual([true]);
        },
      );

      scenario('ignores key repeats', async ({ mount, keyboard }) => {
        const mounted = await mount({ template: save(), events: PRESS_EVENTS });
        mounted.part().focus();
        await keyboard.down('Enter');
        await keyboard.down('Enter');
        await keyboard.down('Enter');
        await keyboard.up('Enter');
        expect(mounted.eventNames()).toEqual([
          'pressStart',
          'pressEnd',
          'press',
        ]);
      });

      scenario(
        'ends without pressing when focus moves away before keyup',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: [save(), h('button', { id: 'other' }, 'Other')],
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          root.focus();
          await keyboard.down('Enter');
          document.getElementById('other')!.focus();
          await keyboard.up('Enter');
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
          expect(root.hasAttribute('data-pressed')).toBe(false);
        },
      );

      scenario(
        'submits a form exactly once with Enter and with Space',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: h('form', null, save()),
            props: { type: 'submit' },
            events: ['press'],
          });
          const form = mounted.container.querySelector('form')!;
          let submits = 0;
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submits++;
          });
          mounted.part().focus();

          await keyboard.press('Enter');
          expect(submits).toBe(1);
          expect(mounted.eventNames()).toEqual(['press']);

          await keyboard.press('Space');
          expect(submits).toBe(2);
          expect(mounted.eventNames()).toEqual(['press', 'press']);
        },
      );
    });

    group('pointer', () => {
      scenario(
        'a mouse press starts on down and presses on release',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();

          await pointer.down(root);
          expect(mounted.eventNames()).toEqual(['pressStart']);
          expect(root.hasAttribute('data-pressed')).toBe(true);
          expect(mounted.state().isPressed).toBe(true);

          await pointer.up();
          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'press',
          ]);
          expect(root.hasAttribute('data-pressed')).toBe(false);

          const [press] = pressEvents(mounted);
          const box = root.getBoundingClientRect();
          expect(press).toMatchObject({ type: 'press', pointerType: 'mouse' });
          expect(press!.target).toBe(root);
          expect(press!.x).toBeGreaterThanOrEqual(0);
          expect(press!.x).toBeLessThanOrEqual(box.width);
          expect(press!.y).toBeGreaterThanOrEqual(0);
          expect(press!.y).toBeLessThanOrEqual(box.height);
        },
      );

      scenario(
        'leaving while pressed ends the press and coming back restarts it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();

          await pointer.down(root);
          await pointer.moveOutside(root);
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
          expect(root.hasAttribute('data-pressed')).toBe(false);
          expect(mounted.state().isPressed).toBe(false);

          await pointer.move(root);
          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'pressStart',
          ]);
          expect(root.hasAttribute('data-pressed')).toBe(true);

          await pointer.up();
          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'pressStart',
            'pressEnd',
            'press',
          ]);
        },
      );

      scenario(
        'releasing outside does not press',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          await pointer.down(root);
          await pointer.moveOutside(root);
          await pointer.up();
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
        },
      );

      scenario(
        'only the primary button presses',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          await pointer.click(mounted.part(), { button: 'middle' });
          await pointer.click(mounted.part(), { button: 'right' });
          expect(mounted.eventNames()).toEqual([]);
        },
      );

      scenario(
        'a pointer press focuses the root',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: save() });
          const root = mounted.part();
          await pointer.click(root);
          expect(document.activeElement).toBe(root);
          expect(root.hasAttribute('data-focused')).toBe(true);
        },
      );

      scenario(
        'shouldPreventFocusOnPress leaves focus where it was',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: [
              h('input', { id: 'draft', 'aria-label': 'Draft' }),
              save(),
            ],
            props: { shouldPreventFocusOnPress: true },
            events: ['press'],
          });
          const draft = document.getElementById('draft')!;
          draft.focus();
          await pointer.click(mounted.part());
          expect(document.activeElement).toBe(draft);
          expect(mounted.eventNames()).toEqual(['press']);
        },
      );
    });

    group('focus', () => {
      scenario(
        'Tab reaches the root and marks it focused',
        async ({ mount, keyboard }) => {
          const mounted = await mount({ template: save() });
          const root = mounted.part();
          await keyboard.tab();
          expect(document.activeElement).toBe(root);
          expect(root.hasAttribute('data-focused')).toBe(true);
          expect(mounted.state().isFocused).toBe(true);

          root.blur();
          expect(root.hasAttribute('data-focused')).toBe(false);
          expect(mounted.state().isFocused).toBe(false);
        },
      );

      scenario(
        'focus is visible after keyboard focus, not after a pointer press',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: [
              h('button', { id: 'before', tabindex: '0' }, 'Before'),
              save(),
            ],
          });
          const root = mounted.part();

          await pointer.click(root);
          expect(root.hasAttribute('data-focused')).toBe(true);
          expect(root.hasAttribute('data-focus-visible')).toBe(false);
          expect(mounted.state().isFocusVisible).toBe(false);

          await keyboard.tab({ isBackward: true });
          await keyboard.tab();
          expect(document.activeElement).toBe(root);
          expect(root.hasAttribute('data-focus-visible')).toBe(true);
          expect(mounted.state().isFocusVisible).toBe(true);
        },
        { phase: 2 },
      );

      scenario(
        'focusChange reports focus and blur once each',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: save(),
            events: ['focusChange', 'press'],
          });
          const root = mounted.part();
          await keyboard.tab();
          await keyboard.press('Enter');
          root.blur();
          expect(
            mounted.events
              .filter((event) => event.name === 'focusChange')
              .map((event) => event.detail),
          ).toEqual([true, false]);
        },
        { phase: 3 },
      );
    });

    group('disabled', () => {
      scenario(
        'native disabled: no presses, skipped by Tab',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: [
              save(),
              h('button', { id: 'after', tabindex: '0' }, 'After'),
            ],
            props: { isDisabled: true },
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          expect(root.hasAttribute('disabled')).toBe(true);
          expect(root.hasAttribute('data-disabled')).toBe(true);
          expect(root.hasAttribute('aria-disabled')).toBe(false);
          expect(mounted.state().isDisabled).toBe(true);

          await keyboard.tab();
          expect(document.activeElement?.id).toBe('after');
          await pointer.click(root);
          expect(mounted.eventNames()).toEqual([]);
        },
      );

      scenario(
        'non-native disabled: aria-disabled, not focusable, no presses',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: h('div', { part: 'root' }, 'Save'),
            props: { elementType: 'div', isDisabled: true },
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          expect(root.getAttribute('aria-disabled')).toBe('true');
          expect(root.hasAttribute('tabindex')).toBe(false);
          expect(root.hasAttribute('data-disabled')).toBe(true);

          root.focus();
          expect(document.activeElement).not.toBe(root);
          await pointer.click(root);
          expect(mounted.eventNames()).toEqual([]);
        },
      );

      scenario(
        'isFocusableWhenDisabled keeps focus and blocks presses and submission',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: h('form', null, save()),
            props: {
              type: 'submit',
              isDisabled: true,
              isFocusableWhenDisabled: true,
            },
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          const form = mounted.container.querySelector('form')!;
          let submits = 0;
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submits++;
          });

          expect(root.getAttribute('aria-disabled')).toBe('true');
          expect(root.getAttribute('tabindex')).toBe('0');
          expect(root.hasAttribute('disabled')).toBe(false);
          expect(root.hasAttribute('data-disabled')).toBe(true);

          await keyboard.tab();
          expect(document.activeElement).toBe(root);
          await keyboard.press('Enter');
          await keyboard.press('Space');
          await pointer.click(root);

          expect(mounted.eventNames()).toEqual([]);
          expect(submits).toBe(0);
          expect(document.activeElement).toBe(root);
        },
      );

      scenario(
        'becoming disabled mid-press cancels the press',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          await pointer.down(root);
          await mounted.setProps({ isDisabled: true });
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
          expect(root.hasAttribute('data-pressed')).toBe(false);
          await pointer.up();
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
        },
      );

      scenario(
        're-enabling removes aria-disabled instead of writing "false"',
        async ({ mount }) => {
          const mounted = await mount({
            template: save(),
            props: { isDisabled: true, isFocusableWhenDisabled: true },
          });
          await mounted.setProps({ isDisabled: false });
          const root = mounted.part();
          expect(root.hasAttribute('aria-disabled')).toBe(false);
          expect(root.hasAttribute('data-disabled')).toBe(false);
          expect(mounted.state().isDisabled).toBe(false);
        },
      );
    });

    group('link mode', () => {
      scenario(
        'renders a link with href and no button role',
        async ({ mount }) => {
          const root = (
            await mount({ template: docs(), props: { href: '/docs' } })
          ).part();
          expect(root.getAttribute('href')).toBe('/docs');
          expect(root.getAttribute('tabindex')).toBe('0');
          expect(root.classList.contains('uni-button')).toBe(true);
          for (const name of [
            'role',
            'type',
            'aria-disabled',
            'data-disabled',
          ]) {
            expect(root.hasAttribute(name), name).toBe(false);
          }
        },
      );

      scenario(
        'a disabled link drops href and keeps link semantics',
        async ({ mount }) => {
          const mounted = await mount({
            template: docs(),
            props: { href: '/docs', isDisabled: true },
          });
          const root = mounted.part();
          expect(root.hasAttribute('href')).toBe(false);
          expect(root.getAttribute('role')).toBe('link');
          expect(root.getAttribute('aria-disabled')).toBe('true');
          expect(root.hasAttribute('data-disabled')).toBe(true);
          expect(root.hasAttribute('tabindex')).toBe(false);

          await mounted.setProps({ isDisabled: false });
          expect(root.getAttribute('href')).toBe('/docs');
          expect(root.hasAttribute('role')).toBe(false);
          expect(root.hasAttribute('aria-disabled')).toBe(false);
        },
      );

      scenario(
        'a disabled link stays focusable with isFocusableWhenDisabled',
        async ({ mount }) => {
          const root = (
            await mount({
              template: docs(),
              props: {
                href: '/docs',
                isDisabled: true,
                isFocusableWhenDisabled: true,
              },
            })
          ).part();
          expect(root.hasAttribute('href')).toBe(false);
          expect(root.getAttribute('tabindex')).toBe('0');
          expect(root.getAttribute('aria-disabled')).toBe('true');
        },
      );

      scenario(
        'Enter presses and navigates natively; Space does nothing',
        async ({ mount, keyboard }) => {
          const mounted = await mount({
            template: docs(),
            props: { href: '#uni-docs' },
            events: ['press'],
          });
          // Records whether UniAria prevented the link's click, then stops the
          // navigation itself so the test page stays put.
          const click = watchDefault('click', true);
          mounted.part().focus();

          await keyboard.press('Enter');
          expect(mounted.eventNames()).toEqual(['press']);
          expect(click.log).toEqual([false]);

          await keyboard.press('Space');
          click.stop();
          expect(mounted.eventNames()).toEqual(['press']);
          expect(click.log).toEqual([false]);
        },
      );

      scenario(
        'a mouse click presses without preventing navigation',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: docs(),
            props: { href: '#uni-docs' },
            events: ['press'],
          });
          const click = watchDefault('click', true);
          await pointer.click(mounted.part());
          click.stop();
          expect(mounted.eventNames()).toEqual(['press']);
          expect(click.log).toEqual([false]);
        },
      );
    });

    group('state and renders', () => {
      scenario(
        'public state follows focus, presses and props',
        async ({ mount, keyboard }) => {
          const mounted = await mount({ template: save() });
          expect(mounted.state()).toEqual({
            isPressed: false,
            isHovered: false,
            isFocused: false,
            isFocusVisible: false,
            isDisabled: false,
          });
          mounted.part().focus();
          expect(mounted.state().isFocused).toBe(true);
          await keyboard.down('Enter');
          expect(mounted.state().isPressed).toBe(true);
          await keyboard.up('Enter');
          expect(mounted.state().isPressed).toBe(false);
          await mounted.setProps({ isDisabled: true });
          expect(mounted.state().isDisabled).toBe(true);
        },
      );

      scenario(
        'internal interactions never re-render the owner',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          const renders = mounted.renderCount();

          await keyboard.tab();
          await keyboard.down('Enter');
          await keyboard.up('Enter');
          await pointer.down(root);
          await pointer.moveOutside(root);
          await pointer.move(root);
          await pointer.up();
          root.blur();

          expect(mounted.eventNames()).toContain('press');
          expect(mounted.renderCount()).toBe(renders);
        },
      );
    });

    group('spoken output', () => {
      scenario('announces a native button', async ({ mount, spoken }) => {
        await mount({ template: save() });
        expect(await spoken()).toContain('button, Save');
      });

      scenario('announces a non-native button', async ({ mount, spoken }) => {
        await mount({
          template: h('div', { part: 'root' }, 'Save'),
          props: { elementType: 'div' },
        });
        expect(await spoken()).toContain('button, Save');
      });

      scenario(
        'announces a natively disabled button as disabled',
        async ({ mount, spoken }) => {
          await mount({ template: save(), props: { isDisabled: true } });
          expect(await spoken()).toContain('button, Save, disabled');
        },
      );

      scenario(
        'announces a disabled non-native button as disabled',
        async ({ mount, spoken }) => {
          await mount({
            template: h('div', { part: 'root' }, 'Save'),
            props: { elementType: 'div', isDisabled: true },
          });
          expect(await spoken()).toContain('button, Save, disabled');
        },
      );

      scenario(
        'announces isFocusableWhenDisabled as disabled',
        async ({ mount, spoken }) => {
          await mount({
            template: save(),
            props: { isDisabled: true, isFocusableWhenDisabled: true },
          });
          expect(await spoken()).toContain('button, Save, disabled');
        },
      );

      scenario(
        'never announces "not disabled" after re-enabling',
        async ({ mount, spoken }) => {
          const mounted = await mount({
            template: save(),
            props: { isDisabled: true, isFocusableWhenDisabled: true },
          });
          await mounted.setProps({ isDisabled: false });
          const phrases = await spoken();
          expect(phrases).toContain('button, Save');
          expect(
            phrases.some((phrase) => phrase.includes('not disabled')),
          ).toBe(false);
        },
      );

      scenario('announces link mode as a link', async ({ mount, spoken }) => {
        await mount({ template: docs(), props: { href: '/docs' } });
        expect(await spoken()).toContain('link, Docs');
      });

      scenario(
        'announces a disabled link as a disabled link',
        async ({ mount, spoken }) => {
          await mount({
            template: docs(),
            props: { href: '/docs', isDisabled: true },
          });
          expect(await spoken()).toContain('link, Docs, disabled');
        },
      );
    });

    group('interaction layer', () => {
      scenario(
        'a screen-reader click presses with pointerType virtual',
        async ({ mount }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          mounted.part().click();
          expect(mounted.eventNames()).toEqual([
            'pressStart',
            'pressEnd',
            'press',
          ]);
          for (const name of PRESS_EVENTS) {
            expect(pressEvents(mounted, name)[0]).toMatchObject({
              pointerType: 'virtual',
            });
          }
        },
        { phase: 2 },
      );

      scenario(
        'hover follows the mouse and never starts while disabled',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: save() });
          const root = mounted.part();

          await pointer.move(root);
          expect(root.hasAttribute('data-hovered')).toBe(true);
          expect(mounted.state().isHovered).toBe(true);
          await pointer.moveOutside(root);
          expect(root.hasAttribute('data-hovered')).toBe(false);
          expect(mounted.state().isHovered).toBe(false);

          await mounted.setProps({ isDisabled: true });
          await pointer.move(root);
          expect(root.hasAttribute('data-hovered')).toBe(false);
          expect(mounted.state().isHovered).toBe(false);
        },
        { phase: 2 },
      );

      // The pointer crosses straight from one element to the other. React
      // reports that leave and enter from one `pointerout`, whose target is
      // the element left (found by the React Aria comparison, 2026-10-15).
      scenario(
        'hover follows the mouse straight between the root and a neighbour',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: [save(), h('button', { id: 'next' }, 'Next')],
          });
          const root = mounted.part();
          const next = mounted.container.querySelector('#next')!;

          for (const target of [root, next, root, next]) {
            await pointer.move(target);
            expect(root.hasAttribute('data-hovered')).toBe(target === root);
            expect(mounted.state().isHovered).toBe(target === root);
          }
        },
        { phase: 2 },
      );

      scenario(
        'pressable roots get touch-action: pan-x pan-y pinch-zoom',
        async ({ mount }) => {
          const root = (await mount({ template: save() })).part();
          // The two values are equivalent, and Chromium serializes this one as
          // `manipulation`. WebKit must get the explicit form: the keyword
          // breaks Safari's pointercancel on scroll.
          const isWebKit =
            /AppleWebKit/.test(navigator.userAgent) &&
            !/Chrome|Chromium/.test(navigator.userAgent);
          const accepted = isWebKit
            ? ['pan-x pan-y pinch-zoom']
            : ['pan-x pan-y pinch-zoom', 'manipulation'];
          expect(accepted).toContain(getComputedStyle(root).touchAction);
        },
        { phase: 2 },
      );
    });

    group('touch', () => {
      const TOUCH = { phase: 2, needs: ['touch'] } as const;

      scenario(
        'a tap presses with pointerType touch, pressed while the finger is down',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();

          await touch.down(root);
          expect(mounted.eventNames()).toEqual(['pressStart']);
          expect(root.hasAttribute('data-pressed')).toBe(true);
          expect(mounted.state().isPressed).toBe(true);

          await touch.up();
          // The click that activates follows the finger lifting.
          await expect
            .poll(() => mounted.eventNames())
            .toEqual(['pressStart', 'pressEnd', 'press']);
          expect(root.hasAttribute('data-pressed')).toBe(false);
          expect(mounted.state().isPressed).toBe(false);
          for (const name of PRESS_EVENTS) {
            expect(pressEvents(mounted, name)[0]).toMatchObject({
              pointerType: 'touch',
            });
          }
          expect(document.activeElement).toBe(root);
          expect(root.hasAttribute('data-focus-visible')).toBe(false);
        },
        TOUCH,
      );

      scenario(
        'a touch press turns off text selection on the root until it ends',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: h('div', { part: 'root' }, 'Save'),
            events: ['press'],
          });
          const root = mounted.part();
          const userSelect = () => getComputedStyle(root).userSelect;
          const before = userSelect();
          expect(before).not.toBe('none');

          await touch.down(root);
          expect(userSelect()).toBe('none');
          await touch.up();
          await expect.poll(() => mounted.eventNames()).toEqual(['press']);
          expect(userSelect()).toBe(before);
        },
        TOUCH,
      );

      scenario(
        "a tap's emulated mouse events neither hover nor press again",
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();

          await touch.tap(root);
          await expect
            .poll(() => mounted.eventNames())
            .toEqual(['pressStart', 'pressEnd', 'press']);
          await wait(100);
          expect(mounted.eventNames()).toHaveLength(3);
          expect(root.hasAttribute('data-hovered')).toBe(false);
          expect(mounted.state().isHovered).toBe(false);
        },
        TOUCH,
      );

      scenario(
        'a mouse entering within 500 ms of a touch does not hover',
        async ({ mount, pointer, touch }) => {
          const mounted = await mount({ template: save() });
          const root = mounted.part();
          await pointer.moveOutside(root);

          // iOS emulates a mouse enter after a tap.
          await touch.tap(root);
          await pointer.move(root);
          expect(root.hasAttribute('data-hovered')).toBe(false);
          expect(mounted.state().isHovered).toBe(false);

          await wait(600);
          await pointer.moveOutside(root);
          await pointer.move(root);
          expect(root.hasAttribute('data-hovered')).toBe(true);
        },
        TOUCH,
      );

      scenario(
        'a touch that turns into a scroll ends the press without pressing',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();

          await touch.down(root);
          await touch.moveOutside(root);
          await expect
            .poll(() => mounted.eventNames())
            .toEqual(['pressStart', 'pressEnd']);
          expect(root.hasAttribute('data-pressed')).toBe(false);

          await touch.up();
          await wait(150);
          expect(mounted.eventNames()).toEqual(['pressStart', 'pressEnd']);
        },
        TOUCH,
      );

      scenario(
        'a long press whose click never comes still presses, once',
        async ({ mount, touch }) => {
          const mounted = await mount({
            template: save(),
            events: PRESS_EVENTS,
          });
          const root = mounted.part();
          // iOS and Android send no click after a long press. Desktop
          // Chromium does, so drop the browser's own click here.
          const dropClick = (event: MouseEvent) => {
            if (!event.isTrusted) return;
            event.stopImmediatePropagation();
            event.preventDefault();
          };
          window.addEventListener('click', dropClick, true);
          try {
            await touch.down(root);
            await wait(600);
            await touch.up();
            await expect
              .poll(() => mounted.eventNames())
              .toEqual(['pressStart', 'pressEnd', 'press']);
            await wait(150);
            expect(pressEvents(mounted)).toHaveLength(1);
            expect(pressEvents(mounted)[0]).toMatchObject({
              pointerType: 'touch',
            });
          } finally {
            window.removeEventListener('click', dropClick, true);
          }
        },
        TOUCH,
      );
    });

    group('real screen readers', () => {
      scenario(
        'Tab reads the button by its name and role',
        async ({ mount, screenReader }) => {
          const heard = {
            voiceover: { button: /Save button/ },
            nvda: { button: /Save, button/ },
          }[screenReader.name];
          const mounted = await mount({
            template: [
              h('input', { id: 'before', 'aria-label': 'Before' }),
              save(),
            ],
          });
          await screenReader.startFrom(
            mounted.container.querySelector<HTMLElement>('#before')!,
          );
          await screenReader.press('Tab');
          const entered = await screenReader.spoken();
          expect.soft(entered).toMatch(heard.button);
          // Listeners a custom element delegates from its host must not make the
          // button read as clickable.
          expect.soft(entered).not.toMatch(/clickable/);
        },
        { needs: ['screenReader'] },
      );
    });
  },
);
