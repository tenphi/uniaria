/** The elements and default styles the radio-group page's demos use. */

import '@uniaria/elements/radio-group';
import '@uniaria/elements/radio';

import css from 'uniaria-styles:radio-group,radio';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
