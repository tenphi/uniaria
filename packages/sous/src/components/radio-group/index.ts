/**
 * `@tenphi/sous/radio-group` — the RadioGroup definition. Render it with
 * `useComponent(radioGroup, props)` from `@tenphi/sous-react`, its radios
 * (`@tenphi/sous/radio`) inside `<OwnerProvider owner={group}>`, or the
 * `<sous-radio-group>` element from `@tenphi/sous-elements/radio-group`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { radioGroup } from './radio-group';

export { radioGroup } from './radio-group';

export type RadioGroupProps = PropsOf<typeof radioGroup>;
export type RadioGroupState = StateOf<typeof radioGroup>;
