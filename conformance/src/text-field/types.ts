/**
 * TextField's props and public state, as the approved spec
 * (`packages/core/src/components/text-field/spec.md`) defines them.
 */

export interface TextFieldProps {
  value: string;
  defaultValue: string;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  inputId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface TextFieldState {
  value: string;
  isFocused: boolean;
  isFocusVisible: boolean;
  isHovered: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
}
