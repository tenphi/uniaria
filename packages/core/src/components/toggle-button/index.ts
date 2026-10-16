/**
 * `@uniaria/core/toggle-button` — the ToggleButton definition. Render it with
 * `useComponent(toggleButton, props)` from `@uniaria/react` or the
 * `<uni-toggle-button>` element from `@uniaria/elements/toggle-button`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { toggleButton } from './toggle-button';

export { toggleButton } from './toggle-button';
export type { PointerType, PressEvent } from '../../dom';

export type ToggleButtonProps = PropsOf<typeof toggleButton>;
export type ToggleButtonState = StateOf<typeof toggleButton>;
