/**
 * `@uniaria/elements/tooltip` — registers `<uni-tooltip>` on import. It wraps
 * what it describes and the tooltip: a UniAria element directly inside it
 * links itself (`<uni-button>`), else the trigger part is a plain element.
 * A UniAria element elsewhere links with a `tooltip` attribute naming its
 * id. `delay`, `close-delay`, `trigger`, `relation`, `position-area` and
 * `position-try-fallbacks` take the props' values.
 *
 * ```html
 * <uni-tooltip position-area="top">
 *   <uni-button><button class="uni-button">Save</button></uni-button>
 *   <div class="uni-tooltip">
 *     Saves the file
 *     <div data-element="Arrow"></div>
 *   </div>
 * </uni-tooltip>
 * ```
 */

import { tooltip } from '@uniaria/core/tooltip';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniTooltipElement = UniElement<typeof tooltip>;

export const UniTooltip = defineElement(tooltip);

declare global {
  interface HTMLElementTagNameMap {
    'uni-tooltip': UniTooltipElement;
  }
}
