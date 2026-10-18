/**
 * `@uniaria/core/listbox` — the Listbox definition. Render it with
 * `useComponent(listbox, props)` and `getItemProps(part, key)` from
 * `@uniaria/react`, or the `<uni-listbox>` element from
 * `@uniaria/elements/listbox`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { listbox } from './listbox';

export { listbox } from './listbox';
export type { ItemSize, RenderedKeys } from './virtual-list';

export type ListboxProps = PropsOf<typeof listbox>;
export type ListboxState = StateOf<typeof listbox>;
