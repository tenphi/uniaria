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

import { autocompleteConformance } from './autocomplete/autocomplete.conformance';
import { buttonConformance } from './button/button.conformance';
import { buttonItemsConformance } from './button/items.conformance';
import { checkboxConformance } from './checkbox/checkbox.conformance';
import { checkboxGroupConformance } from './checkbox-group/checkbox-group.conformance';
import { dialogConformance } from './dialog/dialog.conformance';
import { dialogItemsConformance } from './dialog/items.conformance';
import { fieldConformance } from './field/field.conformance';
import { formConformance } from './form/form.conformance';
import { listboxConformance } from './listbox/listbox.conformance';
import { listboxItemsConformance } from './listbox/items.conformance';
import { listboxVirtualizationConformance } from './listbox/virtualization.conformance';
import { numberFieldConformance } from './number-field/number-field.conformance';
import { popoverConformance } from './popover/popover.conformance';
import { popoverItemsConformance } from './popover/items.conformance';
import { radioGroupConformance } from './radio-group/radio-group.conformance';
import { selectConformance } from './select/select.conformance';
import { selectItemsConformance } from './select/items.conformance';
import { comboboxConformance } from './combobox/combobox.conformance';
import { comboboxItemsConformance } from './combobox/items.conformance';
import { switchConformance } from './switch/switch.conformance';
import { textFieldConformance } from './text-field/text-field.conformance';
import { toggleButtonConformance } from './toggle-button/toggle-button.conformance';
import { toggleButtonItemsConformance } from './toggle-button/items.conformance';
import { tooltipConformance } from './tooltip/tooltip.conformance';
import { tooltipItemsConformance } from './tooltip/items.conformance';

export {
  autocompleteConformance,
  buttonConformance,
  buttonItemsConformance,
  checkboxConformance,
  checkboxGroupConformance,
  dialogConformance,
  dialogItemsConformance,
  fieldConformance,
  formConformance,
  listboxConformance,
  listboxItemsConformance,
  listboxVirtualizationConformance,
  numberFieldConformance,
  popoverConformance,
  popoverItemsConformance,
  radioGroupConformance,
  selectConformance,
  selectItemsConformance,
  comboboxConformance,
  comboboxItemsConformance,
  switchConformance,
  textFieldConformance,
  toggleButtonConformance,
  toggleButtonItemsConformance,
  tooltipConformance,
  tooltipItemsConformance,
};
export type {
  AutocompleteItem,
  AutocompleteProps,
  AutocompleteState,
} from './autocomplete/types';
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
export type {
  FormErrors,
  FormFieldState,
  FormFieldStatus,
  FormMessage,
  FormMessageContext,
  FormMessageKey,
  FormMessages,
  FormName,
  FormProps,
  FormState,
  FormSubmitContext,
  FormSubmitFailedDetail,
  FormSubmitResult,
  FormSubmittedDetail,
  FormValidateResult,
  FormValidationTrigger,
  FormValues,
  FormValuesChangeDetail,
} from './form/types';
export type {
  ListboxItem,
  ListboxProps,
  ListboxState,
  VirtualizationProps,
  VirtualizationState,
} from './listbox/types';
export type { NumberFieldProps, NumberFieldState } from './number-field/types';
export type {
  PopoverDismissEvent,
  PopoverPositionArea,
  PopoverProps,
  PopoverState,
} from './popover/types';
export type { RadioGroupProps, RadioGroupState } from './radio-group/types';
export type { SelectItem, SelectProps, SelectState } from './select/types';
export type {
  ComboboxItem,
  ComboboxProps,
  ComboboxState,
} from './combobox/types';
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
  listboxConformance,
  listboxVirtualizationConformance,
  selectConformance,
  comboboxConformance,
  // The items spec (phase 5), across the components it touches.
  buttonItemsConformance,
  toggleButtonItemsConformance,
  dialogItemsConformance,
  popoverItemsConformance,
  tooltipItemsConformance,
  listboxItemsConformance,
  selectItemsConformance,
  comboboxItemsConformance,
  // The composition spec (phase 6).
  autocompleteConformance,
  // The Form spec (phase 7).
  formConformance,
];
