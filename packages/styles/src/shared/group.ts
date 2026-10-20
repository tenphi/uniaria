import type { Styles } from '@tenphi/tasty';

import {
  fieldDescriptionStyles,
  fieldErrorStyles,
  fieldLabelStyles,
} from './field';

/**
 * The layout CheckboxGroup and RadioGroup share, as UI Kit's: the label,
 * the items a column apart by 8 pixels, the description and error 4
 * pixels under them. `data-orientation="horizontal"` wraps the items in a
 * row, 16 pixels apart, with the label, description and error each on a
 * line of its own. A `fieldset` root loses its border and padding.
 */
export const fieldGroupStyles = {
  display: 'flex',
  flow: { '': 'column', 'orientation=horizontal': 'row wrap' },
  alignItems: 'start',
  gap: { '': '1x', 'orientation=horizontal': '1x 2x' },
  margin: 0,
  padding: 0,
  border: '0 #clear',

  Label: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldLabelStyles,
    flexBasis: { '': 'auto', 'orientation=horizontal': '100%' },
  },
  Description: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldDescriptionStyles,
    flexBasis: { '': 'auto', 'orientation=horizontal': '100%' },
    blockMargin: '-.5x start',
  },
  Error: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared field text
    ...fieldErrorStyles,
    flexBasis: { '': 'auto', 'orientation=horizontal': '100%' },
    blockMargin: '-.5x start',
  },
} satisfies Styles;
