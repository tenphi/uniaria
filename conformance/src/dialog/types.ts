/**
 * Dialog's props, public state and `dismiss` detail, as the approved spec
 * (`packages/sous/src/components/dialog/spec.md`) defines them.
 */

export interface DialogProps {
  isOpen: boolean;
  defaultOpen: boolean;
  isDismissable: boolean;
  isKeyboardDismissDisabled: boolean;
  role: 'dialog' | 'alertdialog';
  isDisabled: boolean;
  shouldRestoreFocus: boolean;
  labelledBy: string | undefined;
  describedBy: string | undefined;
}

export interface DialogState {
  isOpen: boolean;
  isEntering: boolean;
  isExiting: boolean;
}

export interface DialogDismissEvent {
  reason: 'escape' | 'outside' | 'close' | 'submit' | 'browser';
  returnValue: string;
}
