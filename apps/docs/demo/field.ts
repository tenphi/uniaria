/** The elements and default styles the field page's demos use. */

import '@uniaria/elements/button';
import '@uniaria/elements/checkbox';
import '@uniaria/elements/field';

import css from 'uniaria-styles:field,checkbox,button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
