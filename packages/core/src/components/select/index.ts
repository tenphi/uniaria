/**
 * `@uniaria/core/select` — the Select definition. Render it with
 * `useComponent(select, props)` and `getItemProps(part, key)` from
 * `@uniaria/react`, or the `<uni-select>` element from
 * `@uniaria/elements/select`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { select } from './select';

export { select } from './select';

export type SelectProps = PropsOf<typeof select>;
export type SelectState = StateOf<typeof select>;
