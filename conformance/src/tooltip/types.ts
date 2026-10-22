/**
 * Tooltip's props and public state, as the approved spec
 * (`packages/core/src/components/tooltip/spec.md`) defines them, with the
 * items spec's overflow tooltip
 * (`packages/core/src/components/button/items.md`).
 */

import type { PopoverPositionArea } from '../popover/types';

export interface TooltipProps {
  isOpen: boolean;
  defaultOpen: boolean;
  isDisabled: boolean;
  delay: number;
  closeDelay: number;
  trigger: 'hover' | 'focus';
  shouldOpenOnlyWhenTruncated: boolean;
  relation: 'description' | 'label' | 'none';
  positionArea: PopoverPositionArea;
  positionTryFallbacks: string;
}

export interface TooltipState {
  isOpen: boolean;
  isEntering: boolean;
  isExiting: boolean;
  isInstant: boolean;
  placement: 'top' | 'bottom' | 'left' | 'right' | undefined;
}
