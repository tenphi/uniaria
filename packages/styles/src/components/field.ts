import type { Styles } from '@tenphi/tasty';

import {
  fieldDescriptionStyles,
  fieldErrorStyles,
  fieldLabelStyles,
  textControlStyles,
} from '../shared/field';

/**
 * Field: UI Kit's column, the label 8 pixels over the control, the
 * description and error 4 pixels under it. A native text control takes
 * the input box (`textControlStyles`); any other control keeps its own
 * look.
 */
export const fieldStyles = {
  display: 'grid',
  gap: '.5x',

  // eslint-disable-next-line tasty/no-style-spread -- the shared text control box, the same as TextField's
  ...textControlStyles,

  Label: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldLabelStyles,
    blockMargin: '0 .5x',
  },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldDescriptionStyles,
  },
  Error: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldErrorStyles,
  },
} satisfies Styles;
