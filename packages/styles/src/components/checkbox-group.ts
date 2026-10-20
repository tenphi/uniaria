import type { Styles } from '@tenphi/tasty';

import { fieldGroupStyles } from '../shared/group';

/**
 * CheckboxGroup: the shared group layout (`../shared/group.ts`). UniAria
 * writes no `data-orientation` on it (CheckboxGroup's spec: a layout
 * without ARIA); write `data-orientation="horizontal"` yourself for a row.
 */
export const checkboxGroupStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared group layout, the same as RadioGroup's
  ...fieldGroupStyles,
} satisfies Styles;
