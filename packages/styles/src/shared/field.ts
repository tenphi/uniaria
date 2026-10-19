import type { Styles } from '@tenphi/tasty';

/**
 * A field's description and error, as every field with an `Input` part
 * shows them: small text, soft or in the danger theme. A field hides its
 * error with `hidden`, so neither sets `display` (spec: Specificity and
 * overrides).
 */
export const fieldDescription = {
  margin: 0,
  color: {
    '': '#uni-text-soft',
    '@uni-input-disabled': '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
    '(@uni-forced-colors & @uni-input-disabled)': '#uni-system-gray-text',
  },
  fontSize: '$uni-font-size-small',
} satisfies Styles;

export const fieldError = {
  margin: 0,
  color: {
    '': '#uni-danger-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
  },
  fontSize: '$uni-font-size-small',
} satisfies Styles;
