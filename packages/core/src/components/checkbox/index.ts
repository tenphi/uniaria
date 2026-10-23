/**
 * `@uniaria/core/checkbox` — the Checkbox definition. Render it with
 * `useBehavior(checkbox, props)` from `@uniaria/react` or the
 * `<uni-checkbox>` element from `@uniaria/elements/checkbox`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { checkbox } from './checkbox';

export { checkbox } from './checkbox';

export type CheckboxProps = PropsOf<typeof checkbox>;
export type CheckboxState = StateOf<typeof checkbox>;
