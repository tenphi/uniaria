/**
 * Checkbox's props and public state, as the approved spec
 * (`packages/sous/src/components/checkbox/spec.md`) defines them.
 */

export interface CheckboxProps {
  isSelected: boolean;
  defaultSelected: boolean;
  isIndeterminate: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  inputId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface CheckboxState {
  isSelected: boolean;
  isIndeterminate: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isHovered: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
}
