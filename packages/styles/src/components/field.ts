import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles, textControlStyles } from '../shared/field';

/**
 * Field: the shared column (`../shared/field.ts`). A native text control
 * becomes the input box (`textControlStyles`); any other control keeps
 * its own look.
 */
export const fieldStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as TextField's
  ...fieldStackStyles,
  ...textControlStyles,
} satisfies Styles;
