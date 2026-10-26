/**
 * `@uniaria/elements/form` — registers `<uni-form>` on import. It wraps the
 * consumer's `<form>`, which is its root part; the fields inside find it and
 * bind to it by `name`. Without `handleSubmit`, a valid form posts natively.
 *
 * ```html
 * <uni-form>
 *   <form data-uni="form" action="/signup" method="post" novalidate>
 *     <uni-text-field required>
 *       <label data-element="Label">Email</label>
 *       <input data-element="Input" name="email" type="email" />
 *       <p data-element="Error"><span data-element="ErrorText"></span></p>
 *     </uni-text-field>
 *     <button type="submit">Sign up</button>
 *   </form>
 * </uni-form>
 * ```
 */

import { form } from '@uniaria/core/form';

import type { UniElement, UniElementConstructor } from './define-element';
import { defineElement } from './define-element';

export type UniFormElement = UniElement<typeof form>;

// Annotated, as every element is: see `UniElementConstructor`.
export const UniForm: UniElementConstructor<typeof form> | undefined =
  defineElement(form);

declare global {
  interface HTMLElementTagNameMap {
    'uni-form': UniFormElement;
  }
}
