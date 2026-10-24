/**
 * `@uniaria/core/dialog` — the Dialog definition. Render it with
 * `useBehavior(dialog, props)` from `@uniaria/react` or the
 * `<uni-dialog>` element from `@uniaria/elements/dialog`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { dialog } from './dialog';

export { dialog } from './dialog';
export type { DialogDismissEvent, DialogDismissReason } from './dialog';

export type DialogProps = PropsOf<typeof dialog>;
export type DialogState = StateOf<typeof dialog>;
