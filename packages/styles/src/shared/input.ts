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
    '@own(@uni-focused) & @uni-forced-colors': '1ow Highlight / 1bw',
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

/**
 * A quiet 24-pixel button inside the box, in markup order beside the
 * input: NumberField's steppers, Combobox's button. At the box's edge it
 * sits as far from the edge as from the top and bottom (the inset), its
 * corners concentric with the box's. It reads its own state, which
 * UniAria writes as Button's: a stepper is disabled while it can't step.
 */
/* eslint-disable tasty/no-own-at-root -- spread into button parts, where @own() reads the button's own state */
export const boxButtonStyles = {
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  inlineSize: 'fixed max(24px, 3x)',
  // eslint-disable-next-line tasty/consistent-token-usage -- as above
  blockSize: 'fixed max(24px, 3x)',
  blockMargin: 0,
  // The wrapper's padding, less the inset, at the box's edge.
  inlineMargin: {
    '': 0,
    '@own(@uni-first)':
      // eslint-disable-next-line tasty/consistent-token-usage -- the button's size, as above
      '((($uni-control-height - 2bw - max(24px, 3x)) / 2) - (1x - 1bw)) start',
    '@own(@uni-last)':
      // eslint-disable-next-line tasty/consistent-token-usage -- as above
      '((($uni-control-height - 2bw - max(24px, 3x)) / 2) - (1x - 1bw)) end',
  },
  padding: 0,
  border: '0 #clear',
  // eslint-disable-next-line tasty/consistent-token-usage -- as above
  radius: '(1r - 1bw - (($uni-control-height - 2bw - max(24px, 3x)) / 2))',
  fill: {
    '': '#clear',
    '@own(hovered)': '#uni-surface-hover',
    '@own(pressed)': '#uni-surface-pressed',
    '@own(disabled)': '#clear',
    '@uni-forced-colors': 'ButtonFace',
  },
  color: {
    '': '#uni-text',
    '@own(disabled)': '#uni-disabled-text',
    '@uni-forced-colors': 'ButtonText',
    '(@uni-forced-colors & @own(disabled))': 'GrayText',
  },
  cursor: { '': 'pointer', '@own(disabled)': 'default' },
  // No presets: the type follows the page, sizes come from the uni tokens.
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: 1,
  transition: {
    '': 'fill $uni-transition',
    '@uni-reduced-motion': false,
  },
} satisfies Styles;
/* eslint-enable tasty/no-own-at-root */
