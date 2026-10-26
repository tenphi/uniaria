/**
 * `@uniaria/core/form` — the Form definition. Render it with
 * `useBehavior(form, props)` and `OwnerProvider` from `@uniaria/react`, or
 * the `<uni-form>` element from `@uniaria/elements/form`. Fields find it
 * through the `form` link and bind to it by `name`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { form } from './form';

export { form } from './form';
export type {
  FieldErrors,
  FormResetOptions,
  HandleSubmit,
  SetDefaultValuesOptions,
  SetValueOptions,
  SubmitContext,
  SubmitFailure,
  SubmitOptions,
  SubmitResult,
  SubmitStatus,
  SubmitValues,
  ValidateResult,
  ValuesChange,
} from './form';
export { formLink } from './link';
export type {
  CheckCause,
  FieldState as FormFieldState,
  FieldStatus,
  Trigger,
  Validate,
  ValidateContext,
} from './link';
export type { Message, MessageContext, MessageKey, Messages } from './messages';
export type { Name, Values } from './values';

export type FormProps = PropsOf<typeof form>;
export type FormState = StateOf<typeof form>;
