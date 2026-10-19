/**
 * Every component's styles, by the name UniAria writes in `data-uni`. A
 * part outside the root (`data-uni-part="<name>-<part>"`) has its own
 * object in `outside`, keyed by the part's marker name.
 */

import type { Styles } from '@tenphi/tasty';

import { buttonStyles } from './button';
import { checkboxStyles } from './checkbox';

export interface ComponentStyles {
  readonly styles: Styles;
  readonly outside?: Readonly<Record<string, Styles>>;
}

export const COMPONENTS = {
  button: { styles: buttonStyles },
  checkbox: { styles: checkboxStyles },
} as const satisfies Record<string, ComponentStyles>;

export type ComponentName = keyof typeof COMPONENTS;

export const COMPONENT_NAMES = Object.keys(COMPONENTS) as ComponentName[];
