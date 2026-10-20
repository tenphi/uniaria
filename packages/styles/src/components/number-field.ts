import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { wrappedInputStyles } from '../shared/input';

/**
 * A stepper: a quiet 24-pixel button inside the box, in markup order
 * beside the input. UI Kit stacks two half-height ones; here each keeps
 * the 24-pixel target (WCAG 2.5.8). At the box's edge it sits as far from
 * the edge as from the top and bottom (the inset), its corners concentric
 * with the box's. It reads its own state, which UniAria writes as
 * Button's: disabled while it can't step.
 */
/* eslint-disable tasty/no-own-at-root -- spread into the stepper parts, where @own() reads the button's own state */
const stepperStyles = {
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
      // eslint-disable-next-line tasty/consistent-token-usage -- the stepper's size, as above
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
    '@uni-forced-colors': '#uni-system-button-face',
  },
  color: {
    '': '#uni-text',
    '@own(disabled)': '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-button-text',
    '(@uni-forced-colors & @own(disabled))': '#uni-system-gray-text',
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

/**
 * NumberField: TextField's look (`../shared/input.ts`), the number at the
 * input's end as in UI Kit, in digits of one width, and the steppers
 * beside it.
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
    // eslint-disable-next-line tasty/no-style-spread -- the same as Decrement
    ...stepperStyles,
  },
  Decrement: {
    // eslint-disable-next-line tasty/no-style-spread -- the same as Increment
    ...stepperStyles,
  },
} satisfies Styles;
