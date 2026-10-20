/** The elements and default styles the number-field page's demos use. */

import '@uniaria/elements/button';
import '@uniaria/elements/number-field';

import css from 'uniaria-styles:number-field,button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
