/**
 * Tooltip, from the approved spec (`./spec.md`): a short text that describes
 * a control, shown while the pointer rests on it or it has visible keyboard
 * focus. The root is a manual popover UniAria shows in the top layer, as
 * Popover's, without taking focus; without the Popover API it opens in
 * place. `dom/`'s positioning wrapper places it against the anchor part,
 * else what it describes.
 *
 * What it describes is the component that took it through its `tooltip`
 * link (Resolved questions 2; `./link.ts`), else the trigger part. The
 * tooltip listens on that component's elements itself: hover on its visible
 * part, focus and presses on its focusable part. One tooltip is open at a
 * time per window, and once one has shown, the next opens at once
 * (`./registry.ts`, Warm-up). It stays off the layer stack and handles
 * Escape itself (Resolved questions 5 and 6).
 */

import {
  createPosition,
  createPresence,
  elementEffect,
  isComposing,
  isDevelopment,
  isFocusable,
  isRestoringFocus,
  modalityTrackerFor,
  partEffect,
  partElement,
  supportsPopover,
  warn,
  watchLeavingView,
} from '../../dom';
import type { DomPartProps, PositionArea } from '../../dom';
import { bindable, defineComponent, prop } from '../../runtime';
import type { TooltipLinkApi, TooltipRelation, TooltipTarget } from './link';
import { tooltipLink } from './link';
import type { ShownTooltip, WaitingTooltip } from './registry';
import {
  hideTooltip,
  isWarm,
  showTooltip,
  stopWaiting,
  waitForTooltip,
} from './registry';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Keys that never close it: a lone modifier, and Tab and Escape. */
const KEPT_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock',
  'Fn',
  'Tab',
  'Escape',
]);

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

/** A mouse or a pen; touch never opens a tooltip (Resolved questions 11). */
function isHoverPointer(event: PointerEvent): boolean {
  if (event.pointerType === 'touch') return false;
  const element = event.currentTarget as Element;
  return !(
    event.pointerType === 'mouse' &&
    modalityTrackerFor(element)?.isEmulatingMouse()
  );
}

export const tooltip = defineComponent({
  name: 'tooltip',
  parts: ['trigger', 'anchor', 'root', 'arrow'],
  provides: [tooltipLink],
  // The only members of setup()'s result consumers may call (spec,
  // Actions).
  actions: ['open', 'close'],
  props: {
    isOpen: bindable(false),
    isDisabled: prop(false),
    delay: prop(250),
    closeDelay: prop(500),
    trigger: prop<'hover' | 'focus'>('hover'),
    relation: prop<'description' | 'label'>('description'),
    positionArea: prop<PositionArea>('top'),
    positionTryFallbacks: prop('flip-block, flip-inline'),
  },
  setup(ctx) {
    const { props, ids } = ctx;
    const isOpen = props.isOpen;
    // The server HTML assumes the Popover API; the browser says otherwise.
    const hasPopoverApi = ctx.state(true);
    const isInstant = ctx.state(false);

    // The component that took the tooltip, else the trigger part.
    const taken = ctx.state<{ readonly target: TooltipTarget } | null>(null);
    const take: TooltipLinkApi['take'] = (target) => {
      if (taken.get()) return null;
      const entry = { target };
      taken.set(entry);
      return () => {
        if (taken.get() === entry) taken.set(null);
      };
    };
    const hoverElement = () =>
      taken.get()?.target.hover ?? partElement(ctx, 'trigger');
    const focusElement = () =>
      taken.get()?.target.focus ?? partElement(ctx, 'trigger');
    const anchorElement = () =>
      partElement(ctx, 'anchor') ??
      taken.get()?.target.anchor ??
      partElement(ctx, 'trigger');
    const relation = (): TooltipRelation | undefined => {
      if (props.isDisabled()) return undefined;
      return props.relation() === 'label'
        ? { labelledBy: ids.root }
        : { describedBy: ids.root };
    };
    const windowOf = (): Window | null =>
      (hoverElement() ?? focusElement() ?? partElement(ctx, 'root'))
        ?.ownerDocument.defaultView ?? null;

    // What holds it open (Resolved questions 9).
    let isHoveringTrigger = false;
    let isHoveringTooltip = false;
    let isFocusHeld = false;
    // After Escape or a press, until the pointer leaves or focus does.
    let isSuppressed = false;
    // Closed for another tooltip: no closing phase.
    let shouldSkipExit = false;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const waiting: WaitingTooltip = {
      cancel: () => clearTimeout(openTimer),
    };
    const shown: ShownTooltip = {
      close() {
        shouldSkipExit = true;
        requestClose();
        // Controlled and kept open: it closes later with its closing phase.
        if (isOpen.get()) shouldSkipExit = false;
      },
    };

    const clearTimers = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      const view = windowOf();
      if (view) stopWaiting(view, waiting);
    };
    const open = () => {
      clearTimers();
      if (props.isDisabled() || isOpen.get()) return;
      const view = windowOf();
      ctx.batch(() => {
        isInstant.set(view !== null && isWarm(view));
        shouldSkipExit = false;
        isOpen.set(true);
      });
    };
    const requestClose = () => {
      clearTimers();
      if (isOpen.get()) isOpen.set(false);
    };
    /** Escape or a press: closed until the pointer or focus leaves. */
    const dismiss = () => {
      isSuppressed = true;
      requestClose();
    };

    const onHoverStart = () => {
      clearTimeout(closeTimer);
      if (isSuppressed || props.isDisabled() || isOpen.get()) return;
      const view = windowOf();
      if (!view || isWarm(view)) return open();
      clearTimeout(openTimer);
      waitForTooltip(view, waiting);
      openTimer = setTimeout(() => {
        stopWaiting(view, waiting);
        open();
      }, props.delay());
    };
    /** The pointer left the trigger or the tooltip. */
    const onHoverEnd = () => {
      if (isHoveringTrigger || isHoveringTooltip) return;
      clearTimeout(openTimer);
      const view = windowOf();
      if (view) stopWaiting(view, waiting);
      isSuppressed = false;
      if (isFocusHeld || !isOpen.get()) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(requestClose, props.closeDelay());
    };

    // Hover on what it describes: a mouse or a pen, unless only focus
    // counts. Pointer and mouse events reach a natively disabled control
    // (probed in all three).
    elementEffect(ctx, hoverElement, (element) => {
      const onEnter = (event: PointerEvent) => {
        if (!isHoverPointer(event) || props.trigger() === 'focus') return;
        isHoveringTrigger = true;
        onHoverStart();
      };
      const onLeave = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || !isHoveringTrigger) return;
        isHoveringTrigger = false;
        onHoverEnd();
      };
      element.addEventListener('pointerenter', onEnter);
      element.addEventListener('pointerleave', onLeave);
      element.addEventListener('pointerdown', dismiss);
      return () => {
        element.removeEventListener('pointerenter', onEnter);
        element.removeEventListener('pointerleave', onLeave);
        element.removeEventListener('pointerdown', dismiss);
        isHoveringTrigger = false;
      };
    });

    // Hovering the tooltip keeps it open (Resolved questions 10).
    partEffect(ctx, 'root', (root) => {
      const onEnter = (event: PointerEvent) => {
        if (!isHoverPointer(event) || props.trigger() === 'focus') return;
        isHoveringTooltip = true;
        clearTimeout(closeTimer);
      };
      const onLeave = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || !isHoveringTooltip) return;
        isHoveringTooltip = false;
        onHoverEnd();
      };
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointerleave', onLeave);
      return () => {
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointerleave', onLeave);
        isHoveringTooltip = false;
      };
    });

    // Visible focus opens it at once; not focus an overlay restores, nor
    // focus coming back with the window (Resolved questions 8).
    elementEffect(ctx, focusElement, (element) => {
      const view = element.ownerDocument.defaultView;
      let isWindowReturn = false;
      const onWindowBlur = () => {
        if (element.ownerDocument.activeElement === element) {
          isWindowReturn = true;
        }
      };
      const onFocus = () => {
        if (isWindowReturn) {
          isWindowReturn = false;
          return;
        }
        if (isRestoringFocus(element)) return;
        if (modalityTrackerFor(element)?.isFocusVisible() === false) return;
        isFocusHeld = true;
        if (!isSuppressed) open();
      };
      const onBlur = () => {
        isFocusHeld = false;
        isSuppressed = false;
        if (!isHoveringTrigger && !isHoveringTooltip) requestClose();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (!KEPT_KEYS.has(event.key)) dismiss();
      };
      // Started early, so it has seen the input before this focus.
      modalityTrackerFor(element);
      view?.addEventListener('blur', onWindowBlur);
      element.addEventListener('focus', onFocus);
      element.addEventListener('blur', onBlur);
      element.addEventListener('keydown', onKeyDown);
      element.addEventListener('pointerdown', dismiss);
      return () => {
        view?.removeEventListener('blur', onWindowBlur);
        element.removeEventListener('focus', onFocus);
        element.removeEventListener('blur', onBlur);
        element.removeEventListener('keydown', onKeyDown);
        element.removeEventListener('pointerdown', dismiss);
        isFocusHeld = false;
      };
    });

    // Escape from anywhere while open, prevented but not stopped, so a
    // Popover or Dialog around it stays open (Resolved questions 5).
    partEffect(
      ctx,
      'root',
      (root) => {
        const document = root.ownerDocument;
        const onKeyDown = (event: KeyboardEvent) => {
          if (!isEscape(event) || event.defaultPrevented) return;
          event.preventDefault();
          dismiss();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
      },
      () => isOpen.get(),
    );

    // One open at a time, and warm while one is (Warm-up). Through the root,
    // which the element adapter may attach after a controlled `isOpen`.
    partEffect(
      ctx,
      'root',
      (root) => {
        const view = root.ownerDocument.defaultView;
        if (!view) return;
        showTooltip(view, shown);
        return () => hideTooltip(view, shown, props.closeDelay());
      },
      () => isOpen.get(),
    );
    ctx.effect(() => clearTimers);

    // Disabled, or nothing left to describe: closed.
    ctx.watch(
      () => props.isDisabled() || (!hoverElement() && !focusElement()),
      (isGone) => {
        if (isGone) requestClose();
      },
    );

    partEffect(ctx, 'root', (root) => {
      const view = root.ownerDocument.defaultView;
      if (view) hasPopoverApi.set(supportsPopover(view));
    });

    const presence = createPresence(ctx, {
      part: 'root',
      isOpen: () => isOpen.get(),
      shouldSkipExit: () => shouldSkipExit,
    });
    const isShown = presence.isShown;

    partEffect(
      ctx,
      'root',
      (root) => {
        const view = root.ownerDocument.defaultView;
        if (!view || !root.isConnected) return;
        const isNative = supportsPopover(view);
        if (isNative) {
          // The element adapter attaches a part before the binder writes it.
          if (root.popover !== 'manual') root.popover = 'manual';
          if (!root.matches(':popover-open')) root.showPopover();
        } else {
          root.hidden = false;
        }
        const checks = isDevelopment()
          ? setTimeout(() => checkOpen(root))
          : undefined;
        return () => {
          clearTimeout(checks);
          if (isNative && root.matches(':popover-open')) root.hidePopover();
        };
      },
      isShown,
    );

    const position = createPosition(ctx, {
      part: 'root',
      arrowPart: 'arrow',
      isActive: isShown,
      anchor: anchorElement,
      positionArea: props.positionArea,
      positionTryFallbacks: props.positionTryFallbacks,
    });

    // Closes once what it describes has been scrolled out of view.
    watchLeavingView(
      ctx,
      () => (isOpen.get() ? anchorElement() : null),
      requestClose,
    );

    /** Development checks for a tooltip that just opened. */
    function checkOpen(root: HTMLElement) {
      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        if (isFocusable(element)) {
          warn(
            'tooltip: it holds a focusable element, which nobody can reach. ' +
              'Put interactive content in a non-modal Popover.',
          );
          break;
        }
      }
      if (taken.get() && partElement(ctx, 'trigger')) {
        warn(
          'tooltip: a component took it, so its trigger part does nothing. ' +
            'Render one or the other.',
        );
      }
      for (const dialog of root.ownerDocument.querySelectorAll('dialog')) {
        if (dialog.matches(':modal') && !dialog.contains(root)) {
          warn(
            'tooltip: it opened while a modal dialog it is not inside is ' +
              'open, which makes it inert. Render the tooltip inside the dialog.',
          );
          break;
        }
      }
    }

    return {
      take,
      relation,
      hasPopoverApi: () => hasPopoverApi.get(),
      isShown,
      isEntering: presence.isEntering,
      isExiting: presence.isExiting,
      isInstant: () => isOpen.get() && isInstant.get(),
      placement: position.side,
      open,
      close: requestClose,
    };
  },
  expose({ props, api }) {
    return {
      isOpen: props.isOpen.get(),
      isEntering: api.isEntering(),
      isExiting: api.isExiting(),
      isInstant: api.isInstant(),
      placement: api.placement(),
    };
  },
  connect({ props, ids, api }) {
    const isOpen = props.isOpen.get();
    const placement = api.placement();
    const hasPopoverApi = api.hasPopoverApi();
    const relation = api.relation();
    const state = {
      'data-open': flag(isOpen),
      'data-entering': flag(api.isEntering()),
      'data-exiting': flag(api.isExiting()),
      'data-instant': flag(api.isInstant()),
    };
    const root: DomPartProps = {
      attrs: {
        id: ids.root,
        popover: hasPopoverApi ? 'manual' : undefined,
        hidden: flag(!hasPopoverApi && !api.isShown()),
        role: 'tooltip',
        'data-placement': placement,
        ...state,
      },
    };
    return {
      trigger: {
        attrs: {
          'aria-describedby': relation?.describedBy,
          'aria-labelledby': relation?.labelledBy,
        },
      },
      anchor: { attrs: {} },
      root,
      arrow: {
        attrs: { 'aria-hidden': 'true', 'data-placement': placement, ...state },
      },
    };
  },
});
