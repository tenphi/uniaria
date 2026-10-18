/**
 * Listbox's props and public state, as the approved spec
 * (`packages/core/src/components/listbox/spec.md`) defines them.
 */

/** The item shape the accessors read by default. */
export interface ListboxItem {
  key: string;
  textValue?: string;
  isDisabled?: boolean;
  items?: readonly ListboxItem[];
}

export interface ListboxProps {
  items: readonly ListboxItem[];
  disabledKeys: readonly string[];
  value: readonly string[];
  defaultValue: readonly string[];
  selectionMode: 'single' | 'multiple';
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  orientation: 'vertical' | 'horizontal';
  shouldFocusWrap: boolean;
  shouldFocusOnHover: boolean;
  listId: string | undefined;
  labelElementType: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface ListboxState {
  value: readonly string[];
  selectionMode: 'single' | 'multiple';
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
