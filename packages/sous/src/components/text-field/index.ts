/**
 * `@tenphi/sous/text-field` — the TextField definition. Render it with
 * `useComponent(textField, props)` from `@tenphi/sous-react` or the
 * `<sous-text-field>` element from `@tenphi/sous-elements/text-field`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { textField } from './text-field';

export { textField } from './text-field';

export type TextFieldProps = PropsOf<typeof textField>;
export type TextFieldState = StateOf<typeof textField>;
