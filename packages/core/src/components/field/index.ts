/**
 * `@uniaria/core/field` — the Field definition. Render it with
 * `useBehavior(field, props)` from `@uniaria/react` or the `<uni-field>`
 * element from `@uniaria/elements/field`, or compose it into an input
 * with `ctx.use(field, props, { parts: { control: 'input' } })`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { field } from './field';

export { field } from './field';

export type FieldProps = PropsOf<typeof field>;
export type FieldState = StateOf<typeof field>;
