import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { wrappedInputStyles } from '../shared/input';

/**
 * TextField: the shared column (`../shared/field.ts`), with the wrapper as
 * the input box and the input bare inside it (`../shared/input.ts`);
 * without a wrapper there is no box. A `textarea` grows from the same box
 * and can be resized vertically.
 */
export const textFieldStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,
  ...wrappedInputStyles,
} satisfies Styles;
