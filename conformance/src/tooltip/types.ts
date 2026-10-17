/**
 * Tooltip's props and public state, as the approved spec
 * (`packages/core/src/components/tooltip/spec.md`) defines them.
 */

import type { PopoverPositionArea } from '../popover/types';

export interface TooltipProps {
  isOpen: boolean;
  defaultOpen: boolean;
  isDisabled: boolean;
  delay: number;
  closeDelay: number;
  trigger: 'hover' | 'focus';
  relation: 'description' | 'label';
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
