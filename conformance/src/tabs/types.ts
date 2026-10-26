/**
 * Tabs' props and public state, as the approved spec
 * (`packages/core/src/components/tabs/spec.md`) defines them. The accessors
 * (`getKey`, `isItemDisabled`) keep their defaults: scenarios pass items of
 * the default shape.
 */

/** The item shape the accessors read by default. */
export interface TabsItem {
  key: string;
  isDisabled?: boolean;
}

export interface TabsProps {
  items: readonly TabsItem[];
  disabledKeys: readonly string[];
  value: string | null;
  defaultValue: string | null;
  keyboardActivation: 'automatic' | 'manual';
  orientation: 'horizontal' | 'vertical';
  isDisabled: boolean;
  listId: string | undefined;
  labelledBy: string | undefined;
}

export interface TabsState {
  value: string | null;
  selectedKey: string | null;
  focusedKey: string | null;
  isDisabled: boolean;
  isFocusWithin: boolean;
  isFocusVisible: boolean;
}
