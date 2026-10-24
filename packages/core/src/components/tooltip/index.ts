/**
 * `@uniaria/core/tooltip` — the Tooltip definition. Render it with
 * `useBehavior(tooltip, props)` from `@uniaria/react` or the
 * `<uni-tooltip>` element from `@uniaria/elements/tooltip`. Components take
 * a tooltip through `tooltipLink`, from `./link`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { tooltip } from './tooltip';

export { tooltip } from './tooltip';
export { linkTooltip, tooltipLink } from './link';
export type {
  TooltipLinkApi,
  TooltipParts,
  TooltipRelation,
  TooltipTarget,
} from './link';
export type { PlacementSide, PositionArea } from '../../dom';

export type TooltipProps = PropsOf<typeof tooltip>;
export type TooltipState = StateOf<typeof tooltip>;
