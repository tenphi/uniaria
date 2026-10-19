/**
 * Dialog, from the approved spec (`./spec.md`): a modal dialog on the native
 * `<dialog>`, opened with `showModal()`, which makes the page inert and
 * draws the `::backdrop`. UniAria adds the open state, Escape and backdrop
 * dismissal through the layer stack, Tab wrapping, scroll lock, initial
 * focus, focus restore and a closing phase for exit animations, and runs
 * every native close through the state so a controlled dialog can refuse it.
 *
 * The trigger and the close button are Button, composed twice.
 */

import {
  createFocusScope,
  createLayer,
  createPresence,
  createScrollLock,
  hostAnnouncer,
  isDevelopment,
  isFocusable,
  isTopLayer,
  partEffect,
  partElement,
  restoreFocus,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { button } from '../button/button';
import { linkTooltip, relationAttributes, tooltipLink } from '../tooltip/link';

/** Why the user closed the dialog (Resolved questions 9). */
export type DialogDismissReason =
  'escape' | 'outside' | 'close' | 'submit' | 'browser';

export interface DialogDismissEvent {
  readonly reason: DialogDismissReason;
  /** The submitter's `value` for `'submit'`, else `''`. */
  readonly returnValue: string;
}

type DialogPart = 'trigger' | 'root' | 'title' | 'description' | 'close';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** The marked element to focus on open, else the dialog (Resolved questions 2). */
function initialFocus(root: HTMLElement): HTMLElement {
  const marked = root.querySelectorAll<HTMLElement>(
    '[autofocus], [data-autofocus]',
  );
  for (const element of marked) if (isFocusable(element)) return element;
  return root;
}

/** The method a submission uses: the submitter's `formmethod` wins. */
function methodOf(form: HTMLFormElement, submitter: HTMLElement | null) {
  const button = submitter as HTMLButtonElement | null;
  return button?.hasAttribute('formmethod') ? button.formMethod : form.method;
}

export const dialog = defineComponent({
  name: 'dialog',
  parts: ['trigger', 'root', 'title', 'description', 'close'],
  // The trigger takes a tooltip (Tooltip spec, Resolved questions 2).
  links: [tooltipLink],
  // The only members of setup()'s result consumers may call (spec,
  // Actions).
  actions: ['open', 'close'],
  props: {
    isOpen: bindable(false),
    isDismissable: prop(true),
    isKeyboardDismissDisabled: prop(false),
    // The element adopts the root's role: one on the host would be the host's.
    role: prop<'dialog' | 'alertdialog'>('dialog', {
      attribute: false,
      adopt: { part: 'root', attribute: 'role' },
    }),
    isDisabled: prop(false),
    shouldRestoreFocus: prop(true),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
  },
  events: {
    dismiss: event<DialogDismissEvent>(),
  },
  setup(ctx) {
    const { props } = ctx;
    const isOpen = props.isOpen;
    // The value the next native `close()` reports as `returnValue`.
    let returnValue = '';

    const open = () => {
      returnValue = '';
      isOpen.set(true);
    };
    /** A close the user asked for: reported, then requested. */
    const requestClose = (reason: DialogDismissReason, value = '') => {
      if (!isOpen.get()) return;
      returnValue = value;
      ctx.batch(() => {
        ctx.emit('dismiss', { reason, returnValue: value });
        isOpen.set(false);
      });
    };
    const canEscape = () =>
      props.isDismissable() && !props.isKeyboardDismissDisabled();

    const trigger = ctx.use(
      button,
      () => ({ isDisabled: props.isDisabled(), onPress: open }),
      { parts: { root: 'trigger' } },
    );
    const closeButton = ctx.use(
      button,
      () => ({ onPress: () => requestClose('close') }),
      { parts: { root: 'close' } },
    );
    const tooltip = linkTooltip(ctx, { hover: 'trigger', focus: 'trigger' });

    // Only rendered parts are referenced, as in Field. React attaches
    // elements before `start()`; the watch follows parts added later.
    const present = () =>
      (['title', 'description'] as const)
        .filter((part) => ctx.element(part) !== null)
        .join(' ');
    const rendered = ctx.state('');
    ctx.effect(() => rendered.set(present()));
    ctx.watch(present, (value) => rendered.set(value));
    const isRendered = (part: DialogPart) =>
      rendered.get().split(' ').includes(part);

    // Shown: open, or closed and still exiting. The dialog is modal, scroll
    // is locked and focus is contained the whole time it is shown.
    const presence = createPresence(ctx, {
      part: 'root',
      isOpen: () => isOpen.get(),
    });
    const isShown = presence.isShown;

    createScrollLock(ctx, { part: 'root', isActive: isShown });
    // Before the dialog takes focus, so the scope is active when it does.
    createFocusScope(ctx, {
      part: 'root',
      isActive: isShown,
      shouldContain: () => true,
    });
    // Off the stack while exiting: the dialog still prevents Escape, and the
    // inert page takes no press.
    createLayer(ctx, {
      part: 'root',
      isOpen: () => isOpen.get(),
      isDismissable: props.isDismissable,
      isKeyboardDismissDisabled: () => !canEscape(),
      // The inert page takes no press, and a press on the backdrop closes
      // only the top dialog.
      isModal: () => true,
      // Never 'blur' or 'parent': closing on blur is off, and there is no
      // source.
      onDismiss: (reason) => requestClose(reason as 'escape' | 'outside'),
    });

    // Set by the last cleanup on `stop()`, which runs before the others.
    let isStopping = false;

    partEffect(
      ctx,
      'root',
      (root) => {
        const element = root as HTMLDialogElement;
        if (typeof element.showModal !== 'function') return;
        const document = element.ownerDocument;
        const before = document.activeElement as HTMLElement | null;
        // A dialog opened from inside another returns focus there at last.
        const below = before?.closest('dialog');
        let isClosedByBrowser = false;
        const show = () => {
          isClosedByBrowser = false;
          // An `open` attribute in the markup opened it non-modally.
          if (element.open && !element.matches(':modal')) element.close();
          if (!element.open) element.showModal();
          initialFocus(element).focus();
        };
        show();
        // A custom element may get its title after its root: check later.
        const nameCheck = isDevelopment()
          ? setTimeout(() => checkNames(element))
          : undefined;
        const release = hostAnnouncer(element);

        // UniAria prevents every Escape that reaches the dialog, so the browser
        // never closes it on its own (probed). The layer, registered first,
        // has already handled it.
        const onKeyDown = (keyEvent: KeyboardEvent) => {
          if (keyEvent.key === 'Escape') keyEvent.preventDefault();
        };
        // A close request without a keydown here: Android's back gesture, a
        // `requestClose()`. Chromium makes it uncancelable without a recent
        // user activation; then `close` reports it.
        const onCancel = (cancelEvent: Event) => {
          if (cancelEvent.target !== element || !cancelEvent.cancelable) return;
          cancelEvent.preventDefault();
          if (canEscape() && isTopLayer(element)) requestClose('escape');
        };
        // The browser closed it anyway. A `close` queued by UniAria's own
        // `close()` finds the dialog open again or the listener gone.
        const onClose = (closeEvent: Event) => {
          if (closeEvent.target !== element || element.open) return;
          isClosedByBrowser = true;
          requestClose('browser');
          // Controlled and still open: open it again, as a refused toggle.
          if (isOpen.get()) show();
        };
        // After the consumer's handlers, which may prevent it to validate:
        // the document is above every React root.
        const onSubmit = (submitEvent: SubmitEvent) => {
          const form = submitEvent.target as HTMLFormElement;
          if (submitEvent.defaultPrevented) return;
          if (form.closest('dialog') !== element) return;
          const submitter = submitEvent.submitter as HTMLButtonElement | null;
          if (methodOf(form, submitter) !== 'dialog') return;
          submitEvent.preventDefault();
          requestClose('submit', submitter?.value ?? '');
        };
        element.addEventListener('keydown', onKeyDown);
        element.addEventListener('cancel', onCancel);
        element.addEventListener('close', onClose);
        document.addEventListener('submit', onSubmit);

        return () => {
          clearTimeout(nameCheck);
          element.removeEventListener('keydown', onKeyDown);
          element.removeEventListener('cancel', onCancel);
          element.removeEventListener('close', onClose);
          document.removeEventListener('submit', onSubmit);
          release();
          const isRemoved = !element.isConnected && isShown() && !isStopping;
          // Read before `close()`, which moves focus itself.
          const active = document.activeElement;
          const triggerElement = partElement(ctx, 'trigger');
          // Where the browser's own close put focus is no handoff.
          const isHandedOff =
            active !== null &&
            active !== document.body &&
            !element.contains(active) &&
            !triggerElement?.contains(active) &&
            !(isClosedByBrowser && active === before);
          if (element.open) element.close(returnValue);
          // The trigger, else where focus was, else the dialog below
          // (Resolved questions 6).
          const restore = () => {
            for (const target of [triggerElement, before, below]) {
              if (!target?.isConnected || !isFocusable(target)) continue;
              restoreFocus(target);
              if (document.activeElement === target) return;
            }
          };
          if (props.shouldRestoreFocus() && !isHandedOff) {
            // On stop, once the other cleanups have ended the focus scope,
            // unless it started again meanwhile (React's Strict Mode).
            if (isStopping) {
              queueMicrotask(() => {
                if (!element.open) restore();
              });
            } else {
              restore();
            }
          }
          if (isRemoved) requestClose('browser');
        };
      },
      isShown,
    );
    ctx.effect(() => {
      isStopping = false;
      return () => {
        isStopping = true;
      };
    });

    if (isDevelopment()) {
      partEffect(ctx, 'root', (root) => {
        if (root.localName !== 'dialog') {
          warn(
            `dialog: the root is <${root.localName}>, not <dialog>. UniAria ` +
              'opens the native dialog with showModal(), which nothing else has.',
          );
        }
      });
    }

    /** Development checks for a dialog that just opened. */
    function checkNames(root: HTMLElement) {
      const hasName =
        partElement(ctx, 'title') !== null ||
        props.labelledBy() !== undefined ||
        root.hasAttribute('aria-label');
      if (!hasName) {
        warn(
          'dialog: the dialog has no name. Render a title part, or pass ' +
            'labelledBy or an aria-label.',
        );
      }
      const hasDescription =
        partElement(ctx, 'description') !== null ||
        props.describedBy() !== undefined;
      if (props.role() === 'alertdialog' && !hasDescription) {
        warn(
          'dialog: an alertdialog needs a description part (or describedBy) ' +
            'with its message.',
        );
      }
    }

    return {
      trigger,
      closeButton,
      tooltip,
      isRendered,
      isEntering: presence.isEntering,
      isExiting: presence.isExiting,
      open,
      close: () => isOpen.set(false),
    };
  },
  expose({ props, api }) {
    return {
      isOpen: props.isOpen.get(),
      isEntering: api.isEntering(),
      isExiting: api.isExiting(),
    };
  },
  connect({ props, ids, api }) {
    const state = {
      'data-open': flag(props.isOpen.get()),
      'data-entering': flag(api.isEntering()),
      'data-exiting': flag(api.isExiting()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const has = api.isRendered;
    const root: DomPartProps = {
      attrs: {
        id: ids.root,
        role: props.role() === 'alertdialog' ? 'alertdialog' : undefined,
        tabindex: '-1',
        'aria-labelledby': references(
          has('title') ? ids.title : undefined,
          props.labelledBy(),
        ),
        'aria-describedby': references(
          has('description') ? ids.description : undefined,
          props.describedBy(),
        ),
        ...state,
      },
    };
    const trigger = api.trigger.connect().root;
    return {
      trigger: withState({
        ...trigger,
        attrs: { ...trigger.attrs, ...relationAttributes(api.tooltip) },
      }),
      root,
      title: { attrs: { id: ids.title, ...state } },
      description: { attrs: { id: ids.description, ...state } },
      close: withState(api.closeButton.connect().root),
    };
  },
});
