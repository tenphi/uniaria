/**
 * `@uniaria/core/combobox` — the Combobox definition. Render it with
 * `useBehavior(combobox, props)` and `getItemProps(part, key)` from
 * `@uniaria/react`, or the `<uni-combobox>` element from
 * `@uniaria/elements/combobox`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { combobox } from './combobox';

export { combobox } from './combobox';
export type { ComboboxFilter, ComboboxPopoverTrigger } from './combobox';

export type ComboboxProps = PropsOf<typeof combobox>;
export type ComboboxState = StateOf<typeof combobox>;
