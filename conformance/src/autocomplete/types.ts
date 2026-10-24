/**
 * Autocomplete's props and public state, as the approved composition spec
 * (`packages/core/src/components/composition.md`) defines them. Popup mode's
 * props (`hasPopup`, `isOpen`, `defaultOpen`, `popupTrigger`, `buttonLabel`)
 * are for definitions that compose Autocomplete, so they are left out:
 * Combobox's suite covers popup mode.
 */

import type {
  ListboxItem,
  VirtualizationProps,
  VirtualizationState,
} from '../listbox/types';

export type AutocompleteItem = ListboxItem;

export interface AutocompleteProps extends VirtualizationProps {
  items: readonly AutocompleteItem[];
  disabledKeys: readonly string[];
  value: readonly string[];
  defaultValue: readonly string[];
  selectionMode: 'single' | 'multiple';
  inputValue: string;
  defaultInputValue: string;
  shouldHighlightFirstMatch: boolean;
  filter:
    | ((
        textValue: string,
        inputValue: string,
        item: AutocompleteItem,
      ) => boolean)
    | false;
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  shouldFocusWrap: boolean;
  locale: string | undefined;
  optionCountAnnouncement: (count: number) => string;
  inputId: string | undefined;
  listId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface AutocompleteState extends VirtualizationState {
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
