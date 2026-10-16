/**
 * `@tenphi/sous/checkbox-group` — the CheckboxGroup definition. Render it
 * with `useComponent(checkboxGroup, props)` from `@tenphi/sous-react`, its
 * checkboxes inside `<OwnerProvider owner={group}>`, or the
 * `<sous-checkbox-group>` element from `@tenphi/sous-elements/checkbox-group`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { checkboxGroup } from './checkbox-group';

export { checkboxGroup } from './checkbox-group';

export type CheckboxGroupProps = PropsOf<typeof checkboxGroup>;
export type CheckboxGroupState = StateOf<typeof checkboxGroup>;
