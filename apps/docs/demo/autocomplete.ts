/** The elements and default styles the autocomplete page's demos use. */

import '@uniaria/elements/autocomplete';

import css from 'uniaria-styles:autocomplete';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
