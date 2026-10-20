import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { boxButtonStyles, wrappedInputStyles } from '../shared/input';
import { chevronStyles } from '../shared/marks';
import { popupStyles } from '../shared/popup';

/**
 * Combobox: TextField's look (`../shared/input.ts`) with the anchor as
 * the box around the input and the button, which is NumberField's quiet
 * button in the box, drawing a chevron; and the picker's popup
 * (`../shared/popup.ts`). The box keeps its ring while the keys move the
 * highlight through the list, since focus stays in the input.
 */
export const comboboxStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,

  Anchor: {
    // eslint-disable-next-line tasty/no-style-spread -- TextField's wrapper
    ...wrappedInputStyles.Wrapper,
  },
  Input: {
    // eslint-disable-next-line tasty/no-style-spread -- TextField's input
    ...wrappedInputStyles.Input,
  },
  Button: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared button in the box
    ...boxButtonStyles,

    '&::before': {
      // eslint-disable-next-line tasty/no-style-spread -- the shared chevron
      ...chevronStyles,
    },
  },

  ...popupStyles,
} satisfies Styles;
