/**
 * Button's props, public state and press event, as the approved spec
 * (`packages/core/src/components/button/spec.md`) defines them. The suite is
 * typed against these, not against the definition, so it exists before the
 * implementation does.
 */

export interface ButtonProps {
  isDisabled: boolean;
  isFocusableWhenDisabled: boolean;
  href: string;
  type: 'button' | 'submit' | 'reset';
  elementType: string;
  shouldExcludeFromTabOrder: boolean;
  shouldPreventFocusOnPress: boolean;
}

export interface ButtonState {
  isPressed: boolean;
  isHovered: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isDisabled: boolean;
}

export interface PressEvent {
  type: 'pressstart' | 'pressend' | 'press';
  pointerType: 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';
  target: Element;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  key?: string;
  x: number;
  y: number;
}
