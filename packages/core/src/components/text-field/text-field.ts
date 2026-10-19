/**
 * TextField, from the approved spec (`./spec.md`): Field composed on a native
 * `<input>` or `<textarea>`, plus the value (uncontrolled, or controlled and
 * buffered as Cube UI Kit's is), read-only mode, form reset, hover and focus
 * state on every part, and a press on the wrapper that focuses the input.
 * The browser keeps doing the editing.
 */

import {
  createFocus,
  createHover,
  mergeHandlers,
  partEffect,
  partElement,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { field } from '../field/field';
import { linkTooltip, tooltipLink } from '../tooltip/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Elements inside the wrapper that keep their own press. */
const CONTROLS =
  'a[href], button, input, select, textarea, label, [contenteditable], [tabindex]';

export const textField = defineComponent({
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
    const tooltip = linkTooltip(ctx, { hover: 'input', focus: 'input' });
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
    const hover = createHover(ctx, {
      part: 'input',
      isDisabled: props.isDisabled,
    });
    const focus = createFocus(ctx, 'input');

    // Cube UI Kit's buffered value: while a controlled consumer hasn't
    // answered, the input keeps the typed text (the draft). The values
    // reported and not yet echoed back are pending, oldest first.
    const draft = ctx.state<string | undefined>(undefined);
    let pending: string[] = [];
    const shown = () => draft.get() ?? props.value.get();
    const settle = () => {
      pending = [];
      draft.set(undefined);
    };

    // An echo of a reported value keeps the draft until the latest one
    // arrives; any other value (a transform, a value from outside) wins.
    ctx.watch(
      () => props.value.get(),
      (value) => {
        const index = pending.indexOf(value);
        if (index === -1) return settle();
        pending = pending.slice(index + 1);
        if (pending.length === 0) draft.set(undefined);
      },
    );

    // A value the consumer never accepted goes back on blur.
    ctx.watch(focus.isFocused, (isFocused) => {
      if (!isFocused) settle();
      ctx.emit('focusChange', isFocused);
    });

    // Writing the value mid-composition breaks the IME, so it waits.
    const isComposing = ctx.state(false);

    const onInput = () => {
      const input = partElement(ctx, 'input') as HTMLInputElement | null;
      if (!input) return;
      const text = input.value;
      if (props.value.isControlled()) {
        pending.push(text);
        draft.set(text);
      }
      props.value.set(text);
    };

    // Form reset goes back to the default, as a native field does: an
    // uncontrolled field follows defaultValue again, even one set after
    // mount; a controlled one asks for it, or without one for the value it
    // mounted with, as React Aria's does.
    let initial: string | undefined;
    const resync = ctx.state(0);
    partEffect(ctx, 'input', (element) => {
      initial ??= props.value.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (event: Event) => {
        if (event.defaultPrevented) return;
        ctx.batch(() => {
          settle();
          props.value.reset({ fallback: initial });
        });
        // The native reset runs after this event and puts back the value
        // attribute, so the value is written again after it.
        clearTimeout(timer);
        timer = setTimeout(() => resync.set(resync.get() + 1));
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(timer);
      };
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

    return {
      field: labelling,
      isHovered: hover.isHovered,
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      isComposing: () => isComposing.get(),
      shown,
      focusInput,
      handlers: mergeHandlers(hover.handlers, focus.handlers, {
        input: onInput,
        compositionstart: () => isComposing.set(true),
        compositionend: () => isComposing.set(false),
      }),
    };
  },
  expose({ props, api }) {
    return {
      value: props.value.get(),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isHovered: api.isHovered(),
      isDisabled: props.isDisabled(),
      isReadOnly: props.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: props.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
    };
  },
  connect({ props, api }) {
    const { control, ...parts } = api.field.connect();
    const isDisabled = props.isDisabled();
    const isReadOnly = props.isReadOnly();
    // Every part, so the box, the label and the messages can be styled.
    const state = {
      'data-hovered': flag(api.isHovered()),
      'data-focused': flag(api.isFocused()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-readonly': flag(isReadOnly),
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
    const input: DomPartProps = {
      attrs: {
        ...control.attrs,
        ...state,
        disabled: flag(isDisabled),
        readonly: flag(isReadOnly),
      },
      on: api.handlers,
      properties: { value: api.isComposing() ? undefined : api.shown() },
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
