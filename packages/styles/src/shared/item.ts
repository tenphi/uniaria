import type { Styles } from '@tenphi/tasty';

/**
 * The item look (items spec, The item look): a grid of named columns, for
 * a Button or ToggleButton with a label part, Popover's and Dialog's
 * triggers with a `triggerLabel`, and options with an `optionLabel`. The
 * label takes the first row of `label` and its description the row under
 * it; the element before the label goes in `icon` and the one after it in
 * `suffix`, found with `:has()` and sibling selectors, so you add no
 * attribute. One element each: wrap several in one. They are as far from
 * the label as a button's gap.
 *
 * In a frame, the frame is the grid: the button spans all of it as a
 * subgrid, and the extras sit over the button's end in `extras`, so the
 * button's box is under them in every state and nothing is measured.
 */

/** The columns; Select's trigger adds its chevron's after them. */
const ITEM_COLUMNS =
  '[icon] auto [label] minmax(0, 1fr) [suffix] auto [extras] auto';

/** A part's selector in a state or an affix: `Label`, or an outside part's. */
export interface ItemParts {
  readonly label: string;
  readonly description: string;
}

/** Small text: a group's label, a description in an item. */
export const smallTextStyles = {
  margin: 0,
  color: {
    '': '#uni-text-soft',
    disabled: '#uni-disabled-text',
    '@uni-forced-colors': 'CanvasText',
    '(@uni-forced-colors & disabled)': 'GrayText',
  },
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontSize: '$uni-font-size-small',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  fontWeight: '500',
  // eslint-disable-next-line tasty/prefer-shorthand-property -- no presets
  lineHeight: '$uni-line-height-small',
} satisfies Styles;

/**
 * The label: one line, ending in an ellipsis (items spec, Resolved
 * questions 8). A block with no inline padding: an ellipsis needs a block
 * container, and padding would put the cut where the overflow tooltip
 * least expects it. More lines (`line-clamp`) aren't Baseline yet. At the
 * column's start, as Select's value: an item wider than its text, a framed
 * one above all, reads as a row, not a centered button.
 */
export const itemLabelStyles = {
  display: 'block',
  gridColumn: 'label',
  gridRow: 1,
  margin: 0,
  padding: 0,
  textAlign: 'start',
  textOverflow: 'ellipsis',
} satisfies Styles;

/** The description: the label's one line in small text, its color. */
export const itemDescriptionStyles = {
  // eslint-disable-next-line tasty/no-style-spread -- the shared small text
  ...smallTextStyles,
  ...itemLabelStyles,
  gridRow: 2,
  color: 'inherit',
} satisfies Styles;

/**
 * The grid on a button's or a trigger's root while it has a label part,
 * the inline flex row of its box otherwise. Inside a frame (`*-frame`, the
 * part's marker) it spans the frame's columns as a subgrid.
 */
export function itemRootStyles({ label, description }: ItemParts): Styles {
  const labelled = `:has(> ${label})`;
  const framed = '@parent([data-uni-part$="-frame"], >)';
  const before = `@own(:has(~ ${label}))`;
  const after = `@own(:is(${label} ~ *)) & !@own(:is(${description}))`;
  return {
    display: { '': 'inline-flex', [labelled]: 'inline-grid' },
    // Each element's own margin instead, or an empty column keeps its gaps.
    gap: { '': '.5x', [labelled]: 0 },
    gridColumns: {
      '': false,
      [labelled]: ITEM_COLUMNS,
      [`${labelled} & ${framed}`]: 'subgrid',
    },
    // Explicit, or what spans an empty second row grows it.
    gridRows: {
      '': false,
      [labelled]: 'auto',
      [`${labelled} & :has(> ${description})`]: 'auto auto',
    },
    gridColumn: { '': false, [framed]: '1 / -1' },
    gridRow: { '': false, [framed]: 1 },

    // The element before the label and the one after it.
    Item: {
      $: '>*',
      gridColumn: { '': false, [before]: 'icon', [after]: 'suffix' },
      gridRow: { '': false, [`${before} | ${after}`]: '1 / -1' },
      inlineMargin: { '': false, [before]: '.5x end', [after]: '.5x start' },
    },
  };
}

/**
 * The frame: the grid the button spans and its extras sit in, in its
 * button's text color in every state, so extras drawn in `currentcolor`
 * match it. `color` is the button's map; the variant is read from the
 * root inside (`data-variant`), so you write it once.
 */
export function itemFrameStyles(
  color: Readonly<Record<string, string>>,
): Styles {
  return {
    display: 'inline-grid',
    gridColumns: ITEM_COLUMNS,
    verticalAlign: 'middle',
    color: Object.fromEntries(
      Object.entries(color).map(([key, value]) => [
        key.replaceAll(/variant=([\w-]+)/g, ':has(> [data-variant="$1"])'),
        value,
      ]),
    ),
  };
}

/**
 * The extras, over the button's end in the `extras` column, as far from
 * its edge as a 24-pixel control from the top and bottom, half a gap from
 * the label. They take no pointer events but the elements in them that
 * act, so a badge or the gaps between them press the button.
 */
export const itemExtrasStyles = {
  display: 'flex',
  alignItems: 'center',
  gap: '1bw',
  gridColumn: 'extras',
  gridRow: 1,
  boxSizing: 'border-box',
  // eslint-disable-next-line tasty/consistent-token-usage -- WCAG 2.5.8 counts CSS pixels, whatever the root font size
  inlinePadding: '.5x (($uni-control-height - max(24px, 3x)) / 2)',
  pointerEvents: 'none',

  Acting: {
    $: '*',
    pointerEvents: {
      '': false,
      '@own(:is(button, a[href], [data-uni], [data-uni-part="tooltip-trigger"]))':
        'auto',
    },
  },
} satisfies Styles;
