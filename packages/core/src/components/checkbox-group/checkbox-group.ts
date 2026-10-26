/**
 * CheckboxGroup, from the approved spec (`./spec.md`): Field composed on a
 * `role="group"` root, and the `string[]` value its checkboxes read and
 * change through `ctx.owner()` (decision 11). The checkboxes stay Checkbox
 * instances; the group gives them their selected state, disabled and
 * read-only modes, and its required and invalid states and error.
 */

import { createFocusWithin, partEffect, partElement } from '../../dom';
import type { PartProps } from '../../runtime';
import { bindable, defineBehavior, event, prop } from '../../runtime';
import { formFieldProps, readFormProps } from '../field/binding';
import { field } from '../field/field';
import { formLink } from '../form/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

const isSame = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

export const checkboxGroup = defineBehavior({
  name: 'checkbox-group',
  parts: ['root', 'label', 'description', 'error', 'errorText'],
  links: [formLink],
  props: {
    value: bindable<readonly string[]>([], { attribute: false }),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    isRequired: prop(false),
    // Unset, a group in a form shows the form's state.
    isInvalid: prop<boolean | undefined>(undefined, { type: 'boolean' }),
    // A group can't be labelled natively. The element reads the label's tag.
    labelElementType: prop('span', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
    // `name` is written to every checkbox while set; unlike RadioGroup,
    // none is generated, since checkboxes don't need a shared name.
    ...formFieldProps,
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
        isReadOnly: props.isReadOnly(),
        labelElementType: props.labelElementType(),
        labelledBy: props.labelledBy(),
        describedBy: props.describedBy(),
      }),
      { parts: { control: 'root' } },
    );
    const focusWithin = createFocusWithin(ctx, {
      part: 'root',
      isDisabled: labelling.api.isDisabled,
    });
    const checkboxes = () =>
      Array.from(
        partElement(ctx, 'root')?.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"]',
        ) ?? [],
      );
    // In a form, the form holds the value (Form spec, Field binds).
    labelling.api.bindValue({
      value: props.value,
      link: (select) => ctx.link(formLink, select),
      props: () => readFormProps(props),
      toField: (value) =>
        Array.isArray(value) ? (value as readonly string[]) : [],
      kind: 'checkbox',
      defaultTrigger: 'change',
      isFocusWithin: focusWithin.isFocusWithin,
      focusTarget: () =>
        checkboxes().find((checkbox) => !checkbox.disabled) ?? null,
      submitControls: checkboxes,
      isControlSubmitted: false,
    });
    ctx.watch(focusWithin.isFocusWithin, (isFocusWithin) => {
      ctx.emit('focusChange', isFocusWithin);
    });

    // Until the first change, an uncontrolled group with no default takes
    // the values of the checkboxes that were checked when they linked: the
    // element's markup `checked`, or a click before upgrade.
    const adopted = ctx.state<readonly string[]>([]);
    let isPristine = true;
    const value = (): readonly string[] => {
      const current = props.value.get();
      return isPristine && !props.value.isControlled() && current.length === 0
        ? adopted.get()
        : current;
    };
    const setValue = (next: readonly string[]) => {
      isPristine = false;
      props.value.set(next);
    };

    // A newly selected value goes last, as in React Aria.
    const setSelected = (item: string, isSelected: boolean) => {
      const current = value();
      if (current.includes(item) === isSelected) return;
      setValue(
        isSelected
          ? [...current, item]
          : current.filter((selected) => selected !== item),
      );
    };

    // Form reset goes back to the default, as TextField's does: an
    // uncontrolled group follows defaultValue again, even one set after
    // mount, and without one the checkboxes it adopted; a controlled one
    // asks for it, or without one for the value it mounted with.
    let initial: readonly string[] | undefined;
    ctx.effect(() => {
      initial ??= value();
    });
    const adopt = (item: string) => {
      if (
        !isPristine ||
        props.value.isControlled() ||
        props.value.get().length > 0 ||
        adopted.get().includes(item)
      ) {
        return;
      }
      adopted.set([...adopted.get(), item]);
      initial = adopted.get();
    };
    partEffect(ctx, 'root', (element) => {
      const form = (element as HTMLElement).closest('form');
      if (!form) return;
      const onReset = (resetEvent: Event) => {
        if (resetEvent.defaultPrevented || !initial) return;
        // The checkboxes write their state again after the native reset.
        ctx.batch(() => {
          // Before the report, so its listeners read the adopted values.
          if (!props.value.isControlled()) isPristine = true;
          props.value.reset({
            fallback: initial,
            isEqual: isSame,
            readDefault: (raw) =>
              raw.length === 0 && !props.value.isControlled()
                ? adopted.get()
                : raw,
          });
        });
      };
      form.addEventListener('reset', onReset);
      return () => form.removeEventListener('reset', onReset);
    });

    return {
      field: labelling,
      isFocusWithin: focusWithin.isFocusWithin,
      isFocusVisible: focusWithin.isFocusVisible,
      /** `name` and `form` for each checkbox. */
      submitAttrs: labelling.api.submitAttrs,
      value,
      isSelected: (item: string) => value().includes(item),
      setSelected,
      adopt,
      /** A checkbox is required while the group is and nothing is selected. */
      isItemRequired: () => props.isRequired() && value().length === 0,
      /** The group's error, while shown, for each checkbox's description. */
      errorId: (): string | undefined =>
        labelling.api.isErrorShown() && labelling.api.isRendered('error')
          ? ctx.ids.error
          : undefined,
    };
  },
  expose({ props, api }) {
    return {
      value: api.value(),
      isDisabled: api.field.api.isDisabled(),
      isReadOnly: api.field.api.isReadOnly(),
      isRequired: props.isRequired(),
      isInvalid: api.field.api.isInvalid(),
      isErrorShown: api.field.api.isErrorShown(),
      isFocusWithin: api.isFocusWithin(),
      isFocusVisible: api.isFocusVisible(),
    };
  },
  connect({ api }) {
    const { root, control, ...parts } = api.field.connect();
    const isDisabled = api.field.api.isDisabled();
    // Every part, so the box around the group and its label can be styled.
    const state = {
      'data-readonly': flag(api.field.api.isReadOnly()),
      'data-focus-within': flag(api.isFocusWithin()),
      'data-focus-visible': flag(api.isFocusVisible()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    return {
      root: {
        attrs: {
          ...root.attrs,
          ...control.attrs,
          ...state,
          role: 'group',
          'aria-disabled': isDisabled ? 'true' : undefined,
          // Not read on a group: each checkbox carries them instead.
          'aria-invalid': undefined,
          'aria-required': undefined,
        },
      },
      // A group can't be labelled natively: no `for`, whatever the label's
      // tag.
      label: withState({ attrs: { ...parts.label.attrs, for: undefined } }),
      description: withState(parts.description),
      error: withState(parts.error),
      errorText: withState(parts.errorText),
    };
  },
});
