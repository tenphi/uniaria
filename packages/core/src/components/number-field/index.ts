/**
 * `@uniaria/core/number-field` — the NumberField definition. Render it with
 * `useComponent(numberField, props)` from `@uniaria/react` or the
 * `<uni-number-field>` element from `@uniaria/elements/number-field`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { numberField } from './number-field';

export { numberField } from './number-field';

export type NumberFieldProps = PropsOf<typeof numberField>;
export type NumberFieldState = StateOf<typeof numberField>;
