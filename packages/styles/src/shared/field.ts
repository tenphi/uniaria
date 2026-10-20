import type { Styles } from '@tenphi/tasty';

import { inputBoxStyles, inputTextStyles } from './input';

/**
 * A field's label, as Field and the groups show it: UI Kit's 14/20 at
 * weight 500. A checkbox's or a radio's own label is the row's text.
 */
export const fieldLabelStyles = {
  margin: 0,
  color: {
    '': '#uni-text',
    disabled: '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
    '(@uni-forced-colors & disabled)': '#uni-system-gray-text',
  },
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',
} satisfies Styles;

/**
 * A field's description and error, as every field shows them: small text
 * (UI Kit's 12/18 at weight 500), soft or in the danger theme. A field
 * hides its error with `hidden`, so neither sets `display` (spec:
 * Specificity and overrides). Disabled is the component's own state: in a
 * group, `:has()` would find any disabled item.
 */
export const fieldDescriptionStyles = {
  margin: 0,
  color: {
    '': '#uni-text-soft',
    disabled: '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
    '(@uni-forced-colors & disabled)': '#uni-system-gray-text',
  },
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size-small',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height-small',
} satisfies Styles;

export const fieldErrorStyles = {
  margin: 0,
  color: {
    '': '#uni-danger-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
  },
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size-small',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height-small',
} satisfies Styles;

/**
 * A field's column, as UI Kit's: the label 8 pixels over what it names,
 * the description and error 4 pixels under it. Field, TextField and
 * NumberField share it.
 */
export const fieldStackStyles = {
  display: 'grid',
  // As UI Kit's: the column narrows with the field, below its content's width.
  gridColumns: 'minmax(0, 1fr)',
  gap: '.5x',

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

/**
 * Field's control as the input box (`./input.ts`), with 7 pixels inside
 * its border. Only a native text control takes it, so a group of radios as
 * the control keeps its own look.
 */
export const textControlStyles = {
  Control: {
    // eslint-disable-next-line tasty/no-nested-selector -- the control is any element, and only a native text control is a box; a sub-element can't say which it is
    '&:where(input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"]), textarea, select)':
      {
        // eslint-disable-next-line tasty/no-style-spread -- the shared input box
        ...inputBoxStyles,
        // eslint-disable-next-line tasty/no-style-spread -- the shared input text
        ...inputTextStyles,
        padding:
          '(($uni-control-height - $uni-line-height) / 2 - 1bw) (1x - 1bw)',
      },
  },
} satisfies Styles;
