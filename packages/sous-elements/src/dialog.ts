/**
 * `@tenphi/sous-elements/dialog` — registers `<sous-dialog>` on import. It
 * wraps the trigger and the `<dialog>`; the dialog's `role` attribute sets
 * the role. `dismissable="false"` and `restore-focus="false"` turn off what
 * is on by default.
 *
 * ```html
 * <sous-dialog>
 *   <button data-part="trigger">Delete file</button>
 *   <dialog data-part="root" role="alertdialog">
 *     <h2 data-part="title">Delete file</h2>
 *     <p data-part="description">This can't be undone.</p>
 *     <form method="dialog">
 *       <button data-part="close">Cancel</button>
 *       <button value="delete" autofocus>Delete</button>
 *     </form>
 *   </dialog>
 * </sous-dialog>
 * ```
 */

import { dialog } from '@tenphi/sous/dialog';

import type { SousElement } from './define-element';
import { defineElement } from './define-element';

export type SousDialogElement = SousElement<typeof dialog>;

export const SousDialog = defineElement(dialog);

declare global {
  interface HTMLElementTagNameMap {
    'sous-dialog': SousDialogElement;
  }
}
