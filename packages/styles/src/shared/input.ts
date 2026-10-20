import type { Styles } from '@tenphi/tasty';

/**
 * The input box, as UI Kit draws it: a control-height box with a 1-pixel
 * border, in the danger border while invalid and the disabled theme while
 * disabled. Its focus ring shows on any focus within it, as a text control
 * shows focus, in the danger theme's outline while invalid. Field's
 * control, TextField's and NumberField's wrapper, and an input without a
 * wrapper take it.
 */
/* eslint-disable tasty/no-own-at-root -- spread into parts only, where @own() reads the part's own state */
export const inputBoxStyles = {
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  blockSize: 'min max(24px, $uni-control-height)',
  radius: '1r',
  fill: {
    '': '#uni-surface',
    '(@uni-input-disabled | @own(@uni-disabled))': '#uni-disabled-surface',
  },
  border: {
    '': '1bw #uni-border',
    invalid: '1bw #uni-danger-border',
    '(@uni-input-disabled | @own(@uni-disabled))': '1bw #uni-disabled-border',
  },
  color: {
    '': '#uni-text',
    '(@uni-input-disabled | @own(@uni-disabled))': '#uni-disabled-text',
  },
  outline: {
    '': '0 #clear / 1bw',
    '@own(@uni-focused)': '1ow #uni-accent-outline / 1bw',
    '@own(@uni-focused) & invalid': '1ow #uni-danger-outline / 1bw',
    '@own(@uni-focused) & @uni-forced-colors':
      '1ow #uni-system-highlight / 1bw',
  },
  transition: {
    '': 'border $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;
/* eslint-enable tasty/no-own-at-root */

/** The text you type: one line of the page's type, a soft placeholder. */
export const inputTextStyles = {
  margin: 0,
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',

  '&::placeholder': { color: '#uni-text-soft' },
} satisfies Styles;

/**
 * TextField's and NumberField's wrapper and input. The wrapper is the box
 * (TextField spec: where a design system draws it), with 7 pixels inside
 * its border and 4 between what it holds, so your prefix or suffix sits
 * beside the input; a press on it focuses the input. The input is bare:
 * without a wrapper there is no box (Field draws one around a native
 * input).
 */
export const wrappedInputStyles = {
  Wrapper: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared input box
    ...inputBoxStyles,
    display: 'flex',
    alignItems: 'center',
    gap: '.5x',
    padding: '0 (1x - 1bw)',
    cursor: { '': 'text', '@uni-input-disabled': 'default' },
  },

  Input: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared input text
    ...inputTextStyles,
    flexGrow: 1,
    // eslint-disable-next-line tasty/prefer-shorthand-property -- only the minimum: an input keeps its intrinsic width as a flex item otherwise
    minInlineSize: 0,
    padding: '(($uni-control-height - $uni-line-height) / 2 - 1bw) 0',
    border: '0 #clear',
    radius: 0,
    fill: '#clear',
    color: 'inherit',
    outline: '0 #clear',
    resize: 'vertical',
  },
} satisfies Styles;
