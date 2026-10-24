/**
 * The core Checkbox and Switch share (`./spec.md`, `../switch/spec.md`): Field
 * composed on a native `<input type="checkbox">`, plus the selected state
 * (uncontrolled, or controlled with a refused toggle put back after the
 * event), read-only mode that cancels every toggle, a disabled control that
 * stays focusable, form reset, and hover and focus state on every part. The browser keeps doing the toggling.
 * Checkbox adds its indeterminate state and its group on top; Switch, its
 * role.
 */

import {
  createFocus,
  createHover,
  createPressFocus,
  mergeHandlers,
  partEffect,
  partElement,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type {
  BindableSpec,
  EventSpec,
  PartProps,
  PropSpec,
  PropsSchema,
  SetupContext,
} from '../../runtime';
import { field } from '../field/field';
import { linkTooltip } from '../tooltip/link';

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

type TogglePart =
  | 'root'
  | 'wrapper'
  | 'input'
  | 'indicator'
  | 'label'
  | 'description'
  | 'error';

/** The props both definitions declare. */
interface ToggleSchema extends PropsSchema {
  readonly isSelected: BindableSpec<boolean>;
  readonly isDisabled: PropSpec<boolean>;
  readonly isFocusableWhenDisabled: PropSpec<boolean>;
  readonly isReadOnly: PropSpec<boolean>;
  readonly isRequired: PropSpec<boolean>;
  readonly isInvalid: PropSpec<boolean>;
  readonly inputId: PropSpec<string | undefined>;
  readonly labelElementType: PropSpec<string>;
  readonly labelledBy: PropSpec<string | undefined>;
  readonly describedBy: PropSpec<string | undefined>;
}

/** A definition that takes a tooltip (`links: [tooltipLink]`). */
type ToggleContext = SetupContext<
  TogglePart,
  ToggleSchema,
  { readonly focusChange: EventSpec<boolean> }
>;

/** The selected state when something else holds it: a checkbox's group. */
export interface ExternalSelection {
  isSelected(): boolean;
  setSelected(isSelected: boolean): void;
}

/** Where the state comes from when it isn't only the props. */
export interface ToggleOptions {
  /** Read, set and reset there instead of `isSelected`, while it exists. */
  readonly external?: () => ExternalSelection | undefined;
  readonly isDisabled?: () => boolean;
  readonly isReadOnly?: () => boolean;
  readonly isInvalid?: () => boolean;
  readonly isRequired?: () => boolean;
  readonly describedBy?: () => string | undefined;
}

export function createToggle(ctx: ToggleContext, options: ToggleOptions = {}) {
  const { props } = ctx;
  const external = options.external ?? (() => undefined);
  const isSelected = () => external()?.isSelected() ?? props.isSelected.get();
  const isDisabled = options.isDisabled ?? props.isDisabled;
  const isReadOnly = options.isReadOnly ?? props.isReadOnly;
  const isInvalid = options.isInvalid ?? props.isInvalid;
  const isRequired = options.isRequired ?? props.isRequired;
  const describedBy = options.describedBy ?? props.describedBy;
  // Focusable while disabled: never toggles, and never submitted.
  const isInert = () => isDisabled() && props.isFocusableWhenDisabled();
  // Hover from the wrapper, else the root; focus and presses from the input
  // (Tooltip spec, Resolved questions 2).
  const tooltip = linkTooltip(ctx, {
    hover: ['wrapper', 'root'],
    focus: 'input',
    text: ['label', 'description'],
    textFallback: null,
  });

  const labelling = ctx.use(
    field,
    () => ({
      isInvalid: isInvalid(),
      isRequired: isRequired(),
      isDisabled: isDisabled(),
      controlId: props.inputId(),
      labelElementType: props.labelElementType(),
      labelledBy: references(props.labelledBy(), tooltip.labelledBy()),
      describedBy: references(describedBy(), tooltip.describedBy()),
    }),
    { parts: { control: 'input' } },
  );

  // The wrapper is the label area that takes clicks, or the root when there
  // is no wrapper; the input counts too, for a control without either.
  const wrapperHover = createHover(ctx, { part: 'wrapper', isDisabled });
  const rootHover = createHover(ctx, { part: 'root', isDisabled });
  const inputHover = createHover(ctx, { part: 'input', isDisabled });
  // The area hovered: the wrapper, or without one the root.
  const areaHover = () =>
    partElement(ctx, 'wrapper') ? wrapperHover : rootHover;
  const focus = createFocus(ctx, 'input');
  // A press on the input or a label focuses it in every browser.
  const pressFocus = createPressFocus(ctx, 'input');

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
    const selection = external();
    if (selection) {
      // A controlled group follows the same rule as a controlled input.
      settleAfterChange(input);
      selection.setSelected(input.checked);
      return;
    }
    if (props.isSelected.isControlled()) settleAfterChange(input);
    props.isSelected.set(input.checked);
  };

  // Read-only and a focusable disabled control: the browser puts back
  // `checked` and `indeterminate` after a cancelled click, and fires no
  // `input` or `change`.
  const onClick = (clickEvent: MouseEvent) => {
    if (clickEvent.target !== partElement(ctx, 'input')) return;
    if (isReadOnly() || isInert()) clickEvent.preventDefault();
  };

  // Form reset goes back to the default, as TextField's does: an
  // uncontrolled toggle follows defaultSelected again; a controlled one asks
  // for it, or without one for the state the input mounted with.
  let initial: boolean | undefined;
  partEffect(ctx, 'input', (element) => {
    initial ??= props.isSelected.get();
    const form = (element as HTMLInputElement).form;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onReset = (resetEvent: Event) => {
      if (resetEvent.defaultPrevented) return;
      // External state resets itself; it is written again below.
      if (!external()) {
        ctx.batch(() => {
          isRefusing = false;
          props.isSelected.reset({ fallback: initial });
        });
      }
      // The native reset runs after this event and sets `checked` from the
      // attribute, so the state is written again after it.
      clearTimeout(timer);
      timer = setTimeout(writeAgain);
    };
    // A focusable disabled control isn't submitted, as a natively disabled
    // one isn't: its entry comes out of the form's data, others of the same
    // name stay.
    const onFormData = (formDataEvent: FormDataEvent) => {
      const input = element as HTMLInputElement;
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
    form.addEventListener('reset', onReset);
    form.addEventListener('formdata', onFormData);
    return () => {
      form.removeEventListener('reset', onReset);
      form.removeEventListener('formdata', onFormData);
      clearTimeout(timer);
    };
  });

  return {
    field: labelling,
    isSelected,
    isDisabled,
    isInert,
    isReadOnly,
    isInvalid,
    isRequired,
    isHovered: () => areaHover().isHovered() || inputHover.isHovered(),
    isFocused: focus.isFocused,
    isFocusVisible: focus.isFocusVisible,
    rootHandlers: mergeHandlers(rootHover.handlers, pressFocus.handlers),
    wrapperHandlers: mergeHandlers(wrapperHover.handlers, pressFocus.handlers),
    labelHandlers: pressFocus.handlers,
    handlers: mergeHandlers(
      inputHover.handlers,
      focus.handlers,
      {
        input: onInput,
        click: onClick,
      },
      pressFocus.handlers,
    ),
  };
}

export type Toggle = ReturnType<typeof createToggle>;

/** The public state both definitions expose. */
export function toggleState(toggle: Toggle) {
  return {
    isSelected: toggle.isSelected(),
    isFocused: toggle.isFocused(),
    isFocusVisible: toggle.isFocusVisible(),
    isHovered: toggle.isHovered(),
    isDisabled: toggle.isDisabled(),
    isReadOnly: toggle.isReadOnly(),
    isRequired: toggle.isRequired(),
    isInvalid: toggle.isInvalid(),
    isErrorShown: toggle.field.state().isErrorShown,
  };
}

/** What a definition adds to the shared parts. */
export interface ToggleExtras {
  /** State attributes for every part. */
  readonly state?: Readonly<Record<string, string | undefined>>;
  /** Attributes for the input. */
  readonly input?: Readonly<Record<string, string | undefined>>;
  /** Live properties for the input. */
  readonly properties?: Readonly<Record<string, unknown>>;
}

/** The parts both definitions connect, with a definition's extras. */
export function connectToggle(toggle: Toggle, extras: ToggleExtras = {}) {
  const { control, ...parts } = toggle.field.connect();
  const isSelected = toggle.isSelected();
  const isReadOnly = toggle.isReadOnly();
  // Every part, so the box, the label and the messages can be styled.
  const state = {
    'data-selected': flag(isSelected),
    ...extras.state,
    'data-hovered': flag(toggle.isHovered()),
    'data-focused': flag(toggle.isFocused()),
    'data-focus-visible': flag(toggle.isFocusVisible()),
    'data-readonly': flag(isReadOnly),
  };
  const withState = (part: PartProps): PartProps => ({
    ...part,
    attrs: { ...part.attrs, ...state },
  });
  const root: DomPartProps = {
    attrs: { ...parts.root.attrs, ...state },
    on: toggle.rootHandlers,
  };
  // The label area inside the root; Field's state attributes as on the root.
  const wrapper: DomPartProps = {
    attrs: { ...parts.root.attrs, ...state },
    on: toggle.wrapperHandlers,
  };
  const input: DomPartProps = {
    attrs: {
      ...control.attrs,
      ...state,
      type: 'checkbox',
      ...extras.input,
      disabled: flag(toggle.isDisabled() && !toggle.isInert()),
      'aria-disabled': toggle.isInert() ? 'true' : undefined,
      // Not `readonly`: HTML ignores it on a checkbox, and it takes the
      // input out of constraint validation.
      'aria-readonly': isReadOnly ? 'true' : undefined,
    },
    on: toggle.handlers,
    // Never `aria-checked`: browsers read these properties on a native
    // checkbox and ignore it.
    properties: { checked: isSelected, ...extras.properties },
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
    wrapper,
    input,
    indicator,
    label: { ...withState(parts.label), on: toggle.labelHandlers },
    description: withState(parts.description),
    error: withState(parts.error),
  };
}
