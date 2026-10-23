import type { Styles } from '@tenphi/tasty';

import { fieldStackStyles } from '../shared/field';
import { focusRingStyles } from '../shared/focus';
import { inputBoxStyles } from '../shared/input';
import { itemExtrasStyles } from '../shared/item';
import { chevronStyles } from '../shared/marks';
import { popupStyles } from '../shared/popup';

/**
 * Select: the shared column (`../shared/field.ts`), the trigger as the
 * input box (`../shared/input.ts`) with the value and a chevron, and the
 * picker's popup (`../shared/popup.ts`). The trigger is a button: lighter
 * under the pointer, darker pressed, and its ring on keyboard focus only,
 * which stays while the keys move through the list. The value keeps to
 * one line and ends in an ellipsis; the placeholder is soft.
 *
 * The trigger is the item grid (`../shared/item.ts`), the value in its
 * `label` column. In a `triggerFrame`, it spans the frame as a subgrid,
 * with the extras over it and its chevron after them, as UI Kit's caret
 * comes after its actions.
 */
export const selectStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared field column, the same as Field's
  ...fieldStackStyles,

  // The item grid's columns, and the chevron's after the extras.
  TriggerFrame: {
    display: 'grid',
    gridColumns:
      '[icon] auto [label] minmax(0, 1fr) [suffix] auto [extras] auto [chevron] auto',
    color: {
      '': '#uni-text',
      '(@uni-input-disabled | @own(@uni-disabled))': '#uni-disabled-text',
    },
  },
  Trigger: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared input box
    ...inputBoxStyles,
    // eslint-disable-next-line tasty/no-style-spread -- the shared focus ring, on keyboard focus as a button shows it
    ...focusRingStyles,
    display: 'grid',
    gridColumns: {
      '': '[icon] auto [label] minmax(0, 1fr) [suffix] auto [extras] auto [chevron] auto',
      '@own(:is(TriggerFrame > *))': 'subgrid',
    },
    gridColumn: { '': false, '@own(:is(TriggerFrame > *))': '1 / -1' },
    gridRow: { '': false, '@own(:is(TriggerFrame > *))': 1 },
    alignItems: 'center',
    margin: 0,
    padding: '0 (1x - 1bw)',
    fill: {
      '': '#uni-surface',
      '@own(hovered) & !readonly': '#uni-surface-hover',
      '@own(pressed) & !readonly': '#uni-surface-pressed',
      '(@uni-input-disabled | @own(@uni-disabled))': '#uni-disabled-surface',
    },
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
    fontFamily: 'inherit',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontSize: '$uni-font-size',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    lineHeight: '$uni-line-height',
    textAlign: 'start',
    cursor: {
      '': 'pointer',
      '(@uni-input-disabled | @own(@uni-disabled))': 'default',
    },
    transition: {
      '': 'fill $uni-transition, border $uni-transition',
      '@uni-reduced-motion': false,
    },

    '&::after': {
      // eslint-disable-next-line tasty/no-style-spread -- the shared chevron
      ...chevronStyles,
      gridColumn: 'chevron',
      gridRow: 1,
      // Half a gap and its own margin from the value or the extras.
      inlineMargin: '(.5x + .25rem) .25rem',
    },
  },
  TriggerExtras: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared extras
    ...itemExtrasStyles,
    // The chevron keeps its own margin after them.
    inlinePadding: '.5x 0',
  },
  Value: {
    display: 'block',
    gridColumn: 'label',
    gridRow: 1,
    textOverflow: 'ellipsis',
    color: {
      '': 'inherit',
      'placeholder & !disabled': '#uni-text-soft',
    },
  },

  ...popupStyles,

  // Visually hidden until it has focus, then a row at the popup's end.
  Close: {
    position: { '': 'absolute', '@own(@uni-focused)': 'relative' },
    clipPath: { '': 'inset(50%)', '@own(@uni-focused)': 'none' },
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
    blockSize: 'min max(24px, $uni-control-height)',
    margin: 0,
    padding: '(($uni-control-height - $uni-line-height) / 2) 1x',
    border: '0 #clear',
    radius: '1r',
    fill: '#uni-surface-hover',
    color: '#uni-text',
    outline: {
      '': '1ow #uni-accent-outline / (-1ow)',
      '@uni-forced-colors': '1ow Highlight / (-1ow)',
    },
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontFamily: 'inherit',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontSize: '$uni-font-size',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    lineHeight: '$uni-line-height',
    textAlign: 'start',
    cursor: 'pointer',
  },
} satisfies Styles;
