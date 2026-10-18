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

/**
 * The virtualization props (`packages/core/src/components/listbox/virtualization.md`),
 * on Listbox, and on Select and Combobox, which forward them to their list.
 */
export interface VirtualizationProps {
  /**
   * `VIRTUALIZER` from `@uniaria/testing`, which each adapter replaces with
   * `virtualizer` from `@uniaria/core/virtual`.
   */
  virtualizer: symbol | undefined;
  itemSize: number | ((key: string) => number) | undefined;
  shouldMeasureItems: boolean;
  overscan: number;
  initialItemCount: number;
}

/** The virtualization spec's public state, on Listbox, Select and Combobox. */
export interface VirtualizationState {
  isVirtualized: boolean;
  renderedKeys: readonly string[];
  renderedSections: readonly string[];
}

export interface ListboxProps extends VirtualizationProps {
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

export interface ListboxState extends VirtualizationState {
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
