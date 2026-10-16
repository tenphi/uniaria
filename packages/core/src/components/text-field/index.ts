/**
 * `@uniaria/core/text-field` — the TextField definition. Render it with
 * `useComponent(textField, props)` from `@uniaria/react` or the
 * `<uni-text-field>` element from `@uniaria/elements/text-field`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { textField } from './text-field';

export { textField } from './text-field';

export type TextFieldProps = PropsOf<typeof textField>;
export type TextFieldState = StateOf<typeof textField>;
