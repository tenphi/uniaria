import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { boxButtonStyles, wrappedInputStyles } from '../shared/input';

/**
 * NumberField: TextField's look (`../shared/input.ts`), the number at the
 * input's end as in UI Kit, in digits of one width, and the steppers
 * beside it as quiet buttons in the box. UI Kit stacks two half-height
 * steppers; here each keeps the 24-pixel target (WCAG 2.5.8).
 */
export const numberFieldStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as TextField's
  ...fieldStackStyles,
  ...wrappedInputStyles,

  Input: {
    // eslint-disable-next-line tasty/no-style-spread -- TextField's input; the alignment is NumberField's
    ...wrappedInputStyles.Input,
    textAlign: 'end',
    fontVariantNumeric: 'tabular-nums',
  },
  Increment: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared button in the box
    ...boxButtonStyles,
  },
  Decrement: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared button in the box
    ...boxButtonStyles,
  },
} satisfies Styles;
