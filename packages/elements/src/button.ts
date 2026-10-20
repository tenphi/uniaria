/**
 * `@uniaria/elements/button` — registers `<uni-button>` on import.
 *
 * ```html
 * <uni-button focusable-when-disabled>
 *   <button data-uni="button">Save</button>
 * </uni-button>
 * ```
 */

import { button } from '@uniaria/core/button';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniButtonElement = UniElement<typeof button>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniButton: UniElementConstructor<typeof button> | undefined =
  defineElement(button);

declare global {
  interface HTMLElementTagNameMap {
    'uni-button': UniButtonElement;
  }
}
