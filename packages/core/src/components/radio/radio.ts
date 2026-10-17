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
  isDevelopment,
  mergeHandlers,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { PartProps } from '../../runtime';
import { defineComponent, event, prop } from '../../runtime';
import { field } from '../field/field';
import { radioGroup } from '../radio-group/radio-group';
import { linkTooltip, tooltipLink } from '../tooltip/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

export const radio = defineComponent({
  name: 'radio',
  parts: ['root', 'input', 'indicator', 'label', 'description'],
  owner: { definition: radioGroup, attribute: 'group' },
  links: [tooltipLink],
  props: {
    // The key in the group's value, written to the input's `value`.
    value: prop<string | undefined>(undefined, { type: 'string' }),
    isDisabled: prop(false),
    // As Button's: `aria-disabled` instead of `disabled`, so a tooltip can
    // explain it.
    isFocusableWhenDisabled: prop(false),
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
    // Hover from the root, focus and presses from the input (Tooltip spec,
    // Resolved questions 2).
    const tooltip = linkTooltip(ctx, { hover: 'root', focus: 'input' });

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

    // The root is where a label root takes clicks; the input counts too, for
    // a radio without a root.
    const rootHover = createHover(ctx, { part: 'root', isDisabled });
    const inputHover = createHover(ctx, { part: 'input', isDisabled });
    const focus = createFocus(ctx, 'input');
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
    partEffect(ctx, 'input', joinChecked);
    ctx.watch(() => group()?.instance, joinChecked);

    return {
      field: labelling,
      group,
      isSelected,
      isDisabled,
      isReadOnly,
      isInvalid,
      isInert,
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
      input,
      // Not a Field part, so it takes Field's state attributes from the root.
      indicator: {
        attrs: {
          'aria-hidden': 'true',
          'data-disabled': parts.root.attrs['data-disabled'],
          ...state,
        },
      },
      label: withState(parts.label),
      description: withState(parts.description),
    };
  },
});
