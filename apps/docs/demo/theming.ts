/**
 * The theming page's swatches: every role of every theme, in the light and
 * the dark scheme, from the palette's own lists and the default tokens.
 */

import { colorToken, ROLES, THEMES } from '@uniaria/styles/palette';
import css from 'uniaria-styles:';

// First in the head, so the demo's own CSS comes after it.
document.head.prepend(
  Object.assign(document.createElement('style'), { textContent: css }),
);

const cell = (tag: 'th' | 'td', text = '') =>
  Object.assign(document.createElement(tag), { textContent: text });

for (const table of document.querySelectorAll<HTMLTableElement>(
  'table[data-swatches]',
)) {
  const head = table.createTHead().insertRow();
  head.append(cell('th'), ...THEMES.map((theme) => cell('th', theme)));
  const body = table.createTBody();
  for (const role of ROLES) {
    const row = body.insertRow();
    row.append(cell('th', role));
    for (const theme of THEMES) {
      const property = `--${colorToken(theme, role).slice(1)}-color`;
      const swatch = cell('td');
      swatch.title = property;
      swatch.style.setProperty('--swatch', `var(${property})`);
      row.append(swatch);
    }
  }
}
