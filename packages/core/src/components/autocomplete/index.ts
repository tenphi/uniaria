/**
 * `@uniaria/core/autocomplete` — the Autocomplete definition. Render it with
 * `useBehavior(autocomplete, props)` and `getItemProps(part, key)` from
 * `@uniaria/react`, or the `<uni-autocomplete>` element from
 * `@uniaria/elements/autocomplete`. Definitions compose it in popup mode
 * (`hasPopup`), as Combobox does.
 */

import type { PropsOf, StateOf } from '../../runtime';
import type { autocomplete } from './autocomplete';

export { autocomplete } from './autocomplete';
export type {
  AutocompleteFilter,
  AutocompletePopupTrigger,
} from './autocomplete';

export type AutocompleteProps = PropsOf<typeof autocomplete>;
export type AutocompleteState = StateOf<typeof autocomplete>;
