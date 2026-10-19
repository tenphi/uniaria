/**
 * `@uniaria/elements/button` — registers `<uni-button>` on import.
 *
 * ```html
 * <uni-button focusable-when-disabled>
 *   <button class="uni-button">Save</button>
 * </uni-button>
 * ```
 */

import { button } from '@uniaria/core/button';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniButtonElement = UniElement<typeof button>;

export const UniButton = defineElement(button);

declare global {
  interface HTMLElementTagNameMap {
    'uni-button': UniButtonElement;
  }
}
