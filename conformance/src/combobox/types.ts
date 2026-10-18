/**
 * Combobox's props and public state, as the approved spec
 * (`packages/core/src/components/combobox/spec.md`) defines them.
 */

import type { ListboxItem } from '../listbox/types';

export type ComboboxItem = ListboxItem;

export interface ComboboxProps {
  items: readonly ComboboxItem[];
  disabledKeys: readonly string[];
  value: readonly string[];
  defaultValue: readonly string[];
  inputValue: string;
  defaultInputValue: string;
  isOpen: boolean;
  defaultOpen: boolean;
  popoverTrigger: 'input' | 'focus' | 'manual';
  filter: ((textValue: string, inputValue: string) => boolean) | false;
  allowsCustomValue: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  shouldFocusWrap: boolean;
  positionArea: string;
  positionTryFallbacks: string;
  locale: string | undefined;
  buttonLabel: string;
  optionCountAnnouncement: (count: number) => string;
  inputId: string | undefined;
  listId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface ComboboxState {
  value: readonly string[];
  inputValue: string;
  isOpen: boolean;
  focusedKey: string | null;
  isEmpty: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  isErrorShown: boolean;
  isFocusWithin: boolean;
  isFocusVisible: boolean;
}
