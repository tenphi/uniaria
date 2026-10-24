/** The elements and default styles the form page's demos use. */

import '@uniaria/elements/button';
import '@uniaria/elements/checkbox';
import '@uniaria/elements/form';
import '@uniaria/elements/text-field';

import css from 'uniaria-styles:text-field,checkbox,button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
