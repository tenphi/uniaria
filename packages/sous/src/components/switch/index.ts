/**
 * `@tenphi/sous/switch` — the Switch definition, `toggleSwitch`. Render it
 * with `useComponent(toggleSwitch, props)` from `@tenphi/sous-react` or the
 * `<sous-switch>` element from `@tenphi/sous-elements/switch`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { toggleSwitch } from './switch';

export { toggleSwitch } from './switch';

export type SwitchProps = PropsOf<typeof toggleSwitch>;
export type SwitchState = StateOf<typeof toggleSwitch>;
