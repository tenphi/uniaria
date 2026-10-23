/**
 * `@uniaria/core/radio-group` — the RadioGroup definition. Render it with
 * `useBehavior(radioGroup, props)` from `@uniaria/react`, its radios
 * (`@uniaria/core/radio`) inside `<OwnerProvider owner={group}>`, or the
 * `<uni-radio-group>` element from `@uniaria/elements/radio-group`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { radioGroup } from './radio-group';

export { radioGroup } from './radio-group';

export type RadioGroupProps = PropsOf<typeof radioGroup>;
export type RadioGroupState = StateOf<typeof radioGroup>;
