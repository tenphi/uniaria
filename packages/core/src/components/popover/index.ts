/**
 * `@uniaria/core/popover` — the Popover definition. Render it with
 * `useComponent(popover, props)` from `@uniaria/react` or the
 * `<uni-popover>` element from `@uniaria/elements/popover`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { popover } from './popover';

export { popover } from './popover';
export type { PopoverDismissEvent, PopoverDismissReason } from './popover';
export type { Placement, PlacementSide } from '../../dom';

export type PopoverProps = PropsOf<typeof popover>;
export type PopoverState = StateOf<typeof popover>;
