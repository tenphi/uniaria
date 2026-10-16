/**
 * Checkbox, from the approved spec (`./spec.md`): Field composed on a native
 * `<input type="checkbox">`, plus the selected state (uncontrolled, or
 * controlled with a refused toggle put back after the event), presentational
 * indeterminate, read-only mode that cancels every toggle, form reset, and
 * hover and focus state on every part. The browser keeps doing the toggling.
 * In a CheckboxGroup (`../checkbox-group/spec.md`), found through
 * `ctx.owner()`, the group holds the selected state and adds its modes,
 * required and invalid states and error.
 */

import {
  createFocus,
  createHover,
  isDevelopment,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { checkboxGroup } from '../checkbox-group/checkbox-group';
import { field } from '../field/field';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const checkbox = defineComponent({
  name: 'checkbox',
  parts: ['root', 'input', 'indicator', 'label', 'description', 'error'],
  owner: { definition: checkboxGroup, attribute: 'group' },
  props: {
    // The key in a group's value, written to the input's `value`.
    value: prop<string | undefined>(undefined, { type: 'string' }),
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
    // The group, when this checkbox is in one with a value to put in it.
    const group = () => {
      const owner = ctx.owner(checkboxGroup);
      return owner && props.value() !== undefined ? owner : undefined;
    };
    const isSelected = () => {
      const owner = group();
      return owner
        ? owner.api.isSelected(props.value()!)
        : props.isSelected.get();
    };
    const isDisabled = () =>
      props.isDisabled() || (group()?.state().isDisabled ?? false);
    const isReadOnly = () =>
      props.isReadOnly() || (group()?.state().isReadOnly ?? false);
    const isInvalid = () =>
      props.isInvalid() || (group()?.state().isInvalid ?? false);
    const isRequired = () =>
      props.isRequired() || (group()?.api.isItemRequired() ?? false);

    const labelling = ctx.use(
      field,
      () => ({
        isInvalid: isInvalid(),
        isRequired: isRequired(),
        isDisabled: isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        // The group's error explains an invalid checkbox wherever focus is.
        describedBy:
          [props.describedBy(), group()?.api.errorId()]
            .filter(Boolean)
            .join(' ') || undefined,
      }),
      { parts: { control: 'input' } },
    );

    if (isDevelopment()) {
      ctx.watch(
        () => ctx.owner(checkboxGroup)?.instance,
        (owner) => {
          if (!owner) return;
          if (props.value() === undefined) {
            warn(
              'checkbox: a checkbox in a group needs a value, the key it adds ' +
                "to the group's value.",
            );
          } else if (props.isSelected.isControlled()) {
            warn(
              'checkbox: isSelected is unused in a group, whose value holds ' +
                'the selected checkboxes. Set the value on the group.',
            );
          }
        },
      );
    }
    // The root is where a label root takes clicks; the input counts too, for
    // a checkbox without a root.
    const rootHover = createHover(ctx, { part: 'root', isDisabled });
    const inputHover = createHover(ctx, { part: 'input', isDisabled });
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
      const owner = group();
      if (owner) {
        // A controlled group follows the same rule as a controlled checkbox.
        settleAfterChange(input);
        owner.api.setSelected(props.value()!, input.checked);
        return;
      }
      if (props.isSelected.isControlled()) settleAfterChange(input);
      props.isSelected.set(input.checked);
    };

    // Read-only: the browser puts back `checked` and `indeterminate` after a
    // cancelled click, and fires no `input` or `change`.
    const onClick = (clickEvent: MouseEvent) => {
      if (clickEvent.target !== partElement(ctx, 'input')) return;
      if (isReadOnly()) clickEvent.preventDefault();
    };

    // A checkbox checked when it joins a group (the element's markup, or a
    // click before upgrade) adds its value to the group's default.
    const joinChecked = () => {
      const input = partElement(ctx, 'input') as HTMLInputElement | null;
      const owner = group();
      if (input?.checked && owner && !owner.api.isSelected(props.value()!)) {
        owner.api.adopt(props.value()!);
      }
    };
    partEffect(ctx, 'input', joinChecked);
    ctx.watch(() => group()?.instance, joinChecked);

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
        // In a group, the group resets; the state is written again below.
        if (!group()) {
          ctx.batch(() => {
            isRefusing = false;
            props.isSelected.set(initial!);
          });
        }
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
      isSelected,
      isDisabled,
      isReadOnly,
      isInvalid,
      isRequired,
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
      isSelected: api.isSelected(),
      isIndeterminate: props.isIndeterminate(),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isHovered: api.isHovered(),
      isDisabled: api.isDisabled(),
      isReadOnly: api.isReadOnly(),
      isRequired: api.isRequired(),
      isInvalid: api.isInvalid(),
      isErrorShown: api.field.state().isErrorShown,
    };
  },
  connect({ props, api }) {
    const { control, ...parts } = api.field.connect();
    const isSelected = api.isSelected();
    const isIndeterminate = props.isIndeterminate();
    const isReadOnly = api.isReadOnly();
    const value = props.value();
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
        // Only when set: otherwise the consumer may write it.
        ...(value === undefined ? {} : { value }),
        disabled: flag(api.isDisabled()),
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
