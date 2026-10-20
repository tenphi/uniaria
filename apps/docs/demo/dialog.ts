/** The elements and default styles the dialog page's demos use. */

// Button first: a host that upgrades before the elements nested in it are
// defined takes their parts for its own.
import '@uniaria/elements/button';
import '@uniaria/elements/dialog';

import css from 'uniaria-styles:dialog,button';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
