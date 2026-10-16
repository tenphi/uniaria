/**
 * ToggleButton, from the approved spec (`./spec.md`): Button, composed with
 * `ctx.use()`, plus a bindable `isSelected` announced through
 * `aria-pressed`. Every press toggles it before `press` fires.
 */

import type { PressEvent } from '../../dom';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { button } from '../button/button';

export const toggleButton = defineComponent({
  name: 'toggle-button',
  parts: ['root'],
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
    return { button: inner };
  },
  expose({ props, api }) {
    return { ...api.button.state(), isSelected: props.isSelected.get() };
  },
  connect({ props, api }) {
    const { root } = api.button.connect();
    const isSelected = props.isSelected.get();
    return {
      root: {
        ...root,
        attrs: {
          ...root.attrs,
          // Always present: without it the root is a plain button.
          'aria-pressed': String(isSelected),
          'data-selected': isSelected ? '' : undefined,
        },
      },
    };
  },
});
