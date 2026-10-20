/** The elements and default styles the checkbox-group page's demos use. */

import '@uniaria/elements/checkbox-group';
import '@uniaria/elements/checkbox';

import css from 'uniaria-styles:checkbox-group,checkbox';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);
