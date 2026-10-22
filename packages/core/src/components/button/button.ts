/**
 * Button, from the approved spec (`./spec.md`): a native `<button>`, a native
 * `<a href>` in link mode, or any element with `role="button"`, with one
 * `press` event for every input and state attributes for styling. It takes
 * a tooltip through its `tooltip` link (Tooltip spec, Resolved questions 2).
 *
 * From the items spec (`./items.md`): a `label` that alone names it and a
 * `description` that describes it, each while rendered; a `frame` around it
 * and its `extras` beside it, outside the root, which carry its state, with
 * hover counted over the frame.
 */

import {
  createFocus,
  createHover,
  createPress,
  mergeHandlers,
  partEffect,
  warn,
} from '../../dom';
import type { DomPartProps, PressEvent } from '../../dom';
import { defineComponent, event, prop } from '../../runtime';
import { linkTooltip, relationAttributes, tooltipLink } from '../tooltip/link';

/** Roots with native button semantics; anything else gets `role="button"`. */
const NATIVE = new Set(['button', 'input']);

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/**
 * For a component that composes Button with none of the items parts:
 * Select's trigger maps the frame and extras only, the steppers and close
 * buttons nothing (items spec, Triggers built on Button).
 */
export const NO_ITEM_PARTS = {
  label: null,
  description: null,
  frame: null,
  extras: null,
} as const;

/** Popover's and Dialog's trigger: Button's parts under trigger names. */
export const TRIGGER_PARTS = {
  root: 'trigger',
  label: 'triggerLabel',
  description: 'triggerDescription',
  frame: 'triggerFrame',
  extras: 'triggerExtras',
} as const;

/** The parts referenced or hovered only while rendered. */
const OPTIONAL_PARTS = ['label', 'description', 'frame'] as const;
type OptionalPart = (typeof OPTIONAL_PARTS)[number];

function role(isLink: boolean, isNative: boolean, isDisabled: boolean) {
  // An `a` without `href` has no role, so a disabled link needs one.
  if (isLink) return isDisabled ? 'link' : undefined;
  return isNative ? undefined : 'button';
}

export const button = defineComponent({
  name: 'button',
  parts: ['root', 'label', 'description', 'frame', 'extras'],
  // Beside the root, not inside it (items spec, Runtime and harness
  // changes 1).
  outsideParts: ['frame', 'extras'],
  links: [tooltipLink],
  props: {
    isDisabled: prop(false),
    isFocusableWhenDisabled: prop(false),
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
    shouldExcludeFromTabOrder: prop(false),
    shouldPreventFocusOnPress: prop(false),
  },
  events: {
    pressStart: event<PressEvent>(),
    pressEnd: event<PressEvent>(),
    press: event<PressEvent>(),
    focusChange: event<boolean>(),
  },
  setup(ctx) {
    // Only parts with an element are referenced or hovered, as Field's.
    // React attaches elements before `start()`, so the effect reads them
    // then; the watch follows parts added or removed later.
    const present = () =>
      OPTIONAL_PARTS.filter((part) => ctx.element(part) !== null).join(' ');
    const rendered = ctx.state('');
    ctx.effect(() => rendered.set(present()));
    ctx.watch(present, (value) => rendered.set(value));
    const isRendered = (part: OptionalPart) =>
      rendered.get().split(' ').includes(part);

    const press = createPress(ctx, {
      part: 'root',
      isDisabled: ctx.props.isDisabled,
      shouldPreventFocusOnPress: ctx.props.shouldPreventFocusOnPress,
      onPressStart: (detail) => ctx.emit('pressStart', detail),
      onPressEnd: (detail) => ctx.emit('pressEnd', detail),
      onPress: (detail) => ctx.emit('press', detail),
    });
    // Over the frame while one is rendered: the button, an extra or a gap
    // between them.
    const hover = createHover(ctx, {
      part: () => (isRendered('frame') ? 'frame' : 'root'),
      isDisabled: ctx.props.isDisabled,
    });
    const focus = createFocus(ctx, 'root');
    ctx.watch(focus.isFocused, (isFocused) => {
      ctx.emit('focusChange', isFocused);
    });
    // Hover over the root alone, so an extra's own tooltip doesn't open
    // this one as well.
    const tooltip = linkTooltip(ctx, {
      hover: 'root',
      focus: 'root',
      text: ['label', 'description'],
    });
    // The element adapter reads the tag; React can only check it.
    partEffect(ctx, 'root', (root) => {
      const expected = ctx.props.elementType();
      if (ctx.props.href() !== undefined) return;
      if (root.localName !== expected) {
        warn(
          `button: the root is <${root.localName}> but elementType is "${expected}". ` +
            `Pass elementType="${root.localName}" so it gets the right role and keyboard handling.`,
        );
      }
    });
    return {
      tooltip,
      isRendered,
      isPressed: press.isPressed,
      isHovered: hover.isHovered,
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      handlers: mergeHandlers(
        press.handlers,
        hover.handlersFor('root'),
        focus.handlers,
      ),
      frameHandlers: hover.handlersFor('frame'),
    };
  },
  expose({ props, api }) {
    return {
      isPressed: api.isPressed(),
      isHovered: api.isHovered(),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isDisabled: props.isDisabled(),
    };
  },
  connect({ props, ids, api }) {
    const isDisabled = props.isDisabled();
    const href = props.href();
    const isLink = href !== undefined;
    const isNative = !isLink && NATIVE.has(props.elementType());
    // Native disabled drops focus; aria-disabled keeps it.
    const isNativelyDisabled =
      isDisabled && isNative && !props.isFocusableWhenDisabled();
    const isAriaDisabled = isDisabled && !isNativelyDisabled;
    const isFocusable =
      !isDisabled || props.isFocusableWhenDisabled() || isNative;
    const tabindex = props.shouldExcludeFromTabOrder() ? '-1' : '0';
    const state = {
      'data-pressed': flag(api.isPressed()),
      'data-hovered': flag(api.isHovered()),
      'data-focused': flag(api.isFocused()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-disabled': flag(isDisabled),
    };
    const root: DomPartProps = {
      attrs: {
        type: isNative ? props.type() : undefined,
        href: isLink && !isDisabled ? href : undefined,
        role: role(isLink, isNative, isDisabled),
        disabled: flag(isNativelyDisabled),
        'aria-disabled': isAriaDisabled ? 'true' : undefined,
        tabindex: isFocusable ? tabindex : undefined,
        ...state,
        // The whole attributes while a part or a tooltip is there; else the
        // consumer's own stay (items spec, Label and description).
        ...relationAttributes(api.tooltip, {
          labelledBy: api.isRendered('label') ? ids.label : undefined,
          describedBy: api.isRendered('description')
            ? ids.description
            : undefined,
        }),
      },
      on: api.handlers,
    };
    return {
      root,
      label: { attrs: { id: ids.label } },
      description: { attrs: { id: ids.description } },
      frame: { attrs: state, on: api.frameHandlers },
      extras: { attrs: state },
    };
  },
});
