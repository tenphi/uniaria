/**
 * `@uniaria/core/button` — the Button definition. Render it with
 * `useComponent(button, props)` from `@uniaria/react` or the
 * `<uni-button>` element from `@uniaria/elements/button`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { button } from './button';

export { button } from './button';
export type { PointerType, PressEvent } from '../../dom';

export type ButtonProps = PropsOf<typeof button>;
export type ButtonState = StateOf<typeof button>;
