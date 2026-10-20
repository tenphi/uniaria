import type { Styles } from '@tenphi/tasty';

import { fieldGroupStyles } from '../shared/group';

/**
 * RadioGroup: the shared group layout (`../shared/group.ts`), a row with
 * `orientation="horizontal"`.
 */
export const radioGroupStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared group layout, the same as CheckboxGroup's
  ...fieldGroupStyles,
} satisfies Styles;
