/**
 * Conformance scenarios: one module per component, written from its approved
 * spec before the implementation exists. Each scenario is adapter-agnostic —
 * it mounts through the contract in `@uniaria/testing` and asserts on the
 * DOM, keyboard behavior, focus, events, state and spoken output. Every
 * adapter runs every suite:
 * `runConformance(adapter, suites, { phase })`.
 *
 * See conformance/AGENTS.md before changing anything here.
 */

import { buttonConformance } from './button/button.conformance';
import { checkboxConformance } from './checkbox/checkbox.conformance';
import { checkboxGroupConformance } from './checkbox-group/checkbox-group.conformance';
import { dialogConformance } from './dialog/dialog.conformance';
import { fieldConformance } from './field/field.conformance';
import { numberFieldConformance } from './number-field/number-field.conformance';
import { popoverConformance } from './popover/popover.conformance';
import { radioGroupConformance } from './radio-group/radio-group.conformance';
import { switchConformance } from './switch/switch.conformance';
import { textFieldConformance } from './text-field/text-field.conformance';
import { toggleButtonConformance } from './toggle-button/toggle-button.conformance';
import { tooltipConformance } from './tooltip/tooltip.conformance';

export {
  buttonConformance,
  checkboxConformance,
  checkboxGroupConformance,
  dialogConformance,
  fieldConformance,
  numberFieldConformance,
  popoverConformance,
  radioGroupConformance,
  switchConformance,
  textFieldConformance,
  toggleButtonConformance,
  tooltipConformance,
};
export type { ButtonProps, ButtonState, PressEvent } from './button/types';
export type { CheckboxProps, CheckboxState } from './checkbox/types';
export type {
  CheckboxGroupProps,
  CheckboxGroupState,
} from './checkbox-group/types';
export type {
  DialogDismissEvent,
  DialogProps,
  DialogState,
} from './dialog/types';
export type { FieldProps, FieldState } from './field/types';
export type { NumberFieldProps, NumberFieldState } from './number-field/types';
export type {
  PopoverDismissEvent,
  PopoverPositionArea,
  PopoverProps,
  PopoverState,
} from './popover/types';
export type { RadioGroupProps, RadioGroupState } from './radio-group/types';
export type { SwitchProps, SwitchState } from './switch/types';
export type { TextFieldProps, TextFieldState } from './text-field/types';
export type {
  ToggleButtonProps,
  ToggleButtonState,
} from './toggle-button/types';
export type { TooltipProps, TooltipState } from './tooltip/types';

/** Every suite, in roadmap order. */
export const suites = [
  buttonConformance,
  toggleButtonConformance,
  fieldConformance,
  textFieldConformance,
  checkboxConformance,
  checkboxGroupConformance,
  switchConformance,
  radioGroupConformance,
  dialogConformance,
  popoverConformance,
  tooltipConformance,
  numberFieldConformance,
];
