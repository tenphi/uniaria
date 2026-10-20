/** The elements and default styles the listbox page's demos use. */

import '@uniaria/elements/listbox';

import css from 'uniaria-styles:listbox';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
