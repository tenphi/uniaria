/**
 * Switch's props and public state, as the approved spec
 * (`packages/core/src/components/switch/spec.md`) defines them.
 */

export interface SwitchProps {
  isSelected: boolean;
  defaultSelected: boolean;
  isDisabled: boolean;
  isFocusableWhenDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  inputId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface SwitchState {
  isSelected: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isHovered: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
}
