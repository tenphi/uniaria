/**
 * `@tenphi/sous/radio` — the Radio definition, one option of a RadioGroup
 * (`@tenphi/sous/radio-group`). Render it with `useComponent(radio, props)`
 * from `@tenphi/sous-react` inside its group's `OwnerProvider`, or the
 * `<sous-radio>` element from `@tenphi/sous-elements/radio`.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { radio } from './radio';

export { radio } from './radio';

export type RadioProps = PropsOf<typeof radio>;
export type RadioState = StateOf<typeof radio>;
