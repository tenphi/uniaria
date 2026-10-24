/**
 * Form's props, public state, event details and action results, as the
 * approved spec (`packages/core/src/components/form/spec.md`) defines them.
 */

/** A key (`'email'`), or a path of keys and indexes for nested data. */
export type FormName = string | readonly (string | number)[];

export type FormValues = Readonly<Record<string, unknown>>;

/** Errors per name, keyed by the name's escaped key. */
export type FormErrors = Readonly<Record<string, readonly unknown[]>>;

export type FormValidationTrigger = 'change' | 'blur' | 'submit';

export type FormMessageKey =
  | 'valueMissing'
  | 'badInput'
  | 'patternMismatch'
  | 'typeMismatch'
  | 'rangeUnderflow'
  | 'rangeOverflow'
  | 'stepMismatch'
  | 'tooShort'
  | 'tooLong';

export interface FormMessageContext {
  readonly name: FormName;
  readonly value: unknown;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

export type FormMessage = string | ((context: FormMessageContext) => string);

export type FormMessages = Partial<Record<FormMessageKey, FormMessage>>;

/** What `handleSubmit` gets besides the values. */
export interface FormSubmitContext {
  readonly signal: AbortSignal;
  readonly submitter: HTMLElement | null;
  readonly include: 'active' | 'all';
  readonly formData: FormData;
}

export interface FormProps {
  defaultValues: FormValues;
  handleSubmit:
    ((values: FormValues, context: FormSubmitContext) => unknown) | undefined;
  submitValues: 'active' | 'all';
  validationTrigger: FormValidationTrigger | undefined;
  validationDelay: number;
  validationMessages: FormMessages | undefined;
  isDisabled: boolean;
  isReadOnly: boolean;
}

export type FormFieldStatus =
  'unvalidated' | 'validating' | 'valid' | 'invalid';

export interface FormFieldState {
  value: unknown;
  defaultValue: unknown;
  errors: readonly unknown[];
  status: FormFieldStatus;
  isTouched: boolean;
  isDirty: boolean;
  isActive: boolean;
}

export interface FormState {
  values: FormValues;
  activeValues: FormValues;
  defaultValues: FormValues;
  /** One entry per name the form knows, keyed by its escaped key. */
  fields: Readonly<Record<string, FormFieldState>>;
  isDirty: boolean;
  isTouched: boolean;
  isValid: boolean;
  isInvalid: boolean;
  isValidating: boolean;
  isSubmitting: boolean;
  submitError: unknown;
  canReset: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
}

export interface FormSubmittedDetail {
  readonly values: FormValues;
}

export type FormSubmitFailedDetail =
  | { readonly status: 'invalid'; readonly errors: FormErrors }
  | { readonly status: 'failed'; readonly error: unknown };

export interface FormValuesChangeDetail {
  readonly values: FormValues;
  readonly names: readonly FormName[];
  readonly source: 'user' | 'program';
  readonly kind: 'set' | 'reset' | 'defaults';
}

/** What the `submit()` action resolves to. */
export type FormSubmitResult =
  | { readonly status: 'submitted' }
  | { readonly status: 'invalid'; readonly errors: FormErrors }
  | { readonly status: 'failed'; readonly error: unknown }
  | { readonly status: 'stale' }
  | { readonly status: 'ignored' };

/** What the `validate()` action resolves to. */
export interface FormValidateResult {
  readonly isValid: boolean;
  readonly isStale: boolean;
  readonly errors: FormErrors;
}
