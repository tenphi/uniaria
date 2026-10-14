/**
 * Button, from the approved spec (`./spec.md`): a native `<button>`, a native
 * `<a href>` in link mode, or any element with `role="button"`, with one
 * `press` event for every input and state attributes for styling.
 *
 * Phase 1: keyboard, mouse, virtual clicks and disabled modes. Hover,
 * focus-visible, touch and `touch-action` arrive with the interaction layer
 * in phase 2; until then `isHovered` and `isFocusVisible` stay false.
 */

import { createFocus, createPress, partElement, warn } from '../../dom';
import type { DomPartProps, PressEvent } from '../../dom';
import { defineComponent, event, prop } from '../../runtime';

/** Roots with native button semantics; anything else gets `role="button"`. */
const NATIVE = new Set(['button', 'input']);

const flag = (on: boolean): string | undefined => (on ? '' : undefined);

function role(link: boolean, native: boolean, disabled: boolean) {
  // An `a` without `href` has no role, so a disabled link needs one.
  if (link) return disabled ? 'link' : undefined;
  return native ? undefined : 'button';
}

export const button = defineComponent({
  name: 'button',
  parts: ['root'],
  props: {
    disabled: prop(false),
    focusableWhenDisabled: prop(false),
    // Link mode. The element adopts the root's href on upgrade, so the link
    // works before JavaScript runs.
    href: prop<string | undefined>(undefined, {
      adopt: { part: 'root', attribute: 'href' },
    }),
    type: prop<'button' | 'submit' | 'reset'>('button'),
    // The element reads the root's tag instead of taking an attribute.
    elementType: prop('button', {
      attribute: false,
      adopt: { part: 'root', tag: true },
    }),
    excludeFromTabOrder: prop(false),
    preventFocusOnPress: prop(false),
  },
  events: {
    pressStart: event<PressEvent>(),
    pressEnd: event<PressEvent>(),
    press: event<PressEvent>(),
  },
  setup(ctx) {
    const press = createPress(ctx, {
      part: 'root',
      isDisabled: ctx.props.disabled,
      preventFocusOnPress: ctx.props.preventFocusOnPress,
      onPressStart: (detail) => ctx.emit('pressStart', detail),
      onPressEnd: (detail) => ctx.emit('pressEnd', detail),
      onPress: (detail) => ctx.emit('press', detail),
    });
    const focus = createFocus(ctx, 'root');
    // The element adapter reads the tag; React can only check it.
    ctx.effect(() => {
      const root = partElement(ctx, 'root');
      const expected = ctx.props.elementType();
      if (!root || ctx.props.href() !== undefined) return;
      if (root.localName !== expected) {
        warn(
          `button: the root is <${root.localName}> but elementType is "${expected}". ` +
            `Pass elementType="${root.localName}" so it gets the right role and keyboard handling.`,
        );
      }
    });
    return {
      isPressed: press.isPressed,
      isFocused: focus.isFocused,
      handlers: { ...press.handlers, ...focus.handlers },
    };
  },
  expose({ props, api }) {
    return {
      isPressed: api.isPressed(),
      isHovered: false,
      isFocused: api.isFocused(),
      isFocusVisible: false,
      isDisabled: props.disabled(),
    };
  },
  connect({ props, api }) {
    const disabled = props.disabled();
    const href = props.href();
    const link = href !== undefined;
    const native = !link && NATIVE.has(props.elementType());
    // Native disabled drops focus; aria-disabled keeps it.
    const nativeDisabled = disabled && native && !props.focusableWhenDisabled();
    const ariaDisabled = disabled && !nativeDisabled;
    const focusable = !disabled || props.focusableWhenDisabled() || native;
    const tabindex = props.excludeFromTabOrder() ? '-1' : '0';
    const root: DomPartProps = {
      attrs: {
        type: native ? props.type() : undefined,
        href: link && !disabled ? href : undefined,
        role: role(link, native, disabled),
        disabled: flag(nativeDisabled),
        'aria-disabled': ariaDisabled ? 'true' : undefined,
        tabindex: focusable ? tabindex : undefined,
        'data-pressed': flag(api.isPressed()),
        'data-hovered': undefined,
        'data-focused': flag(api.isFocused()),
        'data-focus-visible': undefined,
        'data-disabled': flag(disabled),
      },
      on: api.handlers,
    };
    return { root };
  },
});
