/**
 * `@tenphi/sous/checkbox` — the Checkbox definition. Render it with
 * `useComponent(checkbox, props)` from `@tenphi/sous-react` or the
 * `<sous-checkbox>` element from `@tenphi/sous-elements/checkbox`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { checkbox } from './checkbox';

export { checkbox } from './checkbox';

export type CheckboxProps = PropsOf<typeof checkbox>;
export type CheckboxState = StateOf<typeof checkbox>;
