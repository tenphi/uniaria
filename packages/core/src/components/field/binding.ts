/**
 * What binds a field to its form (Form spec, Field binds): the props every
 * field takes for its form, and what a composing field hands Field so Field
 * binds the composer's value. Field holds no store and never imports the
 * form definition: it reaches the form through `formLink`.
 */

import type { Bindable, Linked, PropReaders } from '../../runtime';
import { prop } from '../../runtime';
import type { ControlKind } from '../form/constraints';
import type { FormLinkApi, Trigger, Validate } from '../form/link';
import type { Issue, Messages } from '../form/messages';
import type { Name } from '../form/values';

/** The props a field takes for its form (Form spec, Field props for the form). */
export const formFieldProps = {
  name: prop<Name | undefined>(undefined, { type: 'string' }),
  validate: prop<Validate | undefined>(undefined, { attribute: false }),
  validationTrigger: prop<Trigger | undefined>(undefined, { type: 'string' }),
  validationDelay: prop<number | undefined>(undefined, { type: 'number' }),
  validationMessages: prop<Messages | undefined>(undefined, {
    attribute: false,
  }),
  dependsOn: prop<readonly Name[]>([], { type: 'json' }),
  isEqual: prop<((a: unknown, b: unknown) => boolean) | undefined>(undefined, {
    attribute: false,
  }),
  shouldPreserve: prop(true),
};

/** The values of `formFieldProps` now. */
export interface FormFieldProps {
  readonly name: Name | undefined;
  readonly validate: Validate | undefined;
  readonly validationTrigger: Trigger | undefined;
  readonly validationDelay: number | undefined;
  readonly validationMessages: Messages | undefined;
  readonly dependsOn: readonly Name[];
  readonly isEqual: ((a: unknown, b: unknown) => boolean) | undefined;
  readonly shouldPreserve: boolean;
}

/** Reads a field's form props, for the binding it hands Field. */
export function readFormProps(
  props: PropReaders<typeof formFieldProps>,
): FormFieldProps {
  return {
    name: props.name(),
    validate: props.validate(),
    validationTrigger: props.validationTrigger(),
    validationDelay: props.validationDelay(),
    validationMessages: props.validationMessages(),
    dependsOn: props.dependsOn() ?? [],
    isEqual: props.isEqual(),
    shouldPreserve: props.shouldPreserve(),
  };
}

/** What a composing field hands Field to bind (`api.bindValue()`). */
export interface FieldBinding<T> {
  /** The composer's value, read and written through the form while bound. */
  readonly value: Bindable<T>;
  /** The composer's form link: `(select) => ctx.link(formLink, select)`. */
  readonly link: (
    select: (api: FormLinkApi) => unknown,
  ) => Linked<FormLinkApi> | undefined;
  /** Its form props, read on every access. */
  readonly props: () => FormFieldProps;
  /** The form's value for the field's; identity by default. */
  readonly toForm?: (value: T) => unknown;
  /** The field's value for the form's; identity by default. */
  readonly toField?: (value: unknown) => T;
  /** The control whose empty, required message the field uses. */
  readonly kind: ControlKind;
  /** When it checks without a trigger of its own or its form's. */
  readonly defaultTrigger: Trigger;
  /** Whether focus is in the field, for checks on blur. */
  readonly isFocusWithin: () => boolean;
  /** Whether it may bind now: never inside a group, which binds instead. */
  readonly isBindable?: () => boolean;
  /** What a failed submit focuses; the control by default. */
  readonly focusTarget?: () => HTMLElement | null;
  /** The native controls it submits through; the control by default. */
  readonly submitControls?: () => readonly Element[];
  /** Its native constraints; the control's by default, when it is a text control. */
  readonly check?: (value: unknown) => Issue | null;
  /**
   * The value its control holds when it differs from the control's own
   * default (typed before upgrade, restored by the browser), which the form
   * takes as the user's when the field binds (Form spec, Defaults).
   */
  readonly readControl?: () => T | undefined;
  /**
   * Whether Field writes `name` and `form` on its control part. `false` for
   * a field that submits through other controls, which writes them itself
   * from `api.submitAttrs()`.
   */
  readonly isControlSubmitted?: boolean;
}
