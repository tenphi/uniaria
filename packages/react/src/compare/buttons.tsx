/**
 * React buttons for comparing UniAria with React Aria (owner request,
 * 2026-10-15). Each has the same features: press, hover, a focus ring and the
 * state data attributes. Test and benchmark support; not exported.
 *
 * - `UniButton`: UniAria as designed. The component reads no interaction state,
 *   so it renders once and the binder writes state attributes to the element.
 * - `UniSharedButton`: the component reads all of Button's public state with
 *   `useComponentState`, as a design system that renders from state would,
 *   so it re-renders on every change, as React Aria does.
 * - `AriaButton`: React Aria's hooks (`useButton`, `useHover`, `useFocusRing`)
 *   writing the same data attributes from React state, the way React Aria
 *   Components' Button does.
 * - `PlainButton`: a native button with no behavior, the floor for timings.
 *
 * Every component counts its renders in `renders`.
 */

import { button } from '@uniaria/core/button';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { mergeProps, useButton, useFocusRing, useHover } from 'react-aria';

import { useComponent, useComponentState } from '../use-component';

export interface ButtonRenderState {
  readonly isPressed: boolean;
  readonly isHovered: boolean;
  readonly isFocused: boolean;
  readonly isFocusVisible: boolean;
  readonly isDisabled: boolean;
}

export interface CompareButtonProps {
  readonly children: ReactNode | ((state: ButtonRenderState) => ReactNode);
  readonly onPress?: () => void;
  readonly isDisabled?: boolean;
}

/** Renders of every compared component since the page loaded. */
export const renders = { count: 0 };

const flag = (isOn: boolean): '' | undefined => (isOn ? '' : undefined);

function content(
  children: CompareButtonProps['children'],
  state: ButtonRenderState,
): ReactNode {
  return typeof children === 'function' ? children(state) : children;
}

export function UniButton({
  children,
  onPress,
  isDisabled = false,
}: CompareButtonProps) {
  renders.count++;
  const ui = useComponent(button, { onPress, isDisabled });
  // A render prop sees the state of this render only: nothing re-renders it.
  return (
    <button {...ui.parts.root}>
      {content(children, ui.instance.getState())}
    </button>
  );
}

export function UniSharedButton({
  children,
  onPress,
  isDisabled = false,
}: CompareButtonProps) {
  renders.count++;
  const ui = useComponent(button, { onPress, isDisabled });
  const state = useComponentState(ui, (current) => current);
  return <button {...ui.parts.root}>{content(children, state)}</button>;
}

export function AriaButton({
  children,
  onPress,
  isDisabled = false,
}: CompareButtonProps) {
  renders.count++;
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps, isPressed } = useButton({ onPress, isDisabled }, ref);
  const { hoverProps, isHovered } = useHover({ isDisabled });
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  const state = { isPressed, isHovered, isFocused, isFocusVisible, isDisabled };
  return (
    <button
      {...mergeProps(buttonProps, hoverProps, focusProps)}
      ref={ref}
      data-pressed={flag(isPressed)}
      data-hovered={flag(isHovered)}
      data-focused={flag(isFocused)}
      data-focus-visible={flag(isFocusVisible)}
      data-disabled={flag(isDisabled)}
    >
      {content(children, state)}
    </button>
  );
}

export function PlainButton({
  children,
  onPress,
  isDisabled = false,
}: CompareButtonProps) {
  renders.count++;
  const state = {
    isPressed: false,
    isHovered: false,
    isFocused: false,
    isFocusVisible: false,
    isDisabled,
  };
  return (
    <button type="button" disabled={isDisabled} onClick={onPress}>
      {content(children, state)}
    </button>
  );
}

export const IMPLEMENTATIONS = {
  plain: PlainButton,
  aria: AriaButton,
  uni: UniButton,
  uniShared: UniSharedButton,
} as const;

export type Implementation = keyof typeof IMPLEMENTATIONS;
