/** The elements and default styles the button page's demos use. */

import '@uniaria/elements/button';

import css from 'uniaria-styles:button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
