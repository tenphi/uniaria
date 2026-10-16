/**
 * ToggleButton's props and public state, as the approved spec
 * (`packages/core/src/components/toggle-button/spec.md`) defines them. Press
 * events are Button's.
 */

import type { ButtonState } from '../button/types';

export interface ToggleButtonProps {
  isSelected: boolean;
  defaultSelected: boolean;
  isDisabled: boolean;
  isFocusableWhenDisabled: boolean;
  elementType: string;
  shouldExcludeFromTabOrder: boolean;
  shouldPreventFocusOnPress: boolean;
}

export interface ToggleButtonState extends ButtonState {
  isSelected: boolean;
}
