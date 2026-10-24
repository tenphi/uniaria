/**
 * Messages for the checks Form runs itself (Form spec, Validation →
 * Messages): a field's `validationMessages`, then its form's, then the
 * browser's message for the same check, read from a detached control. The
 * browser gives none for a length a script set, so those two have English
 * defaults.
 */

/** A built-in check, named as `ValidityState` names it. */
export type MessageKey =
  | 'valueMissing'
  | 'badInput'
  | 'patternMismatch'
  | 'typeMismatch'
  | 'rangeUnderflow'
  | 'rangeOverflow'
  | 'stepMismatch'
  | 'tooShort'
  | 'tooLong';

/** What a message function gets. */
export interface MessageContext {
  /** The field's key in the form. */
  readonly name: string;
  readonly value: unknown;
  /** The bound the value missed: a length, or a number's range. */
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/** A message, or one made from what the check found. */
export type Message = string | ((context: MessageContext) => string);

export type Messages = Partial<Record<MessageKey, Message>>;

/** A failed built-in check and the browser's message for it, if any. */
export interface Issue {
  readonly key: MessageKey;
  /** The browser's message; empty where it gives none. */
  readonly message: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

const DEFAULTS: Messages = {
  tooShort: ({ min }) => `Use at least ${min} characters`,
  tooLong: ({ max }) => `Use at most ${max} characters`,
};

/** The message for `issue`: the field's, the form's, the browser's, a default. */
export function messageFor(
  issue: Issue,
  context: Omit<MessageContext, 'min' | 'max' | 'step'>,
  ...sources: (Messages | undefined)[]
): string {
  const full: MessageContext = {
    ...context,
    ...(issue.min === undefined ? {} : { min: issue.min }),
    ...(issue.max === undefined ? {} : { max: issue.max }),
    ...(issue.step === undefined ? {} : { step: issue.step }),
  };
  for (const source of sources) {
    const message = source?.[issue.key];
    if (message !== undefined) {
      return typeof message === 'function' ? message(full) : message;
    }
  }
  if (issue.message) return issue.message;
  const fallback = DEFAULTS[issue.key];
  return typeof fallback === 'function' ? fallback(full) : (fallback ?? '');
}
