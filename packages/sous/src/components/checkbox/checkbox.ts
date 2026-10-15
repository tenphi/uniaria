/**
 * Checkbox, from the approved spec (`./spec.md`): Field composed on a native
 * `<input type="checkbox">`, plus the selected state (uncontrolled, or
 * controlled with a refused toggle put back after the event), presentational
 * indeterminate, read-only mode that cancels every toggle, form reset, and
 * hover and focus state on every part. The browser keeps doing the toggling.
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

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const checkbox = defineComponent({
  name: 'checkbox',
  parts: ['root', 'input', 'indicator', 'label', 'description', 'error'],
  props: {
    // The element adopts the input's checked state: the markup's `checked`,
    // or a click before upgrade.
    isSelected: bindable(false, {
      adopt: { part: 'input', property: 'checked' },
    }),
    isIndeterminate: prop(false),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    isInvalid: prop(false),
    // The element adopts the input's id on upgrade.
    inputId: prop<string | undefined>(undefined, {
      attribute: false,
      adopt: { part: 'input', attribute: 'id' },
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
    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: props.isInvalid(),
        isRequired: props.isRequired(),
        isDisabled: props.isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'input' } },
    );
    // The root is where a label root takes clicks; the input counts too, for
    // a checkbox without a root.
    const rootHover = createHover(ctx, {
      part: 'root',
      isDisabled: props.isDisabled,
    });
    const inputHover = createHover(ctx, {
      part: 'input',
      isDisabled: props.isDisabled,
    });
    const focus = createFocus(ctx, 'input');

    ctx.watch(focus.isFocused, (isFocused) => {
      ctx.emit('focusChange', isFocused);
    });

    // Bumped to write the state to the input again when the element and
    // the state may differ: after a refused toggle and after a form reset.
    const resync = ctx.state(0);
    const writeAgain = () => resync.set(resync.get() + 1);

    // A controlled toggle the consumer hasn't accepted once the event's work
    // is done goes back. The native `change` comes right after `input`, so
    // its listeners see the browser's toggle; the window sees it last.
    let isRefusing = false;
    const settle = () => {
      if (!isRefusing) return;
      isRefusing = false;
      writeAgain();
    };
    const settleAfterChange = (input: HTMLInputElement) => {
      const view = input.ownerDocument.defaultView;
      isRefusing = true;
      if (!view) return settle();
      view.addEventListener('change', settle, { once: true });
      // A listener that stops `change` keeps it from the window.
      view.setTimeout(() => {
        view.removeEventListener('change', settle);
        settle();
      });
    };

    // `input` fires only for a toggle that happened, never for a cancelled
    // click. React's `onChange` on a checkbox runs on `click` instead, and a
    // cancelled click leaves React's value tracker wrong.
    const onInput = (inputEvent: Event) => {
      const input = inputEvent.target as HTMLInputElement;
      if (input !== partElement(ctx, 'input')) return;
      if (props.isSelected.isControlled()) settleAfterChange(input);
      props.isSelected.set(input.checked);
    };

    // Read-only: the browser puts back `checked` and `indeterminate` after a
    // cancelled click, and fires no `input` or `change`.
    const onClick = (clickEvent: MouseEvent) => {
      if (clickEvent.target !== partElement(ctx, 'input')) return;
      if (props.isReadOnly()) clickEvent.preventDefault();
    };

    // Form reset goes back to the state the checkbox mounted with, its
    // defaultSelected when uncontrolled, as TextField's does.
    let initial: boolean | undefined;
    partEffect(ctx, 'input', (element) => {
      initial ??= props.isSelected.get();
      const form = (element as HTMLInputElement).form;
      if (!form) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented) return;
        ctx.batch(() => {
          isRefusing = false;
          props.isSelected.set(initial!);
        });
        // The native reset runs after this event and sets `checked` from the
        // attribute, so the state is written again after it.
        clearTimeout(timer);
        timer = setTimeout(writeAgain);
      };
      form.addEventListener('reset', onReset);
      return () => {
        form.removeEventListener('reset', onReset);
        clearTimeout(timer);
      };
    });

    return {
      field: labelling,
      isHovered: () => rootHover.isHovered() || inputHover.isHovered(),
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      rootHandlers: rootHover.handlers,
      handlers: mergeHandlers(inputHover.handlers, focus.handlers, {
        input: onInput,
        click: onClick,
      }),
    };
  },
  expose({ props, api }) {
    return {
      isSelected: props.isSelected.get(),
      isIndeterminate: props.isIndeterminate(),
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
    const isSelected = props.isSelected.get();
    const isIndeterminate = props.isIndeterminate();
    const isReadOnly = props.isReadOnly();
    // Every part, so the box, the label and the messages can be styled.
    const state = {
      'data-selected': flag(isSelected),
      'data-indeterminate': flag(isIndeterminate),
      'data-hovered': flag(api.isHovered()),
      'data-focused': flag(api.isFocused()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-readonly': flag(isReadOnly),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    const root: DomPartProps = {
      attrs: { ...parts.root.attrs, ...state },
      on: api.rootHandlers,
    };
    const input: DomPartProps = {
      attrs: {
        ...control.attrs,
        ...state,
        type: 'checkbox',
        disabled: flag(props.isDisabled()),
        // Not `readonly`: HTML ignores it on a checkbox, and it takes the
        // checkbox out of constraint validation.
        'aria-readonly': isReadOnly ? 'true' : undefined,
      },
      on: api.handlers,
      // Never `aria-checked`: browsers read these properties on a native
      // checkbox and ignore it.
      properties: { checked: isSelected, indeterminate: isIndeterminate },
    };
    // Not a Field part, so it takes Field's state attributes from the root.
    const indicator: PartProps = {
      attrs: {
        'aria-hidden': 'true',
        'data-invalid': parts.root.attrs['data-invalid'],
        'data-required': parts.root.attrs['data-required'],
        'data-disabled': parts.root.attrs['data-disabled'],
        ...state,
      },
    };
    return {
      root,
      input,
      indicator,
      label: withState(parts.label),
      description: withState(parts.description),
      error: withState(parts.error),
    };
  },
});
