/** The elements and default styles the text-field page's demos use. */

import '@uniaria/elements/text-field';

import css from 'uniaria-styles:text-field';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
