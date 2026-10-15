/**
 * `@tenphi/sous/toggle-button` — the ToggleButton definition. Render it with
 * `useComponent(toggleButton, props)` from `@tenphi/sous-react` or the
 * `<sous-toggle-button>` element from `@tenphi/sous-elements/toggle-button`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { toggleButton } from './toggle-button';

export { toggleButton } from './toggle-button';
export type { PointerType, PressEvent } from '../../dom';

export type ToggleButtonProps = PropsOf<typeof toggleButton>;
export type ToggleButtonState = StateOf<typeof toggleButton>;
