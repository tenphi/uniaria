/** The elements and default styles the popover page's demos use. */

// Button and NumberField first: a host that upgrades before the elements
// nested in it are defined takes their parts for its own.
import '@uniaria/elements/button';
import '@uniaria/elements/number-field';
import '@uniaria/elements/popover';

import css from 'uniaria-styles:popover,button,number-field';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
