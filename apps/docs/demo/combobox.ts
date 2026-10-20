/** The elements and default styles the combobox page's demos use. */

import '@uniaria/elements/combobox';

import css from 'uniaria-styles:combobox';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
