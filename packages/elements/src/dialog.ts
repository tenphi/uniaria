/**
 * `@uniaria/elements/dialog` — registers `<uni-dialog>` on import. It
 * wraps the trigger and the `<dialog>`; the dialog's `role` attribute sets
 * the role. `dismissable="false"` and `restore-focus="false"` turn off what
 * is on by default.
 *
 * ```html
 * <uni-dialog>
 *   <button data-element="Trigger">Delete file</button>
 *   <dialog class="uni-dialog" role="alertdialog">
 *     <h2 data-element="Title">Delete file</h2>
 *     <p data-element="Description">This can't be undone.</p>
 *     <form method="dialog">
 *       <button data-element="Close">Cancel</button>
 *       <button value="delete" autofocus>Delete</button>
 *     </form>
 *   </dialog>
 * </uni-dialog>
 * ```
 */

import { dialog } from '@uniaria/core/dialog';

import type { UniElement } from './define-element';
import { defineElement } from './define-element';

export type UniDialogElement = UniElement<typeof dialog>;

export const UniDialog = defineElement(dialog);

declare global {
  interface HTMLElementTagNameMap {
    'uni-dialog': UniDialogElement;
  }
}
