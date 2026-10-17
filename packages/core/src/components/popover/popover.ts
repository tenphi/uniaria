/**
 * Popover, from the approved spec (`./spec.md`): a dialog anchored to its
 * trigger, over the page but not blocking it. The root is a manual popover
 * (`popover="manual"`, Resolved questions 1) that UniAria shows in the top layer
 * with `showPopover({ source })`, so every close runs through the state, the
 * layer stack and the closing phase; without the Popover API it opens in
 * place (Resolved questions 2). `dom/`'s positioning wrapper places it
 * against the anchor part, else the trigger (Resolved questions 3).
 *
 * Modal by default for the keyboard and assistive technology: Tab wraps and
 * the page is hidden with `aria-hidden`, but the page still takes presses
 * (Resolved questions 4). `isNonModal` keeps the page exposed, lets Tab
 * continue past it, and closes it when focus leaves.
 *
 * The trigger and the close button are Button, composed twice. The trigger
 * takes a tooltip through the popover's `tooltip` link (Tooltip spec,
 * Resolved questions 2).
 */

import {
  createFocusScope,
  createLayer,
  createPosition,
  createPresence,
  hideOutside,
  isComposing,
  isDevelopment,
  isFocusable,
  keepVisible,
  mergeHandlers,
  partEffect,
  partElement,
  restoreFocus,
  supportsPopover,
  warn,
  watchLeavingView,
} from '../../dom';
import type { DomPartProps, PositionArea } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { button } from '../button/button';
import { linkTooltip, relationAttributes, tooltipLink } from '../tooltip/link';

/** Why the user closed the popover (spec, Events). */
export type PopoverDismissReason =
  | 'escape'
  | 'outside'
  | 'trigger'
  | 'close'
  | 'blur'
  | 'scroll'
  | 'parent'
  | 'browser';

export interface PopoverDismissEvent {
  readonly reason: PopoverDismissReason;
}

type PopoverPart =
  'trigger' | 'anchor' | 'root' | 'arrow' | 'title' | 'description' | 'close';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** The marked element to focus on open, else the popover (as Dialog). */
function initialFocus(root: HTMLElement): HTMLElement {
  const marked = root.querySelectorAll<HTMLElement>(
    '[autofocus], [data-autofocus]',
  );
  for (const element of marked) if (isFocusable(element)) return element;
  return root;
}

function isEscape(event: KeyboardEvent): boolean {
  return (
    event.key === 'Escape' &&
    !event.repeat &&
    !isComposing(event) &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  );
}

export const popover = defineComponent({
  name: 'popover',
  parts: [
    'trigger',
    'anchor',
    'root',
    'arrow',
    'title',
    'description',
    'close',
  ],
  links: [tooltipLink],
  props: {
    isOpen: bindable(false),
    isNonModal: prop(false),
    isDismissable: prop(true),
    isKeyboardDismissDisabled: prop(false),
    shouldCloseOnInteractOutside: prop<
      ((target: Element) => boolean) | undefined
    >(undefined, { attribute: false }),
    isDisabled: prop(false),
    shouldRestoreFocus: prop(true),
    positionArea: prop<PositionArea>('bottom'),
    positionTryFallbacks: prop('flip-block, flip-inline'),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
  },
  events: {
    dismiss: event<PopoverDismissEvent>(),
  },
  setup(ctx) {
    const { props } = ctx;
    const isOpen = props.isOpen;
    // The server HTML assumes the Popover API; the browser says otherwise.
    const hasPopoverApi = ctx.state(true);
    // A close for scrolling doesn't restore focus, which would scroll back.
    let isClosedByScroll = false;

    const open = () => {
      isClosedByScroll = false;
      isOpen.set(true);
    };
    /** A close the user asked for: reported, then requested. */
    const requestClose = (reason: PopoverDismissReason) => {
      if (!isOpen.get()) return;
      isClosedByScroll = reason === 'scroll';
      ctx.batch(() => {
        ctx.emit('dismiss', { reason });
        isOpen.set(false);
      });
    };
    const canEscape = () =>
      props.isDismissable() && !props.isKeyboardDismissDisabled();
    const triggerElement = () => partElement(ctx, 'trigger');
    const anchorElement = () =>
      partElement(ctx, 'anchor') ?? partElement(ctx, 'trigger');
    const isModal = () => !props.isNonModal();

    const trigger = ctx.use(
      button,
      () => ({
        isDisabled: props.isDisabled(),
        onPress: () => (isOpen.get() ? requestClose('trigger') : open()),
      }),
      { parts: { root: 'trigger' } },
    );
    const closeButton = ctx.use(
      button,
      () => ({ onPress: () => requestClose('close') }),
      { parts: { root: 'close' } },
    );
    const tooltip = linkTooltip(ctx, { hover: 'trigger', focus: 'trigger' });

    // Rendered parts, and a name the consumer put on the root, as in Dialog.
    // React attaches elements before `start()`; the watch follows changes.
    const present = () => {
      const names: string[] = (
        ['trigger', 'title', 'description'] as const
      ).filter((part) => ctx.element(part) !== null);
      if (partElement(ctx, 'root')?.hasAttribute('aria-label')) {
        names.push('label');
      }
      return names.join(' ');
    };
    const rendered = ctx.state('');
    ctx.effect(() => rendered.set(present()));
    ctx.watch(present, (value) => rendered.set(value));
    const isRendered = (name: PopoverPart | 'label') =>
      rendered.get().split(' ').includes(name);

    partEffect(ctx, 'root', (root) => {
      const view = root.ownerDocument.defaultView;
      if (view) hasPopoverApi.set(supportsPopover(view));
    });

    // Shown: open, or closed and still exiting.
    const presence = createPresence(ctx, {
      part: 'root',
      isOpen: () => isOpen.get(),
    });
    const isShown = presence.isShown;

    // Before the popover takes focus, so the scope is active when it does.
    // A modal popover wraps Tab while open, except for focus a press
    // outside that closes it moves (Resolved questions 5). A non-modal one
    // restores while open only for its Tab-out rule: UniAria restores focus
    // itself, after the closing phase.
    createFocusScope(ctx, {
      part: 'root',
      isActive: isShown,
      shouldContain: () => isModal() && isOpen.get() && !layer.isClosingPress(),
      shouldRestoreFocus: () => !isModal() && isOpen.get(),
    });
    // Off the stack while exiting: Escape and presses go to what's below.
    const layer = createLayer(ctx, {
      part: 'root',
      isOpen: () => isOpen.get(),
      isDismissable: props.isDismissable,
      isKeyboardDismissDisabled: () => !canEscape(),
      // Focus may go back to the trigger of a non-modal popover.
      shouldCloseOnBlur: (next) =>
        !isModal() &&
        props.isDismissable() &&
        !triggerElement()?.contains(next),
      // A press on the trigger toggles it through the trigger instead.
      shouldCloseOnInteractOutside: (target) =>
        !triggerElement()?.contains(target) &&
        props.shouldCloseOnInteractOutside()?.(target) !== false,
      source: anchorElement,
      onDismiss: (reason) => requestClose(reason),
    });

    // Set by the last cleanup on `stop()`, which runs before the others.
    let isStopping = false;

    partEffect(
      ctx,
      'root',
      (root) => {
        const document = root.ownerDocument;
        const view = document.defaultView;
        if (!view || !root.isConnected) return;
        const before = document.activeElement as HTMLElement | null;
        const isNative = supportsPopover(view);
        // The element adapter attaches a part before the binder writes its
        // attributes, and the popover must be one and take focus now.
        if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
        if (isNative) {
          if (root.popover !== 'manual') root.popover = 'manual';
          if (!root.matches(':popover-open')) {
            // The source puts it right after the trigger in the Tab order.
            root.showPopover({ source: triggerElement() ?? undefined });
          }
        } else {
          root.hidden = false;
        }
        initialFocus(root).focus();
        // A custom element may get its title after its root: check later.
        const checks = isDevelopment()
          ? setTimeout(() => checkOpen(root))
          : undefined;

        return () => {
          clearTimeout(checks);
          const isRemoved = !root.isConnected && isShown() && !isStopping;
          // Read before hiding, which drops focus inside to the body.
          const active = document.activeElement;
          const trigger = triggerElement();
          const isHandedOff =
            active !== null &&
            active !== document.body &&
            !root.contains(active) &&
            !trigger?.contains(active);
          if (isNative && root.matches(':popover-open')) root.hidePopover();
          // The trigger, else where focus was (spec, Focus).
          const restore = () => {
            for (const target of [trigger, before]) {
              if (!target?.isConnected || !isFocusable(target)) continue;
              restoreFocus(target);
              if (document.activeElement === target) return;
            }
          };
          if (props.shouldRestoreFocus() && !isHandedOff && !isClosedByScroll) {
            // On stop, once the other cleanups have ended the focus scope,
            // unless it started again meanwhile (React's Strict Mode).
            if (isStopping) {
              queueMicrotask(() => {
                if (!isShown()) restore();
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

    // A modal popover hides the page from assistive technology while open
    // (never with `inert`: the page takes presses); a non-modal one stays
    // visible inside a modal around it.
    partEffect(
      ctx,
      'root',
      (root) => hideOutside([root]),
      () => isOpen.get() && isModal(),
    );
    partEffect(ctx, 'root', keepVisible, () => isOpen.get() && !isModal());

    const position = createPosition(ctx, {
      part: 'root',
      arrowPart: 'arrow',
      isActive: isShown,
      anchor: anchorElement,
      positionArea: props.positionArea,
      positionTryFallbacks: props.positionTryFallbacks,
    });

    // Closes once the anchor has been scrolled out of view (Resolved
    // questions 10). The browser keeps it attached while scrolling.
    watchLeavingView(
      ctx,
      () => (isOpen.get() ? anchorElement() : null),
      () => requestClose('scroll'),
    );

    /** Escape on the trigger of an open popover closes it (spec, Keyboard). */
    const onTriggerKeyDown = (keyEvent: KeyboardEvent) => {
      if (!isEscape(keyEvent) || keyEvent.defaultPrevented) return;
      if (!isOpen.get() || !canEscape()) return;
      keyEvent.preventDefault();
      requestClose('escape');
    };

    /** Development checks for a popover that just opened. */
    function checkOpen(root: HTMLElement) {
      const hasName =
        partElement(ctx, 'title') !== null ||
        props.labelledBy() !== undefined ||
        root.hasAttribute('aria-label') ||
        triggerElement() !== null;
      if (!hasName) {
        warn(
          'popover: the popover has no name. Render a title or a trigger ' +
            'part, or pass labelledBy or an aria-label.',
        );
      }
      for (const dialog of root.ownerDocument.querySelectorAll('dialog')) {
        if (dialog.matches(':modal') && !dialog.contains(root)) {
          warn(
            'popover: it opened while a modal dialog it is not inside is ' +
              'open, which makes it inert. Render the popover inside the dialog.',
          );
          break;
        }
      }
    }

    return {
      trigger,
      closeButton,
      tooltip,
      isRendered,
      hasPopoverApi: () => hasPopoverApi.get(),
      isShown,
      isEntering: presence.isEntering,
      isExiting: presence.isExiting,
      placement: position.side,
      onTriggerKeyDown,
      open,
      close: () => isOpen.set(false),
    };
  },
  expose({ props, api }) {
    return {
      isOpen: props.isOpen.get(),
      isEntering: api.isEntering(),
      isExiting: api.isExiting(),
      placement: api.placement(),
    };
  },
  connect({ props, ids, api }) {
    const isOpen = props.isOpen.get();
    const state = {
      'data-open': flag(isOpen),
      'data-entering': flag(api.isEntering()),
      'data-exiting': flag(api.isExiting()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const has = api.isRendered;
    const placement = api.placement();
    const hasPopoverApi = api.hasPopoverApi();
    const triggerRoot = api.trigger.connect().root as DomPartProps;
    const trigger: DomPartProps = {
      ...triggerRoot,
      attrs: {
        ...triggerRoot.attrs,
        id: ids.trigger,
        'aria-expanded': String(isOpen),
        'aria-controls': isOpen ? ids.root : undefined,
        ...relationAttributes(api.tooltip),
        ...state,
      },
      on: mergeHandlers(triggerRoot.on ?? {}, {
        keydown: api.onTriggerKeyDown,
      }),
    };
    const root: DomPartProps = {
      attrs: {
        id: ids.root,
        popover: hasPopoverApi ? 'manual' : undefined,
        hidden: flag(!hasPopoverApi && !api.isShown()),
        role: 'dialog',
        tabindex: '-1',
        // The trigger names it when nothing else does (Resolved questions 7).
        'aria-labelledby':
          references(
            has('title') ? ids.title : undefined,
            props.labelledBy(),
          ) ?? (!has('label') && has('trigger') ? ids.trigger : undefined),
        'aria-describedby': references(
          has('description') ? ids.description : undefined,
          props.describedBy(),
        ),
        'data-placement': placement,
        ...state,
      },
    };
    return {
      trigger,
      anchor: { attrs: {} },
      root,
      arrow: {
        attrs: { 'aria-hidden': 'true', 'data-placement': placement, ...state },
      },
      title: { attrs: { id: ids.title, ...state } },
      description: { attrs: { id: ids.description, ...state } },
      close: withState(api.closeButton.connect().root),
    };
  },
});
