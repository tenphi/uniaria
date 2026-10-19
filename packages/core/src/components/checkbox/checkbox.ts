/**
 * Checkbox, from the approved spec (`./spec.md`): Field composed on a native
 * `<input type="checkbox">`, plus the selected state (uncontrolled, or
 * controlled with a refused toggle put back after the event), presentational
 * indeterminate, read-only mode that cancels every toggle, form reset, and
 * hover and focus state on every part, from the core it shares with Switch
 * (`./toggle.ts`). In a CheckboxGroup (`../checkbox-group/spec.md`), found
 * through `ctx.owner()`, the group holds the selected state and adds its
 * modes, required and invalid states and error.
 */

import { isDevelopment, partEffect, partElement, warn } from '../../dom';
import { bindable, defineComponent, event, prop } from '../../runtime';
import { checkboxGroup } from '../checkbox-group/checkbox-group';
import { tooltipLink } from '../tooltip/link';
import { connectToggle, createToggle, toggleState } from './toggle';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const checkbox = defineComponent({
  name: 'checkbox',
  parts: [
    'root',
    'wrapper',
    'input',
    'indicator',
    'label',
    'description',
    'error',
  ],
  links: [tooltipLink],
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
    // As Radio's: `aria-disabled` instead of `disabled`, so a tooltip can
    // explain it (Tooltip spec, Resolved questions 12).
    isFocusableWhenDisabled: prop(false),
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
    // The group's value holds the selected state, keyed by this value.
    const selection = ctx.memo(
      () => [group(), props.value()] as const,
      (owner, value) =>
        owner && value !== undefined
          ? {
              isSelected: () => owner.api.isSelected(value),
              setSelected: (isSelected: boolean) =>
                owner.api.setSelected(value, isSelected),
            }
          : undefined,
    );
    const toggle = createToggle(ctx, {
      external: selection,
      isDisabled: () =>
        props.isDisabled() || (group()?.state().isDisabled ?? false),
      isReadOnly: () =>
        props.isReadOnly() || (group()?.state().isReadOnly ?? false),
      isInvalid: () =>
        props.isInvalid() || (group()?.state().isInvalid ?? false),
      isRequired: () =>
        props.isRequired() || (group()?.api.isItemRequired() ?? false),
      // The group's error explains an invalid checkbox wherever focus is.
      describedBy: () =>
        [props.describedBy(), group()?.api.errorId()]
          .filter(Boolean)
          .join(' ') || undefined,
    });

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

    return { ...toggle, groupName: () => group()?.api.name() };
  },
  expose({ props, api }) {
    return { ...toggleState(api), isIndeterminate: props.isIndeterminate() };
  },
  connect({ props, api }) {
    const isIndeterminate = props.isIndeterminate();
    const value = props.value();
    const name = api.groupName();
    return connectToggle(api, {
      state: { 'data-indeterminate': flag(isIndeterminate) },
      // Only when set: otherwise the consumer may write them.
      input: {
        ...(value === undefined ? {} : { value }),
        ...(name === undefined ? {} : { name }),
      },
      properties: { indeterminate: isIndeterminate },
    });
  },
});
