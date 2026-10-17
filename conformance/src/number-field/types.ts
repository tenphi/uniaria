/**
 * NumberField's props and public state, as the approved spec
 * (`packages/core/src/components/number-field/spec.md`) defines them.
 */

export interface NumberFieldProps {
  value: number | null;
  defaultValue: number | null;
  minValue: number | undefined;
  maxValue: number | undefined;
  step: number | undefined;
  pageStep: number | undefined;
  formatOptions: Intl.NumberFormatOptions;
  locale: string | undefined;
  isWheelDisabled: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  incrementLabel: string | undefined;
  decrementLabel: string | undefined;
  roleDescription: string | undefined;
  inputId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface NumberFieldState {
  value: number | null;
  canIncrement: boolean;
  canDecrement: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isHovered: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
}
