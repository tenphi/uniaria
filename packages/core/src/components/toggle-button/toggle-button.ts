/**
 * ToggleButton, from the approved spec (`./spec.md`): Button, composed with
 * `ctx.use()`, plus a bindable `isSelected` announced through
 * `aria-pressed`. Every press toggles it before `press` fires. It takes a
 * tooltip as Button does, and Button's label, description, frame and
 * extras (items spec), whose frame and extras carry `data-selected` too.
 */

import type { PressEvent } from '../../dom';
import { bindable, defineBehavior, event, prop } from '../../runtime';
import { button } from '../button/button';
import { linkTooltip, relationAttributes, tooltipLink } from '../tooltip/link';

export const toggleButton = defineBehavior({
  name: 'toggle-button',
  parts: ['root', 'label', 'description', 'frame', 'extras'],
  // Beside the root, as Button's.
  outsideParts: ['frame', 'extras'],
  links: [tooltipLink],
  props: {
    isSelected: bindable(false),
    isDisabled: prop(false),
    isFocusableWhenDisabled: prop(false),
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
    const { props } = ctx;
    const inner = ctx.use(button, () => ({
      isDisabled: props.isDisabled(),
      isFocusableWhenDisabled: props.isFocusableWhenDisabled(),
      elementType: props.elementType(),
      shouldExcludeFromTabOrder: props.shouldExcludeFromTabOrder(),
      shouldPreventFocusOnPress: props.shouldPreventFocusOnPress(),
      onPressStart: (detail) => ctx.emit('pressStart', detail),
      onPressEnd: (detail) => ctx.emit('pressEnd', detail),
      onFocusChange: (isFocused) => ctx.emit('focusChange', isFocused),
      // Toggle first, so `press` handlers see the new value (React Aria's
      // order: `selectedChange`, then `press`).
      onPress: (detail) => {
        props.isSelected.set(!props.isSelected.get());
        ctx.emit('press', detail);
      },
    }));
    // The composed Button sees no link: the toggle button takes it.
    const tooltip = linkTooltip(ctx, {
      hover: 'root',
      focus: 'root',
      text: ['label', 'description'],
    });
    return { button: inner, tooltip };
  },
  expose({ props, api }) {
    return { ...api.button.state(), isSelected: props.isSelected.get() };
  },
  connect({ props, api }) {
    const { root, label, description, frame, extras } = api.button.connect();
    const isSelected = props.isSelected.get();
    const selected = { 'data-selected': isSelected ? '' : undefined };
    return {
      root: {
        ...root,
        attrs: {
          ...root.attrs,
          // Always present: without it the root is a plain button.
          'aria-pressed': String(isSelected),
          ...selected,
          // After Button's label and description.
          ...relationAttributes(api.tooltip, {
            labelledBy: root.attrs['aria-labelledby'],
            describedBy: root.attrs['aria-describedby'],
          }),
        },
      },
      label,
      description,
      frame: { ...frame, attrs: { ...frame.attrs, ...selected } },
      extras: { ...extras, attrs: { ...extras.attrs, ...selected } },
    };
  },
});
