/** The elements and default styles the switch page's demos use. */

import '@uniaria/elements/switch';

import css from 'uniaria-styles:switch';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
