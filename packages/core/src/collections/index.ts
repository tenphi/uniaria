/**
 * `@uniaria/core/collections` — items as data (design decision 5): keys,
 * navigation, selection and typeahead, plus lazy per-item part props for
 * virtualization. DOM-free; compiled without the DOM lib.
 */

export { createTypeahead, findByText } from './typeahead';
export type {
  FindByTextOptions,
  Typeahead,
  TypeaheadInput,
  TypeaheadResult,
} from './typeahead';
