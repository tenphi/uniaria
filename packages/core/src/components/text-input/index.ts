/**
 * `@uniaria/core/text-input` — the TextInput definition: a native input with
 * TextField's value handling and no labelling, for definitions that compose
 * it (composition spec). It has no element; React and Vue render it with
 * `useBehavior(textInput, props)`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { textInput } from './text-input';

export { textInput } from './text-input';

export type TextInputProps = PropsOf<typeof textInput>;
export type TextInputState = StateOf<typeof textInput>;
