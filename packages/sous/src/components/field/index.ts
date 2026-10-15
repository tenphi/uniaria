/**
 * `@tenphi/sous/field` — the Field definition. Render it with
 * `useComponent(field, props)` from `@tenphi/sous-react` or the `<sous-field>`
 * element from `@tenphi/sous-elements/field`, or compose it into an input
 * with `ctx.use(field, props, { parts: { control: 'input' } })`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { field } from './field';

export { field } from './field';

export type FieldProps = PropsOf<typeof field>;
export type FieldState = StateOf<typeof field>;
