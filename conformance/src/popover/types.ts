/**
 * Popover's props, public state and `dismiss` detail, as the approved spec
 * (`packages/core/src/components/popover/spec.md`) defines them.
 */

/** React Aria's placement strings: a side, optionally an alignment. */
export type PopoverPlacement =
  | 'bottom'
  | 'bottom left'
  | 'bottom right'
  | 'bottom start'
  | 'bottom end'
  | 'top'
  | 'top left'
  | 'top right'
  | 'top start'
  | 'top end'
  | 'left'
  | 'left top'
  | 'left bottom'
  | 'start'
  | 'start top'
  | 'start bottom'
  | 'right'
  | 'right top'
  | 'right bottom'
  | 'end'
  | 'end top'
  | 'end bottom';

export interface PopoverProps {
  isOpen: boolean;
  defaultOpen: boolean;
  isNonModal: boolean;
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  shouldCloseOnInteractOutside: ((target: Element) => boolean) | undefined;
  isDisabled: boolean;
  shouldRestoreFocus: boolean;
  placement: PopoverPlacement;
  offset: number;
  crossOffset: number;
  containerPadding: number;
  shouldFlip: boolean;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface PopoverState {
  isOpen: boolean;
  isEntering: boolean;
  isExiting: boolean;
  placement: 'top' | 'bottom' | 'left' | 'right' | undefined;
}

export interface PopoverDismissEvent {
  reason:
    | 'escape'
    | 'outside'
    | 'trigger'
    | 'close'
    | 'blur'
    | 'scroll'
    | 'parent'
    | 'browser';
}
