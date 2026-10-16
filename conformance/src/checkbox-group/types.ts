/**
 * CheckboxGroup's props and public state, as the approved spec
 * (`packages/core/src/components/checkbox-group/spec.md`) defines them.
 */

export interface CheckboxGroupProps {
  value: readonly string[];
  defaultValue: readonly string[];
  name: string | undefined;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface CheckboxGroupState {
  value: readonly string[];
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
  isFocusWithin: boolean;
  isFocusVisible: boolean;
}
