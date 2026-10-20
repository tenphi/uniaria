import type { Styles } from '@tenphi/tasty';

/**
 * An option, as UI Kit's items: one control-height row of soft text, 8
 * pixels inside its edge, lighter under the pointer or the focus, darker
 * pressed, and the accent theme once selected, with a check at its end
 * (the text or the mark on a fill identifies it, spec: Tokens → Colors).
 * The ring is drawn inside it, so neighbors and the scrolling list don't
 * cover or clip it. Read-only lists take no hover or press feedback.
 *
 * No margins: a virtualized list positions options absolutely, so the
 * spacing is inside each, and `inset-inline-end` gives a positioned option
 * the list's width. No `display` either: Combobox hides filtered options
 * with `hidden`. In forced colors the system paints every fill as the
 * canvas, so the check alone shows the selection.
 *
 * The check is `::after`, drawn as Checkbox's (`./marks.ts`), and the
 * option switches it with `--uni-option-mark`: Tasty writes an own state
 * after the pseudo-element (`::after:where([data-selected])`), where it
 * never matches.
 */
/* eslint-disable tasty/no-own-at-root -- spread into the option parts, where @own() reads the option's own state */
export const optionStyles = {
  position: 'relative',
  inlineInset: '0 end',
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  blockSize: 'min max(24px, $uni-control-height)',
  margin: 0,
  padding: '(($uni-control-height - $uni-line-height) / 2) 1x',
  // Room for the check at the end, half a gap from the text.
  inlinePadding: '1x 2.5x',
  radius: '1r',
  fill: {
    '': '#clear',
    '@own(focused) | (@own(hovered) & !readonly)': '#uni-surface-hover',
    '@own(pressed) & !readonly': '#uni-surface-pressed',
    '@own(selected)': '#uni-accent-surface',
    '@own(selected) & (@own(focused) | (@own(hovered) & !readonly))':
      '#uni-accent-surface-hover',
    '@own(selected) & @own(pressed) & !readonly': '#uni-accent-surface-pressed',
    '@own(disabled)': '#clear',
  },
  color: {
    '': '#uni-text-soft',
    '@own(selected)': '#uni-accent-text',
    '@own(disabled)': '#uni-disabled-text',
    '@uni-forced-colors': '#uni-system-canvas-text',
    '(@uni-forced-colors & @own(disabled))': '#uni-system-gray-text',
  },
  outline: {
    '': '0 #clear / (-1ow)',
    '@own(focus-visible)': '1ow #uni-accent-outline / (-1ow)',
    '@own(focus-visible) & @uni-forced-colors':
      '1ow #uni-system-highlight / (-1ow)',
  },
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets: the type follows the page
  fontFamily: 'inherit',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height',
  overflowWrap: 'anywhere',
  cursor: { '': 'pointer', '@own(disabled) | readonly': 'default' },
  transition: {
    '': 'fill $uni-transition, color $uni-transition',
    '@uni-reduced-motion': false,
  },

  '$uni-option-mark': { '': 'none', '@own(selected)': '""' },

  '&::after': {
    content: '$uni-option-mark',
    position: 'absolute',
    // Centered 1.25rem from the end, as far from the edge as the text.
    inlineInset: '(1x + .125rem) end',
    blockInset: '(50% - .3125rem) start',
    boxSizing: 'border-box',
    inlineSize: 'fixed .25rem',
    blockSize: 'fixed .5rem',
    border: '2bw #current right bottom',
    rotate: '45deg',
  },
} satisfies Styles;
/* eslint-enable tasty/no-own-at-root */

/** Small soft text: a group's label, an option's description. */
const smallTextStyles = {
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

/**
 * The option and the parts around it, as Listbox, Select and Combobox
 * share them: an option's label over its description, a group's label 8
 * pixels above its options, and the empty state in the option's place, in
 * soft text. The group itself takes nothing, and no part that UniAria
 * hides sets `display`.
 */
export const optionPartStyles = {
  Option: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared option, the same in every list
    ...optionStyles,
  },
  OptionLabel: {
    display: 'block',
  },
  OptionDescription: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared small text
    ...smallTextStyles,
    display: 'block',
    // The option's color: soft, the accent's once selected, or disabled.
    color: 'inherit',
  },
  // UI Kit's section heading: small capitals in weight 600.
  GroupLabel: {
    // eslint-disable-next-line tasty/no-style-spread -- the shared small text
    ...smallTextStyles,
    display: 'block',
    padding: '1x 1x .5x',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontWeight: '600',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    letterSpacing: '.01em',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    textTransform: 'uppercase',
  },
  Empty: {
    margin: 0,
    padding: '(($uni-control-height - $uni-line-height) / 2) 1x',
    color: {
      '': '#uni-text-soft',
      disabled: '#uni-disabled-text',
      '@uni-forced-colors': '#uni-system-canvas-text',
      '(@uni-forced-colors & disabled)': '#uni-system-gray-text',
    },
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    fontSize: '$uni-font-size',
    // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
    lineHeight: '$uni-line-height',
  },
} satisfies Styles;
