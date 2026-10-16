/**
 * Conformance scenarios: one module per component, written from its approved
 * spec before the implementation exists. Each scenario is adapter-agnostic —
 * it mounts through the contract in `@tenphi/sous-testing` and asserts on the
 * DOM, keyboard behavior, focus, events, state and spoken output. Every
 * adapter runs every suite:
 * `runConformance(adapter, suites, { phase })`.
 *
 * See conformance/AGENTS.md before changing anything here.
 */

import { buttonConformance } from './button/button.conformance';
import { checkboxConformance } from './checkbox/checkbox.conformance';
import { checkboxGroupConformance } from './checkbox-group/checkbox-group.conformance';
import { fieldConformance } from './field/field.conformance';
import { radioGroupConformance } from './radio-group/radio-group.conformance';
import { switchConformance } from './switch/switch.conformance';
import { textFieldConformance } from './text-field/text-field.conformance';
import { toggleButtonConformance } from './toggle-button/toggle-button.conformance';

export {
  buttonConformance,
  checkboxConformance,
  checkboxGroupConformance,
  fieldConformance,
  radioGroupConformance,
  switchConformance,
  textFieldConformance,
  toggleButtonConformance,
};
export type { ButtonProps, ButtonState, PressEvent } from './button/types';
export type { CheckboxProps, CheckboxState } from './checkbox/types';
export type {
  CheckboxGroupProps,
  CheckboxGroupState,
} from './checkbox-group/types';
export type { FieldProps, FieldState } from './field/types';
export type { RadioGroupProps, RadioGroupState } from './radio-group/types';
export type { SwitchProps, SwitchState } from './switch/types';
export type { TextFieldProps, TextFieldState } from './text-field/types';
export type {
  ToggleButtonProps,
  ToggleButtonState,
} from './toggle-button/types';

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
];
