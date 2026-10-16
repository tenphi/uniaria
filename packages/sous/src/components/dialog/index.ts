/**
 * `@tenphi/sous/dialog` — the Dialog definition. Render it with
 * `useComponent(dialog, props)` from `@tenphi/sous-react` or the
 * `<sous-dialog>` element from `@tenphi/sous-elements/dialog`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { dialog } from './dialog';

export { dialog } from './dialog';
export type { DialogDismissEvent, DialogDismissReason } from './dialog';

export type DialogProps = PropsOf<typeof dialog>;
export type DialogState = StateOf<typeof dialog>;
