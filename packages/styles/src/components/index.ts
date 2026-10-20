/**
 * Every component's styles, by the name UniAria writes in `data-uni`. A
 * part outside the root (`data-uni-part="<name>-<part>"`) has its own
 * object in `outside`, keyed by the part's marker name.
 */

import type { Styles } from '@tenphi/tasty';

import { buttonStyles } from './button';
import { checkboxStyles } from './checkbox';
import { checkboxGroupStyles } from './checkbox-group';
import { fieldStyles } from './field';
import { radioStyles } from './radio';
import { radioGroupStyles } from './radio-group';
import { switchStyles } from './switch';
import { toggleButtonStyles } from './toggle-button';

export interface ComponentStyles {
  readonly styles: Styles;
  readonly outside?: Readonly<Record<string, Styles>>;
}

export const COMPONENTS = {
  button: { styles: buttonStyles },
  'toggle-button': { styles: toggleButtonStyles },
  checkbox: { styles: checkboxStyles },
  switch: { styles: switchStyles },
  radio: { styles: radioStyles },
  'checkbox-group': { styles: checkboxGroupStyles },
  'radio-group': { styles: radioGroupStyles },
  field: { styles: fieldStyles },
} as const satisfies Record<string, ComponentStyles>;

export type ComponentName = keyof typeof COMPONENTS;

export const COMPONENT_NAMES = Object.keys(COMPONENTS) as ComponentName[];
