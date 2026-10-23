/**
 * `@uniaria/core/radio` — the Radio definition, one option of a RadioGroup
 * (`@uniaria/core/radio-group`). Render it with `useBehavior(radio, props)`
 * from `@uniaria/react` inside its group's `OwnerProvider`, or the
 * `<uni-radio>` element from `@uniaria/elements/radio`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { radio } from './radio';

export { radio } from './radio';

export type RadioProps = PropsOf<typeof radio>;
export type RadioState = StateOf<typeof radio>;
