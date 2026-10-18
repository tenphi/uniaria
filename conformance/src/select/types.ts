/**
 * Select's props and public state, as the approved spec
 * (`packages/core/src/components/select/spec.md`) defines them.
 */

import type { ListboxItem } from '../listbox/types';

export type SelectItem = ListboxItem;

export interface SelectProps {
  items: readonly SelectItem[];
  disabledKeys: readonly string[];
  value: readonly string[];
  defaultValue: readonly string[];
  selectionMode: 'single' | 'multiple';
  isOpen: boolean;
  defaultOpen: boolean;
  placeholder: string | undefined;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  shouldFocusWrap: boolean;
  positionArea: string;
  positionTryFallbacks: string;
  triggerId: string | undefined;
  listId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface SelectState {
  value: readonly string[];
  valueText: string;
  isPlaceholder: boolean;
  selectionMode: 'single' | 'multiple';
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
