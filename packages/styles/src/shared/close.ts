import type { Styles } from '@tenphi/tasty';

import { buttonStyles } from '../components/button';

/** States of the page, not of any element: they stay as they are. */
const MEDIA = new Set(['@uni-forced-colors', '@uni-reduced-motion']);

/**
 * A root's styles for a part that is a component of its own: every state
 * a key tests becomes the part's own (`@own()`), media aside.
 */
function asOwnPart(styles: Styles): Styles {
  return Object.fromEntries(
    Object.entries(styles).map(([name, value]) => {
      if (typeof value !== 'object' || value === null) return [name, value];
      return [
        name,
        Object.fromEntries(
          Object.entries(value).map(([key, at]) => [
            key.replace(/@?[a-z][\w-]*(?:=[\w-]+)?/g, (term) =>
              MEDIA.has(term) ? term : `@own(${term})`,
            ),
            at,
          ]),
        ),
      ];
    }),
  ) as Styles;
}

/**
 * An overlay's close part, Dialog's and Popover's: a Button, which UniAria
 * writes Button's state attributes on, so it takes Button's look from its
 * own state, `data-variant` included (`../components/button.ts`). At the
 * end of the overlay's column.
 */
export const closeStyles: Styles = {
  // eslint-disable-next-line tasty/no-style-spread -- Button's look, on the part's own state
  ...asOwnPart(buttonStyles),
  alignSelf: 'end',
};
