/**
 * Field, from the approved spec (`./spec.md`): gives any control its label,
 * description and error message, wires them together with ids and ARIA, and
 * announces a new error. UniAria inputs compose it with
 * `ctx.use(field, props, { parts: { control: 'input' } })`.
 *
 * Field also binds a field to its form (Form spec, Field binds): a composing
 * field hands it its value (`api.bindValue()`), and Field alone binds its
 * own `value`, following a native control. While bound, the value is the
 * form's under the field's name, the form decides `isInvalid` unless the
 * consumer sets it, and Field shows the form's first error in `errorText`.
 * The checks run in the form; Field registers what they need.
 */

import {
  announce,
  isDevelopment,
  partEffect,
  partElement,
  warn,
} from '../../dom';
import type { DomPartProps } from '../../dom';
import type { Bindable, Linked } from '../../runtime';
import { bindable, defineBehavior, prop } from '../../runtime';
import type { ControlKind } from '../form/constraints';
import { formLink } from '../form/link';
import type {
  FieldRegistration,
  FieldStatus,
  FieldView,
  FormLinkApi,
} from '../form/link';
import { keyOf, pathOf } from '../form/values';
import type { Path } from '../form/values';
import { formFieldProps, readFormProps } from './binding';
import type { FieldBinding, FormFieldProps } from './binding';

type FieldPart =
  'root' | 'label' | 'control' | 'description' | 'error' | 'errorText';

const PARTS: readonly FieldPart[] = [
  'root',
  'label',
  'control',
  'description',
  'error',
  'errorText',
];

const NO_ERRORS: readonly unknown[] = Object.freeze([]);

const flag = (isOn: boolean): string | undefined => (isOn ? '' : undefined);

/** Ids joined for an `aria-*` reference; `undefined` when there are none. */
const references = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined;

/** The error's text as a screen reader reads it. */
const textOf = (element: HTMLElement): string =>
  (element.textContent ?? '').replace(/\s+/g, ' ').trim();

const identity = <T>(value: T) => value;

/** How Field alone follows a native control: by its value or its checked state. */
type NativeKind = 'value' | 'checked' | 'multiple';

function nativeKindOf(element: unknown): NativeKind | null {
  if (!element || typeof element !== 'object') return null;
  const control = element as HTMLInputElement | HTMLSelectElement;
  if (control.localName === 'select') {
    return (control as HTMLSelectElement).multiple ? 'multiple' : 'value';
  }
  if (control.localName === 'textarea') return 'value';
  if (control.localName !== 'input') return null;
  const { type } = control as HTMLInputElement;
  return type === 'checkbox' || type === 'radio' ? 'checked' : 'value';
}

function readNative(element: HTMLElement, kind: NativeKind): unknown {
  if (kind === 'checked') return (element as HTMLInputElement).checked;
  if (kind === 'multiple') {
    return Array.from((element as HTMLSelectElement).selectedOptions).map(
      (option) => option.value,
    );
  }
  return (element as HTMLInputElement).value;
}

/** The empty-required message's kind for Field alone's control. */
function controlKindOf(element: unknown): ControlKind {
  const kind = nativeKindOf(element);
  if (kind === 'checked') {
    return (element as HTMLInputElement).type === 'radio'
      ? 'radio'
      : 'checkbox';
  }
  if (
    kind === 'multiple' ||
    (element as Element | null)?.localName === 'select'
  ) {
    return 'select';
  }
  return 'text';
}

/** A name's key, or `undefined` when it has none or can't be one. */
function keyFor(name: FormFieldProps['name']): string | undefined {
  if (name === undefined || name === null || name === '') return undefined;
  if (typeof name !== 'string' && name.length === 0) return undefined;
  try {
    return keyOf(name);
  } catch (error) {
    if (isDevelopment()) warn(String((error as Error).message ?? error));
    return undefined;
  }
}

export const field = defineBehavior({
  name: 'field',
  parts: ['root', 'label', 'control', 'description', 'error', 'errorText'],
  links: [formLink],
  props: {
    // Field alone's value: what its native control holds, or what
    // `setValue()` gives a custom one (Form spec, Field binds).
    value: bindable<unknown>(undefined, { attribute: false }),
    // Unset, a bound field shows its form's state (Form spec, Field props
    // for the form).
    isInvalid: prop<boolean | undefined>(undefined, { type: 'boolean' }),
    isRequired: prop(false),
    isDisabled: prop(false),
    isReadOnly: prop(false, { attribute: 'readonly' }),
    // The control's id where it has none of its own; an id on the element
    // wins (root AGENTS.md → DOM, lifecycle and SSR).
    controlId: prop<string | undefined>(undefined, {
      attribute: false,
      idOf: 'control',
    }),
    // The element reads the label's tag instead of taking an attribute.
    labelElementType: prop('label', {
      attribute: false,
      adopt: { part: 'label', tag: true },
    }),
    labelledBy: prop<string | undefined>(undefined, { type: 'string' }),
    describedBy: prop<string | undefined>(undefined, { type: 'string' }),
    ...formFieldProps,
    // Elements read the name from the native control's (Form spec, Field
    // props for the form).
    name: prop<FormFieldProps['name']>(undefined, {
      type: 'string',
      adopt: { part: 'control', attribute: 'name' },
    }),
  },
  actions: ['setValue'],
  setup(ctx) {
    const { props } = ctx;

    // What a composing field handed over; Field alone binds its own value.
    let handed: FieldBinding<unknown> | undefined;
    const valueOf = (): Bindable<unknown> => handed?.value ?? props.value;
    const toForm = (value: unknown) => (handed?.toForm ?? identity)(value);
    const toField = (value: unknown) => (handed?.toField ?? identity)(value);
    const formProps = (): FormFieldProps =>
      handed ? handed.props() : readFormProps(props);
    const key = () => keyFor(formProps().name);

    /** The form this field is bound to now, following only its own name. */
    const bound = (): Linked<FormLinkApi> | undefined => {
      if (handed?.isBindable && !handed.isBindable()) return undefined;
      const current = key();
      if (current === undefined) return undefined;
      const select = (api: FormLinkApi) => api.view(current);
      return handed ? handed.link(select) : ctx.link(formLink, select);
    };
    const view = (): FieldView | undefined => {
      const form = bound();
      const current = key();
      return form && current !== undefined ? form.api.view(current) : undefined;
    };

    const bindTo = (target: Bindable<unknown>) =>
      target.bind(() => {
        const form = bound();
        const current = key();
        if (!form || current === undefined) return null;
        const path = pathOf(current);
        return {
          get: () => toField(form.api.read(path)),
          set: (value) => form.api.write(path, toForm(value)),
        };
      });
    bindTo(props.value);

    // Focus in Field alone's control; a composing field reports its own.
    const isFocused = ctx.state(false);
    const isFocusWithin = () =>
      handed ? handed.isFocusWithin() : isFocused.get();

    // Field alone's native control.
    const native = ctx.state<NativeKind | null>(null);
    partEffect(ctx, 'control', (element) => {
      native.set(nativeKindOf(element));
      return () => native.set(null);
    });
    const onNativeChange = () => {
      const kind = native.get();
      const control = partElement(ctx, 'control');
      if (handed || !kind || !control) return;
      const value = readNative(control, kind);
      const current = props.value.get();
      if (
        kind === 'multiple' &&
        Array.isArray(current) &&
        current.length === (value as string[]).length &&
        current.every((item, index) => item === (value as string[])[index])
      ) {
        return;
      }
      props.value.set(value);
    };
    const controlHandlers = {
      input: onNativeChange,
      change: onNativeChange,
      focusin: () => isFocused.set(true),
      focusout: (event: FocusEvent) => {
        const control = partElement(ctx, 'control');
        const next = event.relatedTarget as Node | null;
        if (control && next && control.contains(next)) return;
        isFocused.set(false);
      },
    };

    // Only parts with an element are referenced, so no reference points at
    // nothing. React attaches elements before `start()`, so the effect reads
    // them then; the watch follows parts added or removed later.
    const present = () =>
      PARTS.filter((part) => ctx.element(part) !== null).join(' ');
    const rendered = ctx.state('');
    ctx.effect(() => rendered.set(present()));
    ctx.watch(present, (value) => rendered.set(value));
    const isRendered = (part: FieldPart) =>
      rendered.get().split(' ').includes(part);

    // The state a bound field takes from its form (Form spec, What a bound
    // field hands over).
    const errors = () => view()?.state?.errors ?? NO_ERRORS;
    const isInvalid = () => props.isInvalid() ?? errors().length > 0;
    const isDisabled = () =>
      props.isDisabled() || view()?.settings.isDisabled === true;
    const isReadOnly = () =>
      props.isReadOnly() || view()?.settings.isReadOnly === true;
    const isErrorShown = () => isInvalid() && !isDisabled();
    const status = (): FieldStatus => view()?.state?.status ?? 'unvalidated';

    /** `name` and `form` for the native controls the field submits through. */
    const submitAttrs = (): Record<string, string> => {
      const current = key();
      if (current === undefined) return {};
      const attrs: Record<string, string> = { name: current };
      const settings = view()?.settings;
      const control = partElement(ctx, 'control');
      // A control outside its form's `<form>` joins it by id, so a native
      // post and reset follow; `contains()` doesn't change when it does.
      if (settings?.element && control && !settings.element.contains(control)) {
        attrs.form = settings.id;
      }
      return attrs;
    };

    const controls = (): readonly Element[] => {
      if (handed?.submitControls) return handed.submitControls();
      const control = partElement(ctx, 'control');
      return control && nativeKindOf(control) ? [control] : [];
    };

    // Registering (Form spec, Registering).
    const registrationFor = (path: Path): FieldRegistration => ({
      path,
      options: () => {
        const current = formProps();
        const fallback = valueOf().getDefault();
        return {
          validate: current.validate,
          trigger: current.validationTrigger,
          defaultTrigger: handed?.defaultTrigger ?? 'blur',
          delay: current.validationDelay,
          messages: current.validationMessages,
          dependsOn: current.dependsOn,
          isEqual: current.isEqual,
          shouldPreserve: current.shouldPreserve,
          hasDefault: fallback !== undefined,
          defaultValue: fallback === undefined ? undefined : toForm(fallback),
          isRequired: props.isRequired(),
          isDisabled: props.isDisabled(),
          isReadOnly: props.isReadOnly(),
          kind: handed?.kind ?? controlKindOf(partElement(ctx, 'control')),
        };
      },
      check: handed?.check,
      control: () => partElement(ctx, 'control'),
      element: () => partElement(ctx, 'root') ?? partElement(ctx, 'control'),
      focusTarget: () => handed?.focusTarget?.() ?? partElement(ctx, 'control'),
      hasFocus: isFocusWithin,
      announcement: () =>
        references(
          isRendered('label') ? ctx.ids.label : props.labelledBy(),
          isRendered('error') ? ctx.ids.error : undefined,
        ),
      submitControls: controls,
    });

    let registered:
      | { readonly form: unknown; readonly key: string; release(): void }
      | undefined;
    const release = () => {
      registered?.release();
      registered = undefined;
    };
    const register = () => {
      const form = bound();
      const current = key();
      if (
        registered &&
        registered.form === form?.instance &&
        registered.key === current
      ) {
        return;
      }
      release();
      if (!form || current === undefined) return;
      const path = pathOf(current);
      registered = {
        form: form.instance,
        key: current,
        release: form.api.register(registrationFor(path)),
      };
      // A value the control holds apart from its own default is the
      // user's: the form takes it (Form spec, Defaults).
      const held = handed
        ? handed.readControl?.()
        : (() => {
            const control = partElement(ctx, 'control');
            const kind = nativeKindOf(control);
            if (!control || kind === null || kind === 'multiple') return;
            const input = control as HTMLInputElement;
            if (kind === 'checked') {
              return input.checked !== input.defaultChecked
                ? input.checked
                : undefined;
            }
            return input.value !== input.defaultValue ? input.value : undefined;
          })();
      if (held !== undefined && !Object.is(toForm(held), form.api.read(path))) {
        form.api.write(path, toForm(held));
      }
    };
    ctx.effect(() => {
      register();
      return release;
    });
    ctx.watch(() => bound()?.instance, register);
    ctx.watch(key, register);

    // Focus leaving a bound field is a blur for its form.
    ctx.watch(isFocusWithin, (isIn) => {
      if (isIn || !registered) return;
      bound()?.api.blurred(registered.key);
    });

    // A new error is announced as Cube UI Kit's `role="alert"` would read
    // it, through the live announcer. An error already shown on start is not.
    let spoken = '';
    const speak = (element: HTMLElement) => {
      spoken = textOf(element);
      announce(spoken, { document: element.ownerDocument });
    };
    ctx.watch(isErrorShown, (isShown) => {
      const error = partElement(ctx, 'error');
      if (isShown && error && !bound()) speak(error);
    });
    // While shown, new text is announced too: the consumer owns it.
    partEffect(
      ctx,
      'error',
      (error) => {
        spoken = textOf(error);
        const view = error.ownerDocument.defaultView;
        if (!view) return;
        const observer = new view.MutationObserver(() => {
          if (textOf(error) !== spoken) speak(error);
        });
        observer.observe(error, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        return () => observer.disconnect();
      },
      () => isErrorShown() && !bound(),
    );

    // A bound field's errors come from its checks, so what is said depends
    // on why they changed (Form spec, Live announcements).
    const shownError = () => (isErrorShown() && view() ? errors()[0] : null);
    const say = (isLabelled: boolean) =>
      ctx.afterFlush(() => {
        const error = partElement(ctx, 'error');
        if (!error) return;
        spoken = textOf(error);
        const ids = isLabelled
          ? references(
              isRendered('label') ? ctx.ids.label : props.labelledBy(),
              ctx.ids.error,
            )
          : ctx.ids.error;
        if (ids && spoken) {
          announce(
            { 'aria-labelledby': ids },
            { document: error.ownerDocument },
          );
        }
      });
    ctx.watch(shownError, (error, previous) => {
      if (error === null || error === undefined) return;
      const cause = view()?.cause;
      const hasFocus = isFocusWithin();
      // On blur, focus is on the next field already; a blur the press on a
      // submit button caused is the submit's, which moves focus to it.
      if (cause === 'blur') {
        if (!bound()?.api.isSubmitPressed()) say(true);
        return;
      }
      // New text while the control has focus: its description holds it.
      if (previous !== null && previous !== undefined && hasFocus) return;
      if (cause === 'change' || (cause === 'dependency' && hasFocus)) {
        say(false);
      }
    });

    if (isDevelopment()) {
      // A label or message with no control links to nothing; the likely
      // cause is a field wrapped around a UniAria input, which has its own.
      ctx.effect(() => {
        const check = () => {
          const parts = ['label', 'description', 'error'] as const;
          if (
            partElement(ctx, 'control') ||
            !parts.some((part) => partElement(ctx, part))
          ) {
            return;
          }
          warn(
            'field: a label or message is rendered without a control part, so ' +
              'nothing links to it. A UniAria input renders its own label and ' +
              'messages: put them inside it instead of wrapping it in a field.',
          );
        };
        // Custom elements get their parts while the document parses.
        const doc = (ctx.env.document ?? globalThis.document) as
          Document | undefined;
        if (doc?.readyState === 'loading') {
          doc.addEventListener('DOMContentLoaded', check, { once: true });
          return () => doc.removeEventListener('DOMContentLoaded', check);
        }
        const timer = setTimeout(check);
        return () => clearTimeout(timer);
      });
    }

    return {
      isRendered,
      isErrorShown,
      isInvalid,
      isDisabled,
      isReadOnly,
      isBound: () => bound() !== undefined,
      errors,
      status,
      view,
      submitAttrs,
      value: () => valueOf().get(),
      native: () => (handed ? null : native.get()),
      /** Field alone follows its control's value and focus. */
      controlHandlers: () => (handed ? undefined : controlHandlers),
      /** Whether `name` and `form` go on the control part. */
      isControlSubmitted: () =>
        key() !== undefined && (handed?.isControlSubmitted ?? true),
      /**
       * Binds a composing field's value to the form instead of Field's own
       * (Form spec, Field binds). Call it once, in the composer's `setup()`.
       */
      bindValue<T>(binding: FieldBinding<T>) {
        props.value.bind(() => null);
        handed = binding as FieldBinding<unknown>;
        bindTo(handed.value);
      },
      /** A user's change from a custom control (Form spec, Actions). */
      setValue: (value: unknown) => valueOf().set(value),
    };
  },
  expose({ props, api }) {
    const view = api.view();
    const state = view?.state;
    return {
      value: api.value(),
      isInvalid: api.isInvalid(),
      isRequired: props.isRequired(),
      isDisabled: api.isDisabled(),
      isErrorShown: api.isErrorShown(),
      errors: api.errors(),
      status: api.status(),
      isTouched: state?.isTouched ?? false,
      isDirty: state?.isDirty ?? false,
      isBound: view !== undefined,
    };
  },
  connect({ props, ids, api }) {
    const isInvalid = api.isInvalid();
    const isRequired = props.isRequired();
    const isDisabled = api.isDisabled();
    const isErrorShown = api.isErrorShown();
    const controlId = ids.control;
    const state = {
      'data-invalid': flag(isInvalid),
      'data-required': flag(isRequired),
      'data-disabled': flag(isDisabled),
      'data-validating': flag(api.status() === 'validating'),
    };
    const has = api.isRendered;
    const errors = api.errors();
    const native = api.native();
    // Field alone writes its native control while a form or the consumer
    // controls the value; otherwise the control keeps what it holds.
    const value = props.value.get();
    const properties =
      native && props.value.isControlled()
        ? native === 'checked'
          ? { checked: value === true }
          : native === 'value'
            ? {
                value:
                  value === null || value === undefined ? '' : String(value),
              }
            : undefined
        : undefined;
    const control: DomPartProps = {
      attrs: {
        id: controlId,
        'aria-labelledby': references(
          has('label') ? ids.label : undefined,
          props.labelledBy(),
        ),
        'aria-describedby': references(
          has('description') ? ids.description : undefined,
          // Screen readers read a hidden element a reference points at.
          isErrorShown && has('error') ? ids.error : undefined,
          props.describedBy(),
        ),
        // Removed, never "false", which reads "not invalid".
        'aria-invalid': isInvalid ? 'true' : undefined,
        // Not the native `required`, which starts the browser's validation.
        'aria-required': isRequired ? 'true' : undefined,
        ...state,
        ...(api.isControlSubmitted() ? api.submitAttrs() : {}),
      },
      ...(api.controlHandlers() ? { on: api.controlHandlers() } : {}),
      ...(properties ? { properties } : {}),
    };
    return {
      root: { attrs: state },
      label: {
        attrs: {
          id: ids.label,
          // Native labelling: clicks focus the control, and it is named
          // before JavaScript runs.
          for: props.labelElementType() === 'label' ? controlId : undefined,
          ...state,
        },
      },
      control,
      description: { attrs: { id: ids.description, ...state } },
      error: {
        attrs: { id: ids.error, hidden: flag(!isErrorShown), ...state },
      },
      // Element-owned: the first error, when it is text (Form spec, Errors
      // shown).
      errorText: {
        attrs: state,
        properties: {
          textContent: typeof errors[0] === 'string' ? errors[0] : '',
        },
      },
    };
  },
});
