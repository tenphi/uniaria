/**
 * Radio, from the approved RadioGroup spec (`../radio-group/spec.md`): a
 * native `<input type="radio">` that finds its group through `ctx.owner()`
 * and takes from it its checked state, its `name` and the group's modes.
 * Field labels it and links its description and the group's error; a radio
 * has no error of its own, so Field's error part is left out.
 */

import {
  createFocus,
  createHover,
  createPressFocus,
  isDevelopment,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { defineBehavior, event, prop } from '../../runtime';
import { field } from '../field/field';
import { radioGroup } from '../radio-group/radio-group';
import { linkTooltip, tooltipLink } from '../tooltip/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const radio = defineBehavior({
  name: 'radio',
  parts: ['root', 'wrapper', 'input', 'indicator', 'label', 'description'],
  owner: { definition: radioGroup, attribute: 'group' },
  links: [tooltipLink],
  props: {
    // The key in the group's value, written to the input's `value`.
    value: prop<string | undefined>(undefined, { type: 'string' }),
    isDisabled: prop(false),
    // As Button's: `aria-disabled` instead of `disabled`, so a tooltip can
    // explain it.
    isFocusableWhenDisabled: prop(false),
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
    const group = () => ctx.owner(radioGroup);
    const isSelected = () => {
      const value = props.value();
      return value !== undefined && (group()?.api.isSelected(value) ?? false);
    };
    const isDisabled = () =>
      props.isDisabled() || (group()?.state().isDisabled ?? false);
    const isReadOnly = () => group()?.state().isReadOnly ?? false;
    const isInvalid = () => group()?.state().isInvalid ?? false;
    // Focusable while disabled: never selected, by click or arrow key.
    const isInert = () => isDisabled() && props.isFocusableWhenDisabled();
    // Hover from the wrapper, else the root; focus and presses from the
    // input (Tooltip spec, Resolved questions 2).
    const tooltip = linkTooltip(ctx, {
      hover: ['wrapper', 'root'],
      focus: 'input',
      text: ['label', 'description'],
      textFallback: null,
    });

    const labelling = ctx.use(
      field,
      () => ({
        // Required and invalid are the group's, on the radiogroup.
        isDisabled: isDisabled(),
        controlId: props.inputId(),
        labelElementType: props.labelElementType(),
        labelledBy:
          [props.labelledBy(), tooltip.labelledBy()]
            .filter(Boolean)
            .join(' ') || undefined,
        // The group's error explains an invalid group wherever focus is.
        describedBy:
          [props.describedBy(), group()?.api.errorId(), tooltip.describedBy()]
            .filter(Boolean)
            .join(' ') || undefined,
      }),
      { parts: { control: 'input', error: null } },
    );

    if (isDevelopment()) {
      ctx.watch(
        () => group()?.instance,
        (owner) => {
          if (owner && props.value() === undefined) {
            warn(
              "radio: a radio needs a value, the group's value while it is " +
                'selected.',
            );
          }
        },
      );
      // The owner may link after start (the DOM request), so the check waits.
      ctx.effect(() => {
        const timer = setTimeout(() => {
          if (!group()) {
            warn('radio: no RadioGroup found; a radio works only in one.');
          }
        });
        return () => clearTimeout(timer);
      });
    }

    // The wrapper is the label area that takes clicks, or the root when
    // there is no wrapper; the input counts too, for a radio without either.
    const wrapperHover = createHover(ctx, { part: 'wrapper', isDisabled });
    const rootHover = createHover(ctx, { part: 'root', isDisabled });
    const inputHover = createHover(ctx, { part: 'input', isDisabled });
    const areaHover = () =>
      partElement(ctx, 'wrapper') ? wrapperHover : rootHover;
    const focus = createFocus(ctx, 'input');
    // A press on the input or a label focuses it in every browser.
    const pressFocus = createPressFocus(ctx, 'input');
    ctx.watch(focus.isFocused, (isFocused) => {
      ctx.emit('focusChange', isFocused);
    });

    // Registered while linked, so the group knows which values have a radio.
    const link = ctx.memo(
      () => [group(), props.value()] as const,
      (owner, value) => ({ owner, value }),
    );
    let unregister: (() => void) | undefined;
    const register = () => {
      unregister?.();
      unregister = undefined;
      const { owner, value } = link();
      if (owner && value !== undefined) unregister = owner.api.register(value);
    };
    ctx.watch(link, register);
    ctx.effect(() => {
      register();
      return () => {
        unregister?.();
        unregister = undefined;
      };
    });

    // `input` fires only on the radio the browser checked, never for a
    // cancelled click.
    const onInput = (inputEvent: Event) => {
      const input = inputEvent.target as HTMLInputElement;
      const value = props.value();
      if (input !== partElement(ctx, 'input') || value === undefined) return;
      if (input.checked) group()?.api.select(value, input);
    };

    // Read-only and a focusable disabled radio: the browser restores the
    // previous radio after a cancelled click and fires no `input`.
    const onClick = (clickEvent: MouseEvent) => {
      if (clickEvent.target !== partElement(ctx, 'input')) return;
      if (isReadOnly() || isInert()) clickEvent.preventDefault();
    };

    // A radio checked when it joins its group (the element's markup, or a
    // click before upgrade) gives the group its default.
    const joinChecked = () => {
      const input = partElement(ctx, 'input') as HTMLInputElement | null;
      const value = props.value();
      if (input?.checked && value !== undefined && !isSelected()) {
        group()?.api.adopt(value);
      }
    };
    // Read as it attaches, before the binder writes the group's state to it.
    ctx.effect(joinChecked);
    ctx.watch(() => partElement(ctx, 'input'), joinChecked);
    ctx.watch(() => group()?.instance, joinChecked);

    // A focusable disabled radio isn't submitted, as a natively disabled one
    // isn't (Checkbox's rule): its entry comes out of the form's data, others
    // of the same name stay.
    partEffect(ctx, 'input', (element) => {
      const input = element as HTMLInputElement;
      const form = input.form;
      if (!form) return;
      const onFormData = (formDataEvent: FormDataEvent) => {
        if (!isInert() || !input.checked || !input.name) return;
        const { formData } = formDataEvent;
        const values = formData.getAll(input.name);
        const index = values.indexOf(input.value);
        if (index === -1) return;
        formData.delete(input.name);
        values.forEach((value, at) => {
          if (at !== index) formData.append(input.name, value);
        });
      };
      form.addEventListener('formdata', onFormData);
      return () => form.removeEventListener('formdata', onFormData);
    });

    return {
      field: labelling,
      group,
      isSelected,
      isDisabled,
      isReadOnly,
      isInvalid,
      isInert,
      isHovered: () => areaHover().isHovered() || inputHover.isHovered(),
      isFocused: focus.isFocused,
      isFocusVisible: focus.isFocusVisible,
      rootHandlers: mergeHandlers(rootHover.handlers, pressFocus.handlers),
      wrapperHandlers: mergeHandlers(
        wrapperHover.handlers,
        pressFocus.handlers,
      ),
      labelHandlers: pressFocus.handlers,
      handlers: mergeHandlers(
        inputHover.handlers,
        focus.handlers,
        {
          input: onInput,
          click: onClick,
          // The group's arrow keys reach a radio linked from outside its
          // root.
          keydown: (keyEvent: KeyboardEvent) =>
            group()?.api.onRadioKeyDown(keyEvent),
        },
        pressFocus.handlers,
      ),
    };
  },
  expose({ api }) {
    return {
      isSelected: api.isSelected(),
      isFocused: api.isFocused(),
      isFocusVisible: api.isFocusVisible(),
      isHovered: api.isHovered(),
      isDisabled: api.isDisabled(),
      isReadOnly: api.isReadOnly(),
      isInvalid: api.isInvalid(),
    };
  },
  connect({ props, api }) {
    const { control, ...parts } = api.field.connect();
    const owner = api.group();
    const value = props.value();
    const isSelected = api.isSelected();
    const isDisabled = api.isDisabled();
    const isInert = api.isInert();
    // Every part, so the circle, the label and the description can be
    // styled; read-only and invalid are the group's.
    const state = {
      'data-selected': flag(isSelected),
      'data-hovered': flag(api.isHovered()),
      'data-focused': flag(api.isFocused()),
      'data-focus-visible': flag(api.isFocusVisible()),
      'data-readonly': flag(api.isReadOnly()),
      'data-invalid': flag(api.isInvalid()),
    };
    const withState = (part: PartProps): PartProps => ({
      ...part,
      attrs: { ...part.attrs, ...state },
    });
    // A roving tab stop: the selected radio, or every radio when none is.
    const tabIndex =
      !owner || value === undefined || (isDisabled && !isInert)
        ? undefined
        : owner.api.isTabStop(value)
          ? '0'
          : '-1';
    const input: DomPartProps = {
      attrs: {
        ...control.attrs,
        ...state,
        type: 'radio',
        // Only once known: until then the consumer's stay.
        ...(owner ? { name: owner.api.name() } : {}),
        ...(value === undefined ? {} : { value }),
        ...(tabIndex === undefined ? {} : { tabindex: tabIndex }),
        disabled: flag(isDisabled && !isInert),
        'aria-disabled': isInert ? 'true' : undefined,
      },
      on: api.handlers,
      // Never `aria-checked`: browsers ignore it on a native radio.
      properties: { checked: isSelected },
    };
    return {
      root: {
        attrs: { ...parts.root.attrs, ...state },
        on: api.rootHandlers,
      },
      // The label area inside the root; Field's state attributes as on the
      // root.
      wrapper: {
        attrs: { ...parts.root.attrs, ...state },
        on: api.wrapperHandlers,
      },
      input,
      // Not a Field part, so it takes Field's state attributes from the root.
      indicator: {
        attrs: {
          'aria-hidden': 'true',
          'data-disabled': parts.root.attrs['data-disabled'],
          ...state,
        },
      },
      label: { ...withState(parts.label), on: api.labelHandlers },
      description: withState(parts.description),
    };
  },
});
