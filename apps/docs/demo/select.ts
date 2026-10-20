/** The elements and default styles the select page's demos use. */

import '@uniaria/elements/button';
import '@uniaria/elements/select';

import css from 'uniaria-styles:select,button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
