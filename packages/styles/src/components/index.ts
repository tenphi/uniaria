/**
 * Every component's styles, by the name UniAria writes in `data-uni`. A
 * part outside the root (`data-uni-part="<name>-<part>"`) has its own
 * object in `outside`, keyed by the part's marker name.
 */

import type { Styles } from '@tenphi/tasty';

import { autocompleteStyles } from './autocomplete';
import { buttonExtrasStyles, buttonFrameStyles, buttonStyles } from './button';
import { checkboxStyles } from './checkbox';
import { checkboxGroupStyles } from './checkbox-group';
import { comboboxStyles } from './combobox';
import {
  dialogStyles,
  dialogTriggerDescriptionStyles,
  dialogTriggerExtrasStyles,
  dialogTriggerFrameStyles,
  dialogTriggerLabelStyles,
  dialogTriggerStyles,
} from './dialog';
import { fieldStyles } from './field';
import { listboxStyles } from './listbox';
import { numberFieldStyles } from './number-field';
import {
  popoverStyles,
  popoverTriggerDescriptionStyles,
  popoverTriggerExtrasStyles,
  popoverTriggerFrameStyles,
  popoverTriggerLabelStyles,
  popoverTriggerStyles,
} from './popover';
import { radioStyles } from './radio';
import { radioGroupStyles } from './radio-group';
import { selectStyles } from './select';
import { switchStyles } from './switch';
import { textFieldStyles } from './text-field';
import {
  toggleButtonExtrasStyles,
  toggleButtonFrameStyles,
  toggleButtonStyles,
} from './toggle-button';
import { tooltipStyles } from './tooltip';

export interface ComponentStyles {
  readonly styles: Styles;
  readonly outside?: Readonly<Record<string, Styles>>;
}

export const COMPONENTS = {
  button: {
    styles: buttonStyles,
    outside: { frame: buttonFrameStyles, extras: buttonExtrasStyles },
  },
  'toggle-button': {
    styles: toggleButtonStyles,
    outside: {
      frame: toggleButtonFrameStyles,
      extras: toggleButtonExtrasStyles,
    },
  },
  checkbox: { styles: checkboxStyles },
  switch: { styles: switchStyles },
  radio: { styles: radioStyles },
  'checkbox-group': { styles: checkboxGroupStyles },
  'radio-group': { styles: radioGroupStyles },
  field: { styles: fieldStyles },
  'text-field': { styles: textFieldStyles },
  'number-field': { styles: numberFieldStyles },
  listbox: { styles: listboxStyles },
  select: { styles: selectStyles },
  autocomplete: { styles: autocompleteStyles },
  combobox: { styles: comboboxStyles },
  dialog: {
    styles: dialogStyles,
    outside: {
      trigger: dialogTriggerStyles,
      'trigger-label': dialogTriggerLabelStyles,
      'trigger-description': dialogTriggerDescriptionStyles,
      'trigger-frame': dialogTriggerFrameStyles,
      'trigger-extras': dialogTriggerExtrasStyles,
    },
  },
  popover: {
    styles: popoverStyles,
    outside: {
      trigger: popoverTriggerStyles,
      'trigger-label': popoverTriggerLabelStyles,
      'trigger-description': popoverTriggerDescriptionStyles,
      'trigger-frame': popoverTriggerFrameStyles,
      'trigger-extras': popoverTriggerExtrasStyles,
    },
  },
  tooltip: { styles: tooltipStyles },
} as const satisfies Record<string, ComponentStyles>;

export type ComponentName = keyof typeof COMPONENTS;

/** A part outside its root, by its marker: `'popover-trigger'`. */
export type OutsidePart = {
  [Name in ComponentName]: (typeof COMPONENTS)[Name] extends {
    readonly outside: infer Parts;
  }
    ? `${Name}-${Extract<keyof Parts, string>}`
    : never;
}[ComponentName];

/** What a style override applies to: a component, or a part outside it. */
export type StylesTarget = ComponentName | OutsidePart;

export const COMPONENT_NAMES = Object.keys(COMPONENTS) as ComponentName[];
