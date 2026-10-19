/**
 * Dialog conformance, from the spec approved by @tenphi on 2026-10-16
 * (`packages/core/src/components/dialog/spec.md`): a native `<dialog>` opened
 * with `showModal()` by its trigger, its anatomy and ARIA, initial focus,
 * Escape, backdrop presses and the close part, a controlled dialog refusing
 * to close, Tab wrapping, focus restore, scroll lock, inertness, the closing
 * phase for exit animations, `<form method="dialog">`, closes the browser
 * makes itself, nested dialogs, public state, render counts and spoken
 * output. Phase 4.
 *
 * Not here: removing an open `<dialog>` from the page (a template can't
 * remove a part; the element tests cover it) and the live announcer moving
 * into an open dialog (nothing a scenario can do announces; the announcer's
 * own tests cover it).
 */

import { defineConformance, h, nested } from '@uniaria/testing';
import type { Mounted, TemplateElement, TemplateNode } from '@uniaria/testing';
import { expect } from 'vitest';

import type { DialogDismissEvent, DialogProps, DialogState } from './types';

type MountedDialog = Mounted<DialogProps, DialogState>;

const PHASE = { phase: 4 } as const;

const PARTS = ['trigger', 'root', 'title', 'description', 'close'];

const EVENTS = ['openChange', 'dismiss'];

/** An exit animation long enough to see the closing phase. */
const EXIT = 400;

interface ConfirmOptions {
  readonly hasTrigger?: boolean;
  readonly hasTitle?: boolean;
  readonly hasDescription?: boolean;
  /** Content between the description and the close button. */
  readonly content?: readonly TemplateNode[];
  /** Markup before the page content, such as a stylesheet. */
  readonly head?: readonly TemplateNode[];
}

/**
 * The page and a dialog "Delete file", described by "This can't be undone.",
 * with a Cancel close button. `#page` sits at the top of the page, outside
 * the centred dialog, so a press on it lands on the backdrop. `#before` and
 * `#after` are text fields, which WebKit's Tab reaches.
 */
function confirm({
  hasTrigger = true,
  hasTitle = true,
  hasDescription = true,
  content = [],
  head = [],
}: ConfirmOptions = {}): TemplateNode[] {
  return [
    ...head,
    h('p', { id: 'page' }, 'Page'),
    h('input', { id: 'before', 'aria-label': 'Before' }),
    ...(hasTrigger ? [h('button', { part: 'trigger' }, 'Delete file')] : []),
    h(
      'dialog',
      { part: 'root' },
      ...(hasTitle ? [h('h2', { part: 'title' }, 'Delete file')] : []),
      ...(hasDescription
        ? [h('p', { part: 'description' }, "This can't be undone.")]
        : []),
      ...content,
      h('button', { part: 'close' }, 'Cancel'),
    ),
    h('input', { id: 'after', 'aria-label': 'After' }),
  ];
}

/** Two text fields, for Tab inside the dialog. */
const FIELDS: TemplateElement[] = [
  h('input', { id: 'name', 'aria-label': 'Name' }),
  h('input', { id: 'email', 'aria-label': 'Email' }),
];

/** A form that closes the dialog, with a Delete submit button. */
const FORM: TemplateElement = h(
  'form',
  { method: 'dialog' },
  h('input', { id: 'reason', 'aria-label': 'Reason' }),
  h('button', { id: 'delete', value: 'delete' }, 'Delete'),
);

/** A stylesheet that animates `selector` while the dialog exits. */
function exitAnimation(selector: string): TemplateElement {
  return h(
    'style',
    null,
    `@keyframes uni-conformance-fade { to { opacity: 0 } }
     ${selector} { animation: uni-conformance-fade ${EXIT}ms linear forwards }`,
  );
}

function byId(mounted: MountedDialog, id: string): HTMLElement {
  return mounted.container.querySelector<HTMLElement>(`#${id}`)!;
}

function root(mounted: MountedDialog): HTMLDialogElement {
  return mounted.part('root') as HTMLDialogElement;
}

const isModal = (dialog: Element) => dialog.matches(':modal');

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until the dialog has finished closing. */
async function closed(dialog: HTMLDialogElement): Promise<void> {
  await expect.poll(() => dialog.open).toBe(false);
}

/** The `dismiss` details so far, in order. */
function dismissals(mounted: MountedDialog): DialogDismissEvent[] {
  return mounted.events
    .filter((event) => event.name === 'dismiss')
    .map((event) => event.detail as DialogDismissEvent);
}

/** The `openChange` details so far, in order. */
function openChanges(mounted: MountedDialog): unknown[] {
  return mounted.events
    .filter((event) => event.name === 'openChange')
    .map((event) => event.detail);
}

function activeElement(mounted: MountedDialog): Element | null {
  return mounted.container.ownerDocument.activeElement;
}

/** A state attribute is on every part, or on none. */
function expectOnEveryPart(
  mounted: MountedDialog,
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

/** Records which parts an attribute was ever added to, until `stop()`. */
function watchAttribute(
  mounted: MountedDialog,
  attribute: string,
): { readonly parts: Set<string>; stop(): void } {
  const parts = new Set<string>();
  const view = mounted.container.ownerDocument.defaultView!;
  const observer = new view.MutationObserver((records) => {
    for (const record of records) {
      const element = record.target as Element;
      if (element.hasAttribute(attribute)) {
        parts.add(element.getAttribute('data-part') ?? '');
      }
    }
  });
  observer.observe(mounted.container, {
    attributes: true,
    attributeFilter: [attribute],
    subtree: true,
  });
  return { parts, stop: () => observer.disconnect() };
}

function isPageScrollLocked(mounted: MountedDialog): boolean {
  const { documentElement } = mounted.container.ownerDocument;
  return getComputedStyle(documentElement).overflow === 'hidden';
}

export const dialogConformance = defineConformance<DialogProps, DialogState>(
  'dialog',
  ({ scenario, group }) => {
    group('anatomy', () => {
      scenario(
        'a closed native dialog named by its title and described by its description',
        async ({ mount }) => {
          const mounted = await mount({ template: confirm() });
          const dialog = root(mounted);
          expect(dialog.localName).toBe('dialog');
          expect(dialog.open).toBe(false);
          expect(dialog.hasAttribute('open')).toBe(false);
          expect(dialog.getAttribute('tabindex')).toBe('-1');
          expect(dialog.hasAttribute('role')).toBe(false);
          expect(dialog.hasAttribute('aria-modal')).toBe(false);
          expect(dialog.id).not.toBe('');
          const title = mounted.part('title');
          const description = mounted.part('description');
          expect(title.id).not.toBe('');
          expect(description.id).not.toBe('');
          expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
          expect(dialog.getAttribute('aria-describedby')).toBe(description.id);

          const trigger = mounted.part('trigger');
          expect(trigger.getAttribute('type')).toBe('button');
          for (const name of [
            'aria-haspopup',
            'aria-expanded',
            'aria-controls',
          ]) {
            expect(trigger.hasAttribute(name), name).toBe(false);
          }
          expect(mounted.part('close').getAttribute('type')).toBe('button');
          for (const attribute of [
            'data-open',
            'data-entering',
            'data-exiting',
          ]) {
            expectOnEveryPart(mounted, attribute, false);
          }
          expect(mounted.state()).toEqual({
            isOpen: false,
            isEntering: false,
            isExiting: false,
          });
        },
        PHASE,
      );

      scenario(
        'references only rendered parts, plus labelledBy and describedBy',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm({ hasDescription: false }),
          });
          const dialog = root(mounted);
          expect(dialog.hasAttribute('aria-describedby')).toBe(false);

          await mounted.setProps({
            labelledBy: 'extra-label',
            describedBy: 'extra-description',
          });
          expect(dialog.getAttribute('aria-labelledby')).toBe(
            `${mounted.part('title').id} extra-label`,
          );
          expect(dialog.getAttribute('aria-describedby')).toBe(
            'extra-description',
          );

          const untitled = await mount({
            template: confirm({ hasTitle: false }),
            props: { labelledBy: 'extra-label' },
          });
          expect(root(untitled).getAttribute('aria-labelledby')).toBe(
            'extra-label',
          );
        },
        PHASE,
      );

      scenario(
        'role alertdialog is written on the dialog',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm(),
            props: { role: 'alertdialog' },
          });
          expect(root(mounted).getAttribute('role')).toBe('alertdialog');
          await mounted.setProps({ role: 'dialog' });
          expect(root(mounted).hasAttribute('role')).toBe(false);
        },
        PHASE,
      );
    });

    group('opening', () => {
      scenario(
        'a click on the trigger opens it modally, reports it and focuses the dialog',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const dialog = root(mounted);
          const entering = watchAttribute(mounted, 'data-entering');

          await pointer.click(mounted.part('trigger'));
          expect(isModal(dialog)).toBe(true);
          expect(dialog.hasAttribute('open')).toBe(true);
          expect(activeElement(mounted)).toBe(dialog);
          expect(openChanges(mounted)).toEqual([true]);
          expect(dismissals(mounted)).toEqual([]);
          expect(mounted.state().isOpen).toBe(true);
          expectOnEveryPart(mounted, 'data-open', true);

          // Entering for the first frames only, on every part.
          await expect
            .poll(() => dialog.hasAttribute('data-entering'))
            .toBe(false);
          entering.stop();
          expect([...entering.parts].sort()).toEqual([...PARTS].sort());
          expectOnEveryPart(mounted, 'data-entering', false);
          expect(mounted.state()).toEqual({
            isOpen: true,
            isEntering: false,
            isExiting: false,
          });
        },
        PHASE,
      );

      scenario(
        'Enter and Space on the trigger open it',
        async ({ mount, keyboard }) => {
          for (const key of ['Enter', 'Space']) {
            const mounted = await mount({
              template: confirm(),
              events: EVENTS,
            });
            mounted.part('trigger').focus();
            await keyboard.press(key);
            expect(isModal(root(mounted)), key).toBe(true);
            expect(openChanges(mounted), key).toEqual([true]);
            await keyboard.press('Escape');
            await closed(root(mounted));
          }
        },
        PHASE,
      );

      scenario(
        'focuses the first element marked data-autofocus instead of the dialog',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm({
              content: [
                h('input', { id: 'name', 'aria-label': 'Name' }),
                h('button', { id: 'delete', 'data-autofocus': '' }, 'Delete'),
              ],
            }),
          });
          await pointer.click(mounted.part('trigger'));
          expect(activeElement(mounted)).toBe(byId(mounted, 'delete'));
        },
        PHASE,
      );

      scenario(
        'defaultOpen opens it modally on mount without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm(),
            props: { defaultOpen: true },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);
          expect(activeElement(mounted)).toBe(dialog);
          expectOnEveryPart(mounted, 'data-open', true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a disabled trigger does not open it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isDisabled: true },
            events: EVENTS,
          });
          const trigger = mounted.part('trigger');
          expect(trigger.hasAttribute('disabled')).toBe(true);
          expect(trigger.hasAttribute('data-disabled')).toBe(true);
          await pointer.click(trigger);
          expect(root(mounted).open).toBe(false);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );
    });

    group('Escape', () => {
      scenario(
        'closes it with reason escape, reporting dismiss before openChange',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await keyboard.press('Escape');
          expect(mounted.eventNames()).toEqual(['dismiss', 'openChange']);
          expect(dismissals(mounted)).toEqual([
            { reason: 'escape', returnValue: '' },
          ]);
          expect(openChanges(mounted)).toEqual([false]);
          expect(mounted.state().isOpen).toBe(false);
          expectOnEveryPart(mounted, 'data-open', false);
          await closed(dialog);
          expect(isModal(dialog)).toBe(false);
        },
        PHASE,
      );

      scenario(
        'neither UniAria nor the browser closes it when it is not dismissable',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isDismissable: false },
            events: EVENTS,
          });
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          // Twice: Chromium lets a page refuse a second close request only
          // after new user activation, which Escape isn't.
          await keyboard.press('Escape');
          await keyboard.press('Escape');
          await pause(100);
          expect(isModal(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'with keyboard dismiss disabled, Escape leaves it open and the backdrop still closes it',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isKeyboardDismissDisabled: true },
            events: EVENTS,
          });
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await keyboard.press('Escape');
          await pause(100);
          expect(isModal(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);

          await pointer.click(byId(mounted, 'page'));
          expect(dismissals(mounted)).toEqual([
            { reason: 'outside', returnValue: '' },
          ]);
        },
        PHASE,
      );

      scenario(
        'an Escape a widget inside prevents leaves the dialog open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({ content: FIELDS }),
            events: EVENTS,
          });
          await pointer.click(mounted.part('trigger'));
          const name = byId(mounted, 'name');
          name.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') event.preventDefault();
          });
          name.focus();
          mounted.clearEvents();

          await keyboard.press('Escape');
          await pause(100);
          expect(isModal(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a close request without a key, as Android back sends, counts as Escape',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const dialog = root(mounted) as HTMLDialogElement & {
            requestClose?: () => void;
          };
          // Baseline 2025: not in every engine this suite may run in.
          if (typeof dialog.requestClose !== 'function') return;
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await mounted.setProps({ isDismissable: false });
          dialog.requestClose();
          await pause(100);
          expect(isModal(dialog)).toBe(true);
          expect(mounted.events).toEqual([]);

          await mounted.setProps({ isDismissable: true });
          dialog.requestClose();
          expect(dismissals(mounted)).toEqual([
            { reason: 'escape', returnValue: '' },
          ]);
          await closed(dialog);
        },
        PHASE,
      );
    });

    group('pointer', () => {
      scenario(
        'a press on the backdrop closes it with reason outside; a press inside does not',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(mounted.part('title'));
          await pointer.click(mounted.part('description'));
          expect(mounted.events).toEqual([]);
          expect(isModal(dialog)).toBe(true);

          await pointer.click(byId(mounted, 'page'));
          expect(mounted.eventNames()).toEqual(['dismiss', 'openChange']);
          expect(dismissals(mounted)).toEqual([
            { reason: 'outside', returnValue: '' },
          ]);
          await closed(dialog);
        },
        PHASE,
      );

      scenario(
        'a press on the backdrop does nothing when it is not dismissable',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isDismissable: false },
            events: EVENTS,
          });
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(byId(mounted, 'page'));
          await pause(100);
          expect(isModal(root(mounted))).toBe(true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'the close part closes it with reason close, even when not dismissable',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isDismissable: false },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(mounted.part('close'));
          expect(dismissals(mounted)).toEqual([
            { reason: 'close', returnValue: '' },
          ]);
          expect(openChanges(mounted)).toEqual([false]);
          await closed(dialog);

          // From the keyboard too.
          mounted.part('trigger').focus();
          await keyboard.press('Enter');
          mounted.part('close').focus();
          await keyboard.press('Enter');
          expect(dismissals(mounted).map((detail) => detail.reason)).toEqual([
            'close',
            'close',
          ]);
          await closed(dialog);
        },
        PHASE,
      );
    });

    group('controlled', () => {
      scenario(
        'isOpen opens and closes it without reporting a change',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);

          await mounted.setProps({ isOpen: false });
          await closed(dialog);
          await mounted.setProps({ isOpen: true });
          expect(isModal(dialog)).toBe(true);
          expect(mounted.events).toEqual([]);
        },
        PHASE,
      );

      scenario(
        'a dismissal only reports; the dialog stays open until the consumer closes it',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);

          await keyboard.press('Escape');
          await pointer.click(byId(mounted, 'page'));
          await pointer.click(mounted.part('close'));
          await pause(100);
          expect(isModal(dialog)).toBe(true);
          expect(dismissals(mounted).map((detail) => detail.reason)).toEqual([
            'escape',
            'outside',
            'close',
          ]);
          expect(openChanges(mounted)).toEqual([false, false, false]);
          expect(mounted.state().isOpen).toBe(true);

          await mounted.setProps({ isOpen: false });
          await closed(dialog);
        },
        PHASE,
      );
    });

    group('focus', () => {
      scenario(
        'Tab and Shift+Tab wrap inside the dialog and never reach the page',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({ content: FIELDS }),
          });
          await pointer.click(mounted.part('trigger'));
          const name = byId(mounted, 'name');
          const email = byId(mounted, 'email');
          const close = mounted.part('close');

          await keyboard.tab();
          expect(activeElement(mounted)).toBe(name);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(email);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(close);
          await keyboard.tab();
          expect(activeElement(mounted)).toBe(name);
          await keyboard.tab({ isBackward: true });
          expect(activeElement(mounted)).toBe(close);
        },
        PHASE,
      );

      scenario(
        'the page is inert while it is open',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: confirm() });
          await pointer.click(mounted.part('trigger'));
          const before = byId(mounted, 'before');
          before.focus();
          expect(activeElement(mounted)).not.toBe(before);
          expect(activeElement(mounted)).toBe(root(mounted));
        },
        PHASE,
      );

      scenario(
        'focus returns to the trigger after a keyboard or mouse open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: confirm() });
          const trigger = mounted.part('trigger');
          const dialog = root(mounted);

          trigger.focus();
          await keyboard.press('Enter');
          await keyboard.press('Escape');
          await closed(dialog);
          expect(activeElement(mounted)).toBe(trigger);

          // WebKit's own restore would land on the body: a click doesn't
          // focus a button on macOS.
          trigger.blur();
          await pointer.click(trigger);
          await pointer.click(mounted.part('close'));
          await closed(dialog);
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'without a trigger, focus returns to the element focused before it opened',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm({ hasTrigger: false }),
          });
          const after = byId(mounted, 'after');
          after.focus();
          await mounted.setProps({ isOpen: true });
          expect(activeElement(mounted)).toBe(root(mounted));
          await mounted.setProps({ isOpen: false });
          await closed(root(mounted));
          expect(activeElement(mounted)).toBe(after);
        },
        PHASE,
      );

      scenario(
        'with a trigger, focus returns to it even when the dialog opened from elsewhere',
        async ({ mount }) => {
          const mounted = await mount({ template: confirm() });
          byId(mounted, 'after').focus();
          await mounted.setProps({ isOpen: true });
          await mounted.setProps({ isOpen: false });
          await closed(root(mounted));
          expect(activeElement(mounted)).toBe(mounted.part('trigger'));
        },
        PHASE,
      );

      scenario(
        'shouldRestoreFocus false leaves focus where the browser puts it',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm(),
            props: { shouldRestoreFocus: false },
          });
          byId(mounted, 'after').focus();
          await mounted.setProps({ isOpen: true });
          await mounted.setProps({ isOpen: false });
          await closed(root(mounted));
          expect(activeElement(mounted)).not.toBe(mounted.part('trigger'));
        },
        PHASE,
      );

      scenario(
        "focus the consumer moves in the dialog's close event stays there",
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: confirm() });
          const dialog = root(mounted);
          const after = byId(mounted, 'after');
          dialog.addEventListener('close', () => after.focus());
          await pointer.click(mounted.part('trigger'));
          await keyboard.press('Escape');
          await closed(dialog);
          await expect.poll(() => activeElement(mounted)).toBe(after);
        },
        PHASE,
      );
    });

    group('page', () => {
      scenario(
        'locks page scroll while open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: confirm() });
          expect(isPageScrollLocked(mounted)).toBe(false);
          await pointer.click(mounted.part('trigger'));
          expect(isPageScrollLocked(mounted)).toBe(true);
          await keyboard.press('Escape');
          await closed(root(mounted));
          expect(isPageScrollLocked(mounted)).toBe(false);
        },
        PHASE,
      );
    });

    group('closing phase', () => {
      scenario(
        'stays modal and exiting until its exit animation ends, then restores focus',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({
              head: [exitAnimation('dialog[data-exiting]')],
            }),
            events: EVENTS,
          });
          const dialog = root(mounted);
          const trigger = mounted.part('trigger');
          await pointer.click(trigger);
          mounted.clearEvents();

          await keyboard.press('Escape');
          expect(isModal(dialog)).toBe(true);
          expect(isPageScrollLocked(mounted)).toBe(true);
          expectOnEveryPart(mounted, 'data-exiting', true);
          expectOnEveryPart(mounted, 'data-open', false);
          expect(mounted.state()).toEqual({
            isOpen: false,
            isEntering: false,
            isExiting: true,
          });

          // Escape and the backdrop do nothing more while it exits.
          await keyboard.press('Escape');
          await pointer.click(byId(mounted, 'page'));
          expect(mounted.eventNames()).toEqual(['dismiss', 'openChange']);

          await closed(dialog);
          expectOnEveryPart(mounted, 'data-exiting', false);
          expect(mounted.state().isExiting).toBe(false);
          expect(isPageScrollLocked(mounted)).toBe(false);
          expect(activeElement(mounted)).toBe(trigger);
        },
        PHASE,
      );

      scenario(
        'waits for an animation on the backdrop alone',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({
              head: [exitAnimation('dialog[data-exiting]::backdrop')],
            }),
          });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          await keyboard.press('Escape');
          await pause(EXIT / 4);
          expect(isModal(dialog)).toBe(true);
          await closed(dialog);
        },
        PHASE,
      );

      scenario(
        'opening again while it exits keeps it open',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm({
              head: [exitAnimation('dialog[data-exiting]')],
            }),
            props: { isOpen: true },
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);

          await mounted.setProps({ isOpen: false });
          expect(dialog.hasAttribute('data-exiting')).toBe(true);
          await mounted.setProps({ isOpen: true });
          expect(dialog.hasAttribute('data-exiting')).toBe(false);
          expect(dialog.hasAttribute('data-open')).toBe(true);
          await pause(EXIT + 100);
          expect(isModal(dialog)).toBe(true);
          expect(mounted.state()).toEqual({
            isOpen: true,
            isEntering: false,
            isExiting: false,
          });
        },
        PHASE,
      );
    });

    group('forms', () => {
      scenario(
        "a method=dialog submission closes it with reason submit and the submitter's value",
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm({ content: [FORM] }),
            events: EVENTS,
          });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(byId(mounted, 'delete'));
          expect(mounted.eventNames()).toEqual(['dismiss', 'openChange']);
          expect(dismissals(mounted)).toEqual([
            { reason: 'submit', returnValue: 'delete' },
          ]);
          await closed(dialog);
          expect(dialog.returnValue).toBe('delete');
        },
        PHASE,
      );

      scenario(
        'Enter in a field submits it; a prevented submission keeps it open',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({ content: [FORM] }),
            events: EVENTS,
          });
          const dialog = root(mounted);
          const form = dialog.querySelector('form')!;
          let isValid = false;
          form.addEventListener('submit', (event) => {
            if (!isValid) event.preventDefault();
          });
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          byId(mounted, 'reason').focus();
          await keyboard.press('Enter');
          await pause(100);
          expect(isModal(dialog)).toBe(true);
          expect(mounted.events).toEqual([]);

          isValid = true;
          await keyboard.press('Enter');
          expect(dismissals(mounted)).toEqual([
            { reason: 'submit', returnValue: 'delete' },
          ]);
          await closed(dialog);
        },
        PHASE,
      );

      scenario(
        'only a method=dialog submission closes it',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm({
              content: [
                h('iframe', { name: 'sink', title: 'Sink' }),
                h(
                  'form',
                  { action: 'about:blank', target: 'sink' },
                  h('button', { id: 'send' }, 'Send'),
                  h(
                    'button',
                    { id: 'done', formmethod: 'dialog', value: 'done' },
                    'Done',
                  ),
                ),
              ],
            }),
            events: EVENTS,
          });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          await pointer.click(byId(mounted, 'send'));
          await pause(100);
          expect(isModal(dialog)).toBe(true);
          expect(mounted.events).toEqual([]);

          await pointer.click(byId(mounted, 'done'));
          expect(dismissals(mounted)).toEqual([
            { reason: 'submit', returnValue: 'done' },
          ]);
          await closed(dialog);
        },
        PHASE,
      );

      scenario(
        'a controlled dialog reports a submission and stays open',
        async ({ mount, pointer }) => {
          const mounted = await mount({
            template: confirm({ content: [FORM] }),
            props: { isOpen: true },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);
          await pointer.click(byId(mounted, 'delete'));
          await pause(100);
          expect(isModal(dialog)).toBe(true);
          expect(dismissals(mounted)).toEqual([
            { reason: 'submit', returnValue: 'delete' },
          ]);
        },
        PHASE,
      );
    });

    group('closed by the browser', () => {
      scenario(
        'is reported with reason browser',
        async ({ mount, pointer }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const dialog = root(mounted);
          await pointer.click(mounted.part('trigger'));
          mounted.clearEvents();

          // What the browser does when it closes a dialog itself.
          dialog.close();
          await expect
            .poll(() => mounted.eventNames())
            .toEqual(['dismiss', 'openChange']);
          expect(dismissals(mounted)).toEqual([
            { reason: 'browser', returnValue: '' },
          ]);
          expect(mounted.state().isOpen).toBe(false);
          await expect.poll(() => isPageScrollLocked(mounted)).toBe(false);
          expect(activeElement(mounted)).toBe(mounted.part('trigger'));
        },
        PHASE,
      );

      scenario(
        'a controlled dialog the consumer keeps open opens again',
        async ({ mount }) => {
          const mounted = await mount({
            template: confirm(),
            props: { isOpen: true },
            events: EVENTS,
          });
          const dialog = root(mounted);
          await expect.poll(() => isModal(dialog)).toBe(true);

          dialog.close();
          await expect.poll(() => openChanges(mounted)).toEqual([false]);
          expect(isModal(dialog)).toBe(true);
          expect(activeElement(mounted)).toBe(dialog);
        },
        PHASE,
      );
    });

    group('nested', () => {
      const details = nested(
        'dialog',
        {},
        h('button', { part: 'trigger' }, 'Details'),
        h(
          'dialog',
          { part: 'root' },
          h('h2', { part: 'title' }, 'Details'),
          h('button', { part: 'close' }, 'Back'),
        ),
      );

      scenario(
        'Escape and the backdrop close only the top dialog; scroll stays locked until the last closes',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({
            template: confirm({ content: [details] }),
            events: EVENTS,
          });
          const [outer, inner] = mounted.parts('root') as HTMLDialogElement[];
          const innerTrigger = mounted.parts('trigger')[1]!;
          await pointer.click(mounted.parts('trigger')[0]!);
          await pointer.click(innerTrigger);
          expect(isModal(inner!)).toBe(true);
          mounted.clearEvents();

          await keyboard.press('Escape');
          await closed(inner!);
          expect(isModal(outer!)).toBe(true);
          expect(isPageScrollLocked(mounted)).toBe(true);
          expect(activeElement(mounted)).toBe(innerTrigger);
          expect(mounted.events).toEqual([]);

          await pointer.click(innerTrigger);
          await pointer.click(byId(mounted, 'page'));
          await closed(inner!);
          expect(isModal(outer!)).toBe(true);
          expect(mounted.events).toEqual([]);

          await keyboard.press('Escape');
          await closed(outer!);
          expect(dismissals(mounted)).toEqual([
            { reason: 'escape', returnValue: '' },
          ]);
          expect(isPageScrollLocked(mounted)).toBe(false);
        },
        PHASE,
      );
    });

    group('state', () => {
      scenario(
        'opening and closing never re-render the owner',
        async ({ mount, pointer, keyboard }) => {
          const mounted = await mount({ template: confirm(), events: EVENTS });
          const renders = mounted.renderCount();
          await pointer.click(mounted.part('trigger'));
          await keyboard.press('Escape');
          await closed(root(mounted));
          expect(openChanges(mounted)).toEqual([true, false]);
          expect(mounted.renderCount()).toBe(renders);
        },
        PHASE,
      );
    });

    group('spoken output', () => {
      scenario(
        'reads the trigger, and the open dialog with its name and description',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({ template: confirm() });
          await pointer.click(mounted.part('trigger'));
          const phrases = await spoken();
          expect(phrases).toContain('button, Delete file');
          expect(phrases).toContain(
            "dialog, Delete file, This can't be undone.",
          );
        },
        PHASE,
      );

      scenario(
        'reads a dialog without a description by its name',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({
            template: confirm({ hasDescription: false }),
          });
          await pointer.click(mounted.part('trigger'));
          expect(await spoken()).toContain('dialog, Delete file');
        },
        PHASE,
      );

      scenario(
        'reads an alertdialog',
        async ({ mount, pointer, spoken }) => {
          const mounted = await mount({
            template: confirm(),
            props: { role: 'alertdialog' },
          });
          await pointer.click(mounted.part('trigger'));
          expect(await spoken()).toContain(
            "alertdialog, Delete file, This can't be undone.",
          );
        },
        PHASE,
      );
    });

    group('real screen readers', () => {
      scenario(
        'Enter on the trigger reads the dialog, and Escape reads the trigger again',
        async ({ mount, screenReader }) => {
          const heard = {
            voiceover: {
              trigger: /Delete file button/,
              dialog:
                /Delete file dialog with \d+ items heading level 2 Delete file/,
              returned: /^Delete file button$/,
              focus: /^Delete file button$/,
            },
            nvda: {
              trigger: /Delete file, button/,
              dialog: /Delete file, dialog, This can't be undone\./,
              returned: /Delete file/,
              focus: /Delete file, button, focused/,
            },
          }[screenReader.name];
          const mounted = await mount({ template: confirm() });
          await screenReader.startFrom(
            mounted.container.querySelector<HTMLElement>('#before')!,
          );
          await screenReader.press('Tab');
          expect.soft(await screenReader.spoken()).toMatch(heard.trigger);
          await screenReader.press('Enter');
          expect.soft(await screenReader.spoken()).toMatch(heard.dialog);
          await screenReader.press('Escape');
          // NVDA reads the page again when anything in the top layer closes,
          // a plain <dialog> or popover too (probed); its focus report names
          // the trigger.
          expect.soft(await screenReader.spoken()).toMatch(heard.returned);
          expect.soft(await screenReader.readFocus()).toMatch(heard.focus);
        },
        { ...PHASE, needs: ['screenReader'] },
      );
    });
  },
);
