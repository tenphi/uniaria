/**
 * `@tenphi/sous-elements/switch` — registers `<sous-switch>` on import. The
 * input's markup `checked`, or a click before upgrade, becomes the default.
 *
 * ```html
 * <sous-switch>
 *   <label data-part="root">
 *     <input data-part="input" type="checkbox" name="wifi" />
 *     <span data-part="indicator"><span class="thumb"></span></span>
 *     <span data-part="label">Wi-Fi</span>
 *   </label>
 * </sous-switch>
 * ```
 */

import { toggleSwitch } from '@tenphi/sous/switch';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousSwitchElement = SousElement<typeof toggleSwitch>;

export const SousSwitch = defineElement(toggleSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'sous-switch': SousSwitchElement;
  }
}
