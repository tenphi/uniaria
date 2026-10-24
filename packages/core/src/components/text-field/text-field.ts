/**
 * TextField, from the approved spec (`./spec.md`): Field and TextInput
 * composed on a native `<input>` or `<textarea>`. TextInput holds the value
 * (uncontrolled, or controlled and buffered as Cube UI Kit's is), the IME
 * guard, hover and focus (composition spec); TextField adds the labelling,
 * read-only mode, the form reset of its own value, its state on every part,
 * and a press on the wrapper that focuses the input. The browser keeps doing
 * the editing.
 */

import { partEffect, partElement } from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineBehavior, event, prop } from '../../runtime';
import { field } from '../field/field';
import { textInput } from '../text-input/text-input';
import { linkTooltip, tooltipLink } from '../tooltip/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Elements inside the wrapper that keep their own press. */
const CONTROLS =
  'a[href], button, input, select, textarea, label, [contenteditable], [tabindex]';

export const textField = defineBehavior({
  name: 'text-field',
  parts: ['root', 'wrapper', 'label', 'input', 'description', 'error'],
  links: [tooltipLink],
  props: {
    // The element adopts the input's current text: the markup's value, or
    // what the user typed before upgrade.
    value: bindable('', { adopt: { part: 'input', property: 'value' } }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    // Field's `controlId`: the input's id where it has none of its own.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'input',
    }),
    // The element reads the label's tag instead of taking an attribute.
    labelElementType: prop('label', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
  },
  events: {
    focusChange: event<boolean>(),
  },
  setup(ctx) {
    const { props } = ctx;
    // Hover, focus and typing on the input (Tooltip spec, Resolved
    // questions 2): a key closes the tooltip.
    // An input scrolls its text, so an overflow tooltip never opens (items
    // spec, The trigger's text).
    const tooltip = linkTooltip(ctx, {
      hover: 'input',
      focus: 'input',
      textFallback: null,
    });
    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy:
          [props.labelledBy(), tooltip.labelledBy()]
            .filter(Boolean)
            .join(' ') || undefined,
        describedBy:
          [props.describedBy(), tooltip.describedBy()]
            .filter(Boolean)
            .join(' ') || undefined,
      }),
      { parts: { control: 'input' } },
    );
    // The value, typing, IME, hover and focus on the input.
    const text = ctx.use(
      textInput,
      () => ({
        value: props.value.get(),
        onValueChange: (value: string) => props.value.set(value),
        isDisabled: props.isDisabled(),
        isReadOnly: props.isReadOnly(),
        onFocusChange: (isFocused: boolean) =>
          ctx.emit('focusChange', isFocused),
      }),
      { parts: { root: 'input' } },
    );

    // Form reset goes back to the default, as a native field does: an
    // uncontrolled field follows defaultValue again, even one set after
    // mount; a controlled one asks for it, or without one for the value it
    // mounted with, as React Aria's does. TextInput drops its draft and
    // writes the text again after the native reset.
    let initial: string | undefined;
    partEffect(ctx, 'input', (element) => {
      initial ??= props.value.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      const onReset = (event: Event) => {
        if (event.defaultPrevented) return;
        props.value.reset({ fallback: initial });
      };
      form.addEventListener('reset', onReset);
      return () => form.removeEventListener('reset', onReset);
    });

    // The wrapper draws the box around the input, so a press on it outside
    // any control focuses the input.
    const focusInput = (event: MouseEvent) => {
      const input = partElement(ctx, 'input');
      const wrapper = partElement(ctx, 'wrapper');
      if (!input || !wrapper || event.button !== 0 || props.isDisabled()) {
        return;
      }
      const control = (event.target as Element).closest(CONTROLS);
      if (control && wrapper.contains(control)) return;
      event.preventDefault();
      input.focus();
    };

    return { field: labelling, text, focusInput };
  },
  expose({ props, api }) {
    const { isFocused, isFocusVisible, isHovered } = api.text.state();
    return {
      value: props.value.get(),
      isFocused,
      isFocusVisible,
      isHovered,
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
    };
  },
  connect({ props, api }) {
    const { control, ...parts } = api.field.connect();
    const text = api.text.connect().root;
    const { isFocused, isFocusVisible, isHovered } = api.text.state();
    // Every part, so the box, the label and the messages can be styled.
    const state = {
      'data-hovered': flag(isHovered),
      'data-focused': flag(isFocused),
      'data-focus-visible': flag(isFocusVisible),
      'data-readonly': flag(props.isReadOnly()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    // The box around the input, with Field's state attributes as on the root.
    const wrapper: DomPartProps = {
      attrs: { ...parts.root.attrs, ...state },
      on: { mousedown: api.focusInput },
    };
    const input: PartProps = {
      ...text,
      attrs: { ...text.attrs, ...control.attrs, ...state },
    };
    return {
      root: withState(parts.root),
      wrapper,
      label: withState(parts.label),
      input,
      description: withState(parts.description),
      error: withState(parts.error),
    };
  },
});
