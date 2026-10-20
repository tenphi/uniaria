import type { Styles } from '@tenphi/tasty';

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
 * Field's control as a box you type in: UI Kit's input, a control-height
 * box with one line of text and 7 pixels inside its border. Only a native
 * text control takes it, so a group of radios as the control keeps its
 * own look. Its focus ring is the control's own `:focus-visible`, which a
 * text control matches on any focus; while invalid it is the danger
 * theme's.
 */
export const textControlStyles = {
  Control: {
    // eslint-disable-next-line tasty/no-nested-selector -- the control is any element, and only a native text control is a box; a sub-element can't say which it is
    '&:where(input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"]), textarea, select)':
      {
        boxSizing: 'border-box',
        blockSize: 'min max(24px, $uni-control-height)',
        margin: 0,
        padding:
          '(($uni-control-height - $uni-line-height) / 2 - 1bw) (1x - 1bw)',
        radius: '1r',
        fill: {
          '': '#uni-surface',
          'disabled | @own(@uni-disabled)': '#uni-disabled-surface',
        },
        border: {
          '': '1bw #uni-border',
          invalid: '1bw #uni-danger-border',
          'disabled | @own(@uni-disabled)': '1bw #uni-disabled-border',
        },
        color: {
          '': '#uni-text',
          'disabled | @own(@uni-disabled)': '#uni-disabled-text',
        },
        outline: {
          '': '0 #clear / 1bw',
          '@own(@uni-focus-visible)': '1ow #uni-accent-outline / 1bw',
          '@own(@uni-focus-visible) & invalid': '1ow #uni-danger-outline / 1bw',
          '@own(@uni-focus-visible) & @uni-forced-colors':
            '1ow #uni-system-highlight / 1bw',
        },
        // No presets: the type follows the page, sizes come from the uni tokens.
        fontFamily: 'inherit',
        fontSize: '$uni-font-size',
        lineHeight: '$uni-line-height',
        transition: {
          '': 'border $uni-transition',
          '@uni-reduced-motion': false,
        },

        '&::placeholder': { color: '#uni-text-soft' },
      },
  },
} satisfies Styles;
