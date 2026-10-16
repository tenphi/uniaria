/**
 * Field's props and public state, as the approved spec
 * (`packages/core/src/components/field/spec.md`) defines them. Field has no
 * events.
 */

export interface FieldProps {
  isInvalid: boolean;
  isRequired: boolean;
  isDisabled: boolean;
  controlId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface FieldState {
  isInvalid: boolean;
  isRequired: boolean;
  isDisabled: boolean;
  isErrorShown: boolean;
}
