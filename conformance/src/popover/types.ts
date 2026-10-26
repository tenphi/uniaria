/**
 * Popover's props, public state and `dismiss` detail, as the approved spec
 * (`packages/core/src/components/popover/spec.md`) defines them.
 */

type Area<Side extends string, Span extends string> =
  Side | `${Side} ${'center' | 'span-all' | Span}`;

/** A CSS `position-area` on one side of the anchor (spec, Positioning). */
export type PopoverPositionArea =
  | Area<'top' | 'bottom', 'span-left' | 'span-right'>
  | Area<'left' | 'right', 'span-top' | 'span-bottom'>
  | Area<'block-start' | 'block-end', 'span-inline-start' | 'span-inline-end'>
  | Area<'inline-start' | 'inline-end', 'span-block-start' | 'span-block-end'>
  | Area<
      'self-block-start' | 'self-block-end',
      'span-self-inline-start' | 'span-self-inline-end'
    >
  | Area<
      'self-inline-start' | 'self-inline-end',
      'span-self-block-start' | 'span-self-block-end'
    >;

export interface PopoverProps {
  isOpen: boolean;
  defaultOpen: boolean;
  isNonModal: boolean;
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  shouldCloseOnInteractOutside: ((target: Element) => boolean) | undefined;
  isDisabled: boolean;
  shouldRestoreFocus: boolean;
  positionArea: PopoverPositionArea;
  positionTryFallbacks: string;
  labelledBy: string | undefined;
  describedBy: string | undefined;
  /** The inline state (`./inline.md` in the component's folder). */
  isInline: boolean;
}

export interface PopoverState {
  isOpen: boolean;
  isEntering: boolean;
  isExiting: boolean;
  placement: 'top' | 'bottom' | 'left' | 'right' | undefined;
  /** The inline state (`./inline.md` in the component's folder). */
  isInline: boolean;
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
