/**
 * The link between a field and its form (Form spec, How it works): a small
 * key Field takes and Form answers, inherited, so a field finds the nearest
 * form across other UniAria hosts, and the types both sides share. Field
 * imports this, never the form definition, so a field bundles no form.
 */

import type { LinkKey } from '../../runtime';
import type { ControlKind } from './constraints';
import type { Issue, Messages } from './messages';
import type { Name, Path, Values } from './values';

/** When a field checks on its own. */
export type Trigger = 'change' | 'blur' | 'submit';

export type FieldStatus = 'unvalidated' | 'validating' | 'valid' | 'invalid';

/** One name in a form's public state (`fields`). */
export interface FieldState {
  readonly value: unknown;
  readonly defaultValue: unknown;
  readonly errors: readonly unknown[];
  readonly status: FieldStatus;
  readonly isTouched: boolean;
  readonly isDirty: boolean;
  readonly isActive: boolean;
}

/** What a field's `validate` gets beside the value. */
export interface ValidateContext {
  /** The field's key in the form. */
  readonly name: string;
  /** Every value the form holds now. */
  readonly values: Values;
  /** Aborts when the result can no longer count. */
  readonly signal: AbortSignal;
}

/**
 * A field's own check: `null`, `undefined`, `''` or `true` when valid, else
 * an error or a list of them, or a promise of either.
 */
export type Validate = (value: unknown, context: ValidateContext) => unknown;

/** Why a field's errors last changed, for what Field announces. */
export type CheckCause =
  | 'change'
  | 'blur'
  | 'submit'
  | 'validate'
  | 'dependency'
  | 'program'
  | 'server'
  | 'reset';

/** What a registered field tells its form, read whenever the form needs it. */
export interface FieldOptions {
  readonly validate: Validate | undefined;
  /** The field's own trigger; without one, the form's, then `defaultTrigger`. */
  readonly trigger: Trigger | undefined;
  /** The field's kind's trigger (Form spec, Fields in a form). */
  readonly defaultTrigger: Trigger;
  readonly delay: number | undefined;
  readonly messages: Messages | undefined;
  readonly dependsOn: readonly Name[];
  readonly isEqual: ((a: unknown, b: unknown) => boolean) | undefined;
  readonly shouldPreserve: boolean;
  /** The consumer's `default<Name>`, which seeds the form's default. */
  readonly hasDefault: boolean;
  readonly defaultValue: unknown;
  readonly isRequired: boolean;
  /** The field's own; the form's are the form's. */
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  /** The control whose empty, required message the field reads. */
  readonly kind: ControlKind;
}

/** A field registered with its form, as the form sees it. */
export interface FieldRegistration {
  readonly path: Path;
  options(): FieldOptions;
  /**
   * The native constraint `value` fails, for a field whose control the form
   * can't check (NumberField's number). Without it, the form checks
   * `control()`, so a field outside a form carries no constraint checks.
   */
  check?(value: unknown): Issue | null;
  /** The field's control, whose native constraints the form checks. */
  control(): Element | null;
  /** The field's outermost element, for order and scrolling. */
  element(): Element | null;
  /** What a failed submit focuses. */
  focusTarget(): HTMLElement | null;
  /** Whether focus is in the field. */
  hasFocus(): boolean;
  /** Ids to announce the field's error by: its label, then its error. */
  announcement(): string | undefined;
  /** The native controls the field submits through, in its form or not. */
  submitControls(): readonly Element[];
}

/** What a form's settings are, as a field reads them. */
export interface FormSettings {
  readonly isDisabled: boolean;
  readonly isReadOnly: boolean;
  /** The `<form>`, when it is rendered. */
  readonly element: HTMLFormElement | null;
  /** The `<form>`'s id, for the `form` attribute of controls outside it. */
  readonly id: string;
}

/**
 * What a field follows of its form: its name's state, the value under it,
 * the form's settings and why its errors changed. One object per change,
 * so a field re-runs only for its own name.
 */
export interface FieldView {
  readonly state: FieldState | undefined;
  readonly value: unknown;
  readonly settings: FormSettings;
  readonly cause: CheckCause | undefined;
  /** Counts the form's resets: a new one has the field write its control again. */
  readonly epoch: number;
}

/** The part of the form's `setup()` result fields use. */
export interface FormLinkApi {
  /** The value under `path`. */
  read(path: Path): unknown;
  /** A user's change from a field. */
  write(path: Path, value: unknown): void;
  /** Registers a field; returns the function that releases it. */
  register(field: FieldRegistration): () => void;
  /** Focus left the field registered under `key`. */
  blurred(key: string): void;
  /** What the field under `key` follows, stable until it changes. */
  view(key: string): FieldView;
  /**
   * Whether a press on a submit button is on its way: an error the blur it
   * causes shows is the submit's to announce (Form spec, Live
   * announcements).
   */
  isSubmitPressed(): boolean;
}

/** The link a field takes to its form: `form` in React, Vue and elements. */
export const formLink: LinkKey<'form', FormLinkApi> = {
  name: 'form',
  isInherited: true,
};
