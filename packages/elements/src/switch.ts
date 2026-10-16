/**
 * `@uniaria/elements/switch` — registers `<uni-switch>` on import. The
 * input's markup `checked`, or a click before upgrade, becomes the default.
 *
 * ```html
 * <uni-switch>
 *   <label data-part="root">
 *     <input data-part="input" type="checkbox" name="wifi" />
 *     <span data-part="indicator"><span class="thumb"></span></span>
 *     <span data-part="label">Wi-Fi</span>
 *   </label>
 * </uni-switch>
 * ```
 */

import { toggleSwitch } from '@uniaria/core/switch';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniSwitchElement = UniElement<typeof toggleSwitch>;

export const UniSwitch = defineElement(toggleSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'uni-switch': UniSwitchElement;
  }
}
