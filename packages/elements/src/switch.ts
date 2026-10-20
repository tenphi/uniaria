/**
 * `@uniaria/elements/switch` — registers `<uni-switch>` on import. The
 * input's markup `checked`, or a click before upgrade, becomes the default.
 * With a description or an error, the root holds them and a `label` wrapper,
 * as on `<uni-checkbox>`.
 *
 * ```html
 * <uni-switch>
 *   <label data-uni="switch">
 *     <input data-element="Input" type="checkbox" name="wifi" />
 *     <span data-element="Indicator"><span class="thumb"></span></span>
 *     <span data-element="Label">Wi-Fi</span>
 *   </label>
 * </uni-switch>
 * ```
 */

import { toggleSwitch } from '@uniaria/core/switch';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniSwitchElement = UniElement<typeof toggleSwitch>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniSwitch: UniElementConstructor<typeof toggleSwitch> | undefined =
  defineElement(toggleSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'uni-switch': UniSwitchElement;
  }
}
