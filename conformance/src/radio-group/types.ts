/**
 * RadioGroup's props and public state, as the approved spec
 * (`packages/core/src/components/radio-group/spec.md`) defines them.
 */

export interface RadioGroupProps {
  value: string | null;
  defaultValue: string | null;
  name: string | undefined;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  orientation: 'horizontal' | 'vertical' | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface RadioGroupState {
  value: string | null;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
  isFocusWithin: boolean;
  isFocusVisible: boolean;
}
