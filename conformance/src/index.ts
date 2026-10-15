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
import { fieldConformance } from './field/field.conformance';
import { textFieldConformance } from './text-field/text-field.conformance';
import { toggleButtonConformance } from './toggle-button/toggle-button.conformance';

export {
  buttonConformance,
  fieldConformance,
  textFieldConformance,
  toggleButtonConformance,
};
export type { ButtonProps, ButtonState, PressEvent } from './button/types';
export type { FieldProps, FieldState } from './field/types';
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
];
