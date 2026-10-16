/**
 * `@uniaria/core/checkbox-group` — the CheckboxGroup definition. Render it
 * with `useComponent(checkboxGroup, props)` from `@uniaria/react`, its
 * checkboxes inside `<OwnerProvider owner={group}>`, or the
 * `<uni-checkbox-group>` element from `@uniaria/elements/checkbox-group`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { checkboxGroup } from './checkbox-group';

export { checkboxGroup } from './checkbox-group';

export type CheckboxGroupProps = PropsOf<typeof checkboxGroup>;
export type CheckboxGroupState = StateOf<typeof checkboxGroup>;
